"""Workshop router — proxies Bohemia Reforger Workshop directly (no agent)."""
from __future__ import annotations

import asyncio
import json
import math
import os
import re
import time
from pathlib import Path
from typing import Any, Final

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response

from ..deps import require_role
from ..paths import DATA_DIR

router = APIRouter(prefix="/api/workshop", tags=["workshop"])

_READ_ROLES = ("owner", "head_admin", "admin", "moderator", "viewer", "demo")

CACHE_DIR = DATA_DIR / "cache"
THUMB_DIR = DATA_DIR / "cache" / "workshop-thumbs"
WS_INDEX_PATH = DATA_DIR / "cache" / "ws_index.json"

WS_CACHE_TTL_SEARCH: Final[float] = 300.0
WS_CACHE_TTL_MOD: Final[float] = 3600.0
WS_BUILD_ID_TTL: Final[float] = 3600.0
THUMB_MAX_AGE: Final[float] = 7 * 86400
THUMB_CAP_BYTES: Final[int] = 500 * 1024 * 1024

_BOHEMIA_BASE: Final[str] = "https://reforger.armaplatform.com"
_FALLBACK_BUILD_ID: Final[str] = "8cIQrfsP0mdy2y8uLb1ix"

_GUID_RE = re.compile(r"^[0-9A-F]{16}$")

_ws_cache: dict[str, dict[str, Any]] = {}
_ws_build_id: str = ""
_ws_build_id_ts: float = 0.0

_ws_index: list[dict[str, Any]] = []
_ws_index_state: dict[str, Any] = {"status": "idle", "count": 0, "built_at": None}
_ws_index_lock = asyncio.Lock()
_ws_index_task: asyncio.Task | None = None

_thumb_fetch_sem = asyncio.Semaphore(8)
_prefetch_inflight: set[str] = set()


# -- helpers ------------------------------------------------------------------

def _cache_get(key: str, ttl: float) -> Any | None:
    e = _ws_cache.get(key)
    if e and time.time() - e["ts"] < ttl:
        return e["data"]
    if e:
        _ws_cache.pop(key, None)
    return None


def _cache_set(key: str, data: Any) -> None:
    _ws_cache[key] = {"data": data, "ts": time.time()}


def _http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=15,
        follow_redirects=True,
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
    )


async def _get_build_id() -> str:
    global _ws_build_id, _ws_build_id_ts
    if _ws_build_id and time.time() - _ws_build_id_ts < WS_BUILD_ID_TTL:
        return _ws_build_id
    try:
        async with _http_client() as c:
            r = await c.get(f"{_BOHEMIA_BASE}/workshop")
            m = re.search(r'"buildId":"([^"]+)"', r.text)
            if m:
                _ws_build_id = m.group(1)
                _ws_build_id_ts = time.time()
                return _ws_build_id
    except Exception:
        pass
    return _ws_build_id or _FALLBACK_BUILD_ID


async def _fetch_search_page(build_id: str, q: str, page: int, sort: str) -> dict[str, Any]:
    params: dict[str, Any] = {"page": page, "sort": sort}
    if q:
        params["search"] = q
    url = f"{_BOHEMIA_BASE}/_next/data/{build_id}/workshop.json"
    async with _http_client() as c:
        r = await c.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def _fetch_mod_detail_raw(build_id: str, mod_id: str) -> dict[str, Any]:
    url = f"{_BOHEMIA_BASE}/_next/data/{build_id}/workshop/{mod_id}.json"
    async with _http_client() as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.json()


def _simplify_mod(mod: dict[str, Any]) -> dict[str, Any]:
    image: str | None = None
    for preview in mod.get("previews", []) or []:
        thumbs = (preview.get("thumbnails") or {}).get("image/jpeg", []) or []
        if thumbs:
            mid_idx = len(thumbs) // 2
            mid = sorted(thumbs, key=lambda t: t.get("width", 9999))[mid_idx]
            image = mid.get("url")
        if not image:
            image = preview.get("url")
        break
    return {
        "id": mod.get("id"),
        "name": mod.get("name"),
        "summary": mod.get("summary", ""),
        "author": (mod.get("author") or {}).get("username", ""),
        "version": mod.get("currentVersionNumber", ""),
        "subscribers": mod.get("subscriberCount", 0),
        "rating": round((mod.get("averageRating") or 0) * 5, 1),
        "ratingCount": mod.get("ratingCount", 0),
        "image": image,
        "size": mod.get("currentVersionSize", 0),
        "tags": [t["name"] for t in (mod.get("tags") or []) if t.get("name")],
        "updatedAt": mod.get("updatedAt", ""),
    }


def _ensure_dirs() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)


def _thumb_path_for(mod_id: str) -> Path:
    return THUMB_DIR / f"{mod_id}.jpg"


def _evict_thumb_lru() -> None:
    if not THUMB_DIR.exists():
        return
    entries: list[tuple[float, int, Path]] = []
    total = 0
    for p in THUMB_DIR.iterdir():
        try:
            st = p.stat()
        except OSError:
            continue
        entries.append((st.st_atime, st.st_size, p))
        total += st.st_size
    if total <= THUMB_CAP_BYTES:
        return
    entries.sort(key=lambda e: e[0])
    for _atime, sz, path in entries:
        if total <= THUMB_CAP_BYTES:
            break
        try:
            path.unlink()
            total -= sz
        except OSError:
            continue


async def _prefetch_thumb_direct(mod_id: str, image_url: str) -> None:
    if mod_id in _prefetch_inflight:
        return
    path = _thumb_path_for(mod_id)
    if path.exists():
        try:
            st = path.stat()
            if time.time() - st.st_mtime < THUMB_MAX_AGE:
                return
        except OSError:
            pass
    _prefetch_inflight.add(mod_id)
    try:
        _ensure_dirs()
        async with _thumb_fetch_sem:
            async with _http_client() as c:
                r = await c.get(image_url)
                if r.status_code == 404:
                    try:
                        path.write_bytes(b"")
                    except OSError:
                        pass
                    return
                r.raise_for_status()
                tmp = path.with_suffix(".tmp")
                tmp.write_bytes(r.content)
                os.replace(tmp, path)
    except Exception:
        pass
    finally:
        _prefetch_inflight.discard(mod_id)


def _schedule_prefetch(mods_list: list[dict[str, Any]]) -> None:
    for m in mods_list:
        mid = m.get("id")
        img = m.get("image")
        if isinstance(mid, str) and _GUID_RE.match(mid) and isinstance(img, str) and img:
            asyncio.create_task(_prefetch_thumb_direct(mid, img))


def _load_ws_index_from_disk() -> None:
    global _ws_index, _ws_index_state
    if not WS_INDEX_PATH.exists():
        return
    try:
        data = json.loads(WS_INDEX_PATH.read_text())
        _ws_index = data.get("mods", [])
        _ws_index_state = {
            "status": "ready" if _ws_index else "idle",
            "count": len(_ws_index),
            "built_at": data.get("built_at"),
        }
    except Exception:
        pass


async def _build_ws_index_bg() -> None:
    global _ws_index, _ws_index_state
    _ws_index_state = {"status": "building", "count": 0, "built_at": None}
    all_mods: dict[str, dict[str, Any]] = {}
    sem = asyncio.Semaphore(5)
    try:
        build_id = await _get_build_id()
        base_url = f"{_BOHEMIA_BASE}/_next/data/{build_id}/workshop.json"

        async def fetch_page(sort: str, page: int) -> list[dict[str, Any]]:
            async with sem:
                try:
                    async with _http_client() as c:
                        r = await c.get(base_url, params={"page": page, "sort": sort})
                        r.raise_for_status()
                        raw = r.json()
                    pp = raw.get("pageProps", raw.get("props", {}).get("pageProps", {}))
                    return [
                        _simplify_mod(m)
                        for m in (pp.get("assets", {}) or {}).get("rows", []) or []
                    ]
                except Exception:
                    return []

        tasks = (
            [fetch_page("downloads", p) for p in range(1, 151)]
            + [fetch_page("newest", p) for p in range(1, 51)]
        )
        results = await asyncio.gather(*tasks)
        for batch in results:
            for mod in batch:
                mid = mod.get("id")
                if mid and mid not in all_mods:
                    all_mods[mid] = mod
                    _ws_index_state["count"] = len(all_mods)
        _ws_index = list(all_mods.values())
        built_at = time.time()
        _ws_index_state = {
            "status": "ready",
            "count": len(_ws_index),
            "built_at": built_at,
        }
        try:
            _ensure_dirs()
            WS_INDEX_PATH.write_text(
                json.dumps({"mods": _ws_index, "built_at": built_at})
            )
        except Exception:
            pass
    except Exception as e:
        _ws_index_state = {
            "status": "error",
            "count": len(_ws_index),
            "built_at": None,
            "error": str(e),
        }


async def _get_mod_detail(mod_id: str) -> dict[str, Any]:
    cache_key = f"mod:{mod_id}"
    cached = _cache_get(cache_key, WS_CACHE_TTL_MOD)
    if cached is not None:
        return cached
    build_id = await _get_build_id()
    raw = await _fetch_mod_detail_raw(build_id, mod_id)
    pp = raw.get("pageProps", raw.get("props", {}).get("pageProps", {}))
    asset = pp.get("asset", {}) or {}
    image: str | None = None
    for preview in asset.get("previews", []) or []:
        image = preview.get("url")
        break
    versions = [
        {
            "version": v.get("version"),
            "gameVersion": v.get("gameVersion", ""),
            "size": v.get("totalFileSize", 0),
            "date": v.get("createdAt", ""),
        }
        for v in (asset.get("versions") or [])
    ]
    raw_scenarios = asset.get("scenarios") or []
    scenarios: list[dict[str, Any]] = []
    for s in raw_scenarios:
        if not isinstance(s, dict) or not s.get("gameId"):
            continue
        img_obj = s.get("image") or {}
        thumb: str | None = None
        for t in (img_obj.get("thumbnails") or {}).get("image/jpeg", []) or []:
            thumb = t.get("url")
            break
        scenarios.append({
            "name": s.get("name", ""),
            "id": s.get("gameId", ""),
            "gameMode": s.get("gameMode", ""),
            "playerCount": s.get("playerCount", 0),
            "description": s.get("description", ""),
            "image": img_obj.get("url") or thumb,
        })
    dependencies: list[dict[str, Any]] = []
    for dep in (asset.get("dependencies") or []):
        if not isinstance(dep, dict):
            continue
        da = dep.get("asset") or dep
        dep_id = da.get("id", "")
        if not dep_id:
            continue
        dependencies.append({
            "id": dep_id,
            "name": da.get("name", dep_id),
            "version": dep.get("version") or dep.get("currentVersionNumber", ""),
            "size": dep.get("totalFileSize", 0),
        })
    result = {
        **_simplify_mod(asset),
        "image": image,
        "description": asset.get("description") or asset.get("summary", ""),
        "versions": versions,
        "scenarios": scenarios,
        "dependencies": dependencies,
    }
    _cache_set(cache_key, result)
    return result


# -- endpoints ----------------------------------------------------------------


@router.get("/search")
async def search_mods(
    q: str = Query(""),
    page: int = Query(1, ge=1),
    sort: str = Query("downloads"),
    tags: str = Query(""),
    user=Depends(require_role(*_READ_ROLES)),
) -> dict[str, Any]:
    global _ws_index_task

    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            if _ws_index_state["status"] == "idle":
                _ws_index_task = asyncio.create_task(_build_ws_index_bg())
            if _ws_index:
                def tag_match(mod: dict[str, Any]) -> bool:
                    mod_tags = [str(t).lower() for t in (mod.get("tags") or [])]
                    return any(
                        any(ft.lower() in mt or mt in ft.lower() for mt in mod_tags)
                        for ft in tag_list
                    )

                filtered = [m for m in _ws_index if tag_match(m)]
                if q:
                    ql = q.lower()
                    filtered = [
                        m for m in filtered
                        if ql in (m.get("name") or "").lower()
                        or ql in (m.get("author") or "").lower()
                    ]
                if sort == "newest":
                    filtered.sort(key=lambda m: m.get("updatedAt", ""), reverse=True)
                elif sort == "popular":
                    filtered.sort(key=lambda m: m.get("rating", 0), reverse=True)
                else:
                    filtered.sort(key=lambda m: m.get("subscribers", 0), reverse=True)
                per_page = 20
                total = len(filtered)
                start = (page - 1) * per_page
                slice_ = filtered[start:start + per_page]
                _schedule_prefetch(slice_)
                return {
                    "mods": slice_,
                    "total": total,
                    "page": page,
                    "pages": max(1, math.ceil(total / per_page)),
                    "from_index": True,
                    "index_count": len(_ws_index),
                    "index_status": _ws_index_state["status"],
                }
            try:
                build_id = await _get_build_id()
                raw = await _fetch_search_page(build_id, tag_list[0], page, sort)
                pp = raw.get("pageProps", raw.get("props", {}).get("pageProps", {}))
                assets = pp.get("assets", {}) or {}
                rows = assets.get("rows", []) or []
                total = assets.get("count", 0) or 0
                simplified = [_simplify_mod(m) for m in rows]
                _schedule_prefetch(simplified)
                return {
                    "mods": simplified,
                    "total": total,
                    "page": page,
                    "pages": max(1, math.ceil(total / max(1, len(rows)))) if rows else 1,
                    "from_index": False,
                    "index_status": _ws_index_state["status"],
                    "index_count": 0,
                }
            except Exception:
                return {
                    "mods": [],
                    "total": 0,
                    "page": 1,
                    "pages": 1,
                    "from_index": False,
                    "index_status": _ws_index_state["status"],
                    "index_count": 0,
                }

    cache_key = f"search:{q}:{page}:{sort}"
    cached = _cache_get(cache_key, WS_CACHE_TTL_SEARCH)
    if cached is not None:
        _schedule_prefetch(cached.get("mods") or [])
        return cached
    try:
        build_id = await _get_build_id()
        raw = await _fetch_search_page(build_id, q, page, sort)
        pp = raw.get("pageProps", raw.get("props", {}).get("pageProps", {}))
        assets = pp.get("assets", {}) or {}
        rows = assets.get("rows", []) or []
        total = assets.get("count", 0) or 0
        simplified = [_simplify_mod(m) for m in rows]
        _schedule_prefetch(simplified)
        result = {
            "mods": simplified,
            "total": total,
            "page": page,
            "pages": max(1, math.ceil(total / max(1, len(rows)))) if rows else 1,
        }
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        return {"error": str(e), "mods": [], "total": 0, "page": 1, "pages": 1}


@router.get("/mod/{mod_id}")
async def get_mod(
    mod_id: str,
    user=Depends(require_role(*_READ_ROLES)),
) -> dict[str, Any]:
    if not _GUID_RE.match(mod_id):
        raise HTTPException(status_code=400, detail="mod_id must be 16 uppercase hex chars")
    try:
        return await _get_mod_detail(mod_id)
    except Exception as e:
        return {"error": str(e)}


@router.post("/bulk")
async def bulk_lookup(
    request: Request,
    user=Depends(require_role(*_READ_ROLES)),
) -> dict[str, Any]:
    body = await request.json()
    raw_ids = body.get("mod_ids")
    if not isinstance(raw_ids, list):
        raise HTTPException(status_code=400, detail="'mod_ids' must be a list")
    if len(raw_ids) > 50:
        raise HTTPException(status_code=400, detail="'mod_ids' capped at 50 per request")
    ids: list[str] = []
    for v in raw_ids:
        if not isinstance(v, str) or not _GUID_RE.match(v):
            raise HTTPException(status_code=400, detail=f"invalid mod_id: {v!r}")
        if v not in ids:
            ids.append(v)

    sem = asyncio.Semaphore(5)

    async def one(mid: str) -> tuple[str, dict[str, Any] | None]:
        async with sem:
            try:
                d = await _get_mod_detail(mid)
                if "error" in d and len(d) <= 1:
                    return mid, None
                return mid, d
            except Exception:
                return mid, None

    pairs = await asyncio.gather(*(one(mid) for mid in ids))
    result_map = {mid: detail for mid, detail in pairs}
    prefetch_items = [
        {"id": mid, "image": d.get("image")}
        for mid, d in result_map.items()
        if isinstance(d, dict) and d.get("image")
    ]
    _schedule_prefetch(prefetch_items)
    return {"mods": result_map}


@router.get("/thumb/{mod_id}")
async def get_thumb(
    mod_id: str,
    user=Depends(require_role(*_READ_ROLES)),
) -> Response:
    if not _GUID_RE.match(mod_id):
        raise HTTPException(status_code=400, detail="mod_id must be 16 uppercase hex chars")
    _ensure_dirs()
    path = _thumb_path_for(mod_id)

    if path.exists():
        try:
            st = path.stat()
            if time.time() - st.st_mtime < THUMB_MAX_AGE:
                if st.st_size == 0:
                    raise HTTPException(status_code=404, detail="no thumbnail")
                return FileResponse(path, media_type="image/jpeg")
        except HTTPException:
            raise
        except OSError:
            pass

    try:
        detail = await _get_mod_detail(mod_id)
    except Exception:
        detail = {}
    image_url = detail.get("image") if isinstance(detail, dict) else None
    if not image_url:
        try:
            path.write_bytes(b"")
        except OSError:
            pass
        raise HTTPException(status_code=404, detail="no thumbnail")

    async with _thumb_fetch_sem:
        try:
            async with _http_client() as c:
                r = await c.get(image_url)
                if r.status_code == 404:
                    try:
                        path.write_bytes(b"")
                    except OSError:
                        pass
                    raise HTTPException(status_code=404, detail="no thumbnail")
                r.raise_for_status()
                tmp = path.with_suffix(".tmp")
                tmp.write_bytes(r.content)
                os.replace(tmp, path)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

    try:
        _evict_thumb_lru()
    except Exception:
        pass
    return FileResponse(path, media_type="image/jpeg")


@router.get("/index/status")
async def index_status(
    user=Depends(require_role(*_READ_ROLES)),
) -> dict[str, Any]:
    built = _ws_index_state.get("built_at")
    stale = bool(built and time.time() - built > 86400)
    return {**_ws_index_state, "stale": stale}


@router.post("/index/build")
async def index_build(
    user=Depends(require_role(*_READ_ROLES)),
) -> dict[str, Any]:
    global _ws_index_task
    async with _ws_index_lock:
        if _ws_index_state["status"] == "building":
            return {"message": "Already building", "status": "building"}
        _ws_index_state["status"] = "building"
    _ws_index_task = asyncio.create_task(_build_ws_index_bg())
    return {"message": "Index build started", "status": "building"}


try:
    _load_ws_index_from_disk()
except Exception:
    pass


def start_index_build_if_needed() -> None:
    global _ws_index_task
    if _ws_index and _ws_index_state["status"] == "ready":
        return
    if _ws_index_state["status"] == "building":
        return
    _ws_index_task = asyncio.ensure_future(_build_ws_index_bg())
