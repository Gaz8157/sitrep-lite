import { useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPut, APIError } from "../../api/index.js"
import { Btn, Empty } from "../../components/index.js"
import { useMobile, useThumbnail } from "../../hooks/index.js"
import ClearAllButton from "./ClearAllButton.jsx"

const SORTS = [
  ["order", "Load Order"],
  ["name", "Name"],
  ["size", "Size"],
]

const WORKSHOP_BASE = "https://reforger.armaplatform.com/workshop/"

function fmtSize(s) {
  if (!s || s <= 0) return ""
  if (s >= 1048576) return `${(s / 1048576).toFixed(0)} MB`
  if (s >= 1024) return `${(s / 1024).toFixed(0)} KB`
  return ""
}

function fmtDL(n) {
  if (!n || n <= 0) return ""
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function InstalledCard({ mod, detail, onOpen, onRemove, removing }) {
  const { C, sz } = useT()
  const { ref, src } = useThumbnail(mod.mod_guid)

  const name = mod.name || detail?.name || "Unnamed"
  const author = detail?.author || ""
  const modTags = (detail?.tags || []).slice(0, 3)
  const size = fmtSize(detail?.size || mod.size || 0)
  const dl = fmtDL(detail?.subscribers || 0)
  const initial = (name || "?")[0]?.toUpperCase() || "?"

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.accent}40`,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)"
        e.currentTarget.style.boxShadow = `0 8px 24px ${C.accent}15`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ""
        e.currentTarget.style.boxShadow = ""
      }}
    >
      <div
        ref={ref}
        onClick={onOpen}
        className="relative overflow-hidden shrink-0 cursor-pointer"
        style={{ paddingTop: "56.25%", background: C.bgInput }}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={e => { e.currentTarget.style.display = "none" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center font-black"
            style={{ color: C.textMuted, fontSize: 28 }}
          >
            {initial}
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }}
        />
        <div
          className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md font-black"
          style={{ background: C.accent, color: "#000", fontSize: 8, letterSpacing: 1 }}
        >
          ON SERVER
        </div>
        {size && (
          <div
            className="absolute top-2 right-2 px-2 py-1 rounded-md font-mono font-bold"
            style={{ background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: sz.stat }}
          >
            {size}
          </div>
        )}
      </div>

      <div
        onClick={onOpen}
        className="p-3 flex flex-col flex-1 cursor-pointer"
      >
        <div
          className="font-bold truncate mb-0.5"
          style={{ color: C.text, fontSize: sz.base }}
          title={name}
        >
          {name}
        </div>
        {author && (
          <div className="truncate mb-1" style={{ color: C.textMuted, fontSize: sz.stat }}>
            by {author}
          </div>
        )}
        <div
          className="flex items-center justify-between mb-1.5"
          style={{ fontSize: sz.stat }}
        >
          <span className="font-mono" style={{ color: C.textMuted }}>
            {mod.version ? `v${mod.version}` : "latest"}
          </span>
          {dl && <span style={{ color: C.textDim }}>{dl} DL</span>}
          {detail?.rating > 0 && <span style={{ color: C.orange }}>{detail.rating}/5</span>}
        </div>
        {modTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {modTags.map(t => (
              <span
                key={t}
                style={{
                  background: C.bgInput,
                  color: C.textMuted,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  fontSize: Math.max(7, sz.stat - 2),
                  padding: "1px 5px",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 px-3 pb-3 shrink-0">
        <button
          onClick={onOpen}
          className="flex-1 py-1.5 rounded-lg font-bold cursor-pointer"
          style={{
            background: C.bgInput,
            color: C.textDim,
            border: `1px solid ${C.border}`,
            fontSize: sz.stat,
          }}
        >
          Details
        </button>
        <a
          href={WORKSHOP_BASE + mod.mod_guid}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="View on Workshop"
          className="px-2.5 py-1.5 rounded-lg font-bold cursor-pointer flex items-center"
          style={{
            background: C.bgInput,
            color: C.accent,
            border: `1px solid ${C.accent}40`,
            fontSize: sz.stat,
            textDecoration: "none",
          }}
        >
          ↗
        </a>
        <button
          onClick={onRemove}
          disabled={removing}
          className="px-3 py-1.5 rounded-lg font-bold cursor-pointer disabled:opacity-50"
          style={{
            background: C.redBg,
            color: C.red,
            border: `1px solid ${C.redBorder}`,
            fontSize: sz.stat,
          }}
        >
          {removing ? "..." : "Remove"}
        </button>
      </div>
    </div>
  )
}

export default function InstalledGrid({
  instanceId,
  mods,
  installedMap,
  onOpenMod,
  onReload,
  onExport,
  onImport,
  toast,
}) {
  const { C, sz } = useT()
  const mobile = useMobile()

  const [instSearch, setInstSearch] = useState("")
  const [instSort, setInstSort] = useState(() => {
    try { return localStorage.getItem("inst-sort") || "order" } catch { return "order" }
  })
  const guidsKey = useMemo(
    () => mods.map(m => m.mod_guid).filter(Boolean).sort().join(","),
    [mods],
  )
  const cacheKey = guidsKey ? `inst-bulk:${guidsKey}` : null

  const [details, setDetails] = useState(() => {
    if (!cacheKey) return {}
    try {
      const raw = sessionStorage.getItem(cacheKey)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [removing, setRemoving] = useState(null)
  const importRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem("inst-sort", instSort) } catch {}
  }, [instSort])

  useEffect(() => {
    if (!cacheKey) { setDetails({}); return }
    let aborted = false
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) setDetails(JSON.parse(raw))
    } catch {}
    const ids = guidsKey.split(",")
    setDetailsLoading(true)
    ;(async () => {
      try {
        const d = await apiPost("/api/workshop/bulk", { mod_ids: ids })
        if (aborted) return
        const list = d?.mods
        const next = {}
        if (Array.isArray(list)) {
          for (const m of list) { if (m && m.id) next[m.id] = m }
        } else if (list && typeof list === "object") {
          for (const [k, v] of Object.entries(list)) {
            if (v && typeof v === "object") next[k] = v
          }
        }
        setDetails(next)
        try { sessionStorage.setItem(cacheKey, JSON.stringify(next)) } catch {}
      } catch {
        // soft fail — cards render with placeholders
      } finally {
        if (!aborted) setDetailsLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [cacheKey, guidsKey])

  const filteredInstalled = useMemo(() => {
    let r = [...mods]
    if (instSearch) {
      const q = instSearch.toLowerCase()
      r = r.filter(m =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.mod_guid || "").toLowerCase().includes(q),
      )
    }
    if (instSort === "name") {
      r.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    } else if (instSort === "size") {
      r.sort((a, b) =>
        (details[b.mod_guid]?.size || 0) - (details[a.mod_guid]?.size || 0),
      )
    }
    return r
  }, [mods, instSearch, instSort, details])

  const openFor = (m) => {
    const d = details[m.mod_guid]
    onOpenMod?.({
      id: m.mod_guid,
      name: m.name || d?.name,
      version: m.version || d?.version || "",
      image: d?.image || null,
      author: d?.author || "",
      rating: d?.rating || 0,
      ratingCount: d?.ratingCount || 0,
      subscribers: d?.subscribers || 0,
      tags: d?.tags || [],
      summary: d?.summary || "",
    })
  }

  const [bulkBusy, setBulkBusy] = useState(false)
  const pinnedCount = useMemo(
    () => mods.filter(m => m.version && m.version.length > 0).length,
    [mods],
  )

  const setAllLatest = async () => {
    if (bulkBusy || instanceId == null) return
    if (!mods.length) { toast?.("No installed mods", "warning"); return }
    if (pinnedCount === 0) { toast?.("All mods already on latest", "info"); return }
    setBulkBusy(true)
    try {
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      if (!next.game) next.game = {}
      const cur = Array.isArray(next.game.mods) ? next.game.mods : []
      next.game.mods = cur.map(m => ({ ...m, version: "" }))
      await apiPut(`/api/servers/${instanceId}/config`, next)
      toast?.(`${pinnedCount} mod${pinnedCount !== 1 ? "s" : ""} set to latest`)
      onReload?.()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBulkBusy(false)
    }
  }

  const pinToCurrent = async () => {
    if (bulkBusy || instanceId == null) return
    if (!mods.length) { toast?.("No installed mods", "warning"); return }
    setBulkBusy(true)
    try {
      const ids = mods.map(m => m.mod_guid).filter(Boolean)
      // workshop.bulk caps at 50 per call — chunk to handle 150+ mod loadouts.
      const versions = {}
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50)
        const resp = await apiPost("/api/workshop/bulk", { mod_ids: chunk })
        const list = resp?.mods
        if (Array.isArray(list)) {
          for (const m of list) { if (m && m.id && m.version) versions[m.id] = m.version }
        } else if (list && typeof list === "object") {
          for (const [k, v] of Object.entries(list)) {
            if (v && typeof v === "object" && v.version) versions[k] = v.version
          }
        }
      }
      const missing = ids.filter(id => !versions[id])
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      if (!next.game) next.game = {}
      const cur = Array.isArray(next.game.mods) ? next.game.mods : []
      let changed = 0
      next.game.mods = cur.map(m => {
        const guid = (m.modId || m.mod_guid || "").toUpperCase()
        const v = versions[guid]
        if (v && m.version !== v) { changed += 1; return { ...m, version: v } }
        return m
      })
      if (!changed) {
        toast?.(
          missing.length
            ? `No version data for ${missing.length} mod${missing.length !== 1 ? "s" : ""}`
            : "All mods already pinned to current",
          missing.length ? "warning" : "info",
        )
        return
      }
      await apiPut(`/api/servers/${instanceId}/config`, next)
      const msg = `Pinned ${changed} mod${changed !== 1 ? "s" : ""} to current version${missing.length ? ` (${missing.length} missing)` : ""}`
      toast?.(msg, missing.length ? "warning" : "success")
      onReload?.()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBulkBusy(false)
    }
  }

  const refreshNames = async () => {
    if (bulkBusy || instanceId == null) return
    if (!mods.length) { toast?.("No installed mods", "warning"); return }
    setBulkBusy(true)
    try {
      const ids = mods.map(m => m.mod_guid)
      let lookup = details
      const missing = ids.filter(id => !lookup[id]?.name)
      if (missing.length) {
        const d = await apiPost("/api/workshop/bulk", { mod_ids: missing })
        const list = d?.mods
        lookup = { ...details }
        if (Array.isArray(list)) {
          for (const m of list) { if (m && m.id) lookup[m.id] = m }
        } else if (list && typeof list === "object") {
          for (const [k, v] of Object.entries(list)) {
            if (v && typeof v === "object") lookup[k] = v
          }
        }
        setDetails(lookup)
      }
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      if (!next.game) next.game = {}
      const cur = Array.isArray(next.game.mods) ? next.game.mods : []
      const looksBad = (s) =>
        !s || /^[0-9A-Fa-f]{16}$/.test(s) || /^modId/i.test(s) || /["'\\]/.test(s)
      let fixed = 0
      next.game.mods = cur.map(m => {
        const guid = (m.modId || m.mod_guid || "").toUpperCase()
        const workshopName = lookup[guid]?.name
        if (workshopName && (looksBad(m.name) || m.name !== workshopName)) {
          fixed += 1
          return { ...m, name: workshopName }
        }
        return m
      })
      if (!fixed) {
        toast?.("All names already up to date", "info")
        return
      }
      await apiPut(`/api/servers/${instanceId}/config`, next)
      toast?.(`Refreshed ${fixed} mod name${fixed !== 1 ? "s" : ""}`)
      onReload?.()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBulkBusy(false)
    }
  }

  const copyList = async () => {
    if (!filteredInstalled.length) {
      toast?.("Nothing to copy", "warning")
      return
    }
    const text = filteredInstalled
      .map(m => JSON.stringify({
        modId: m.mod_guid,
        name: m.name || details[m.mod_guid]?.name || "",
        version: m.version || "",
      }, null, 2))
      .join(",\n")
    try {
      await navigator.clipboard.writeText(text)
      const n = filteredInstalled.length
      toast?.(`Copied ${n} mod${n !== 1 ? "s" : ""} as JSON`)
    } catch {
      toast?.("Clipboard permission denied", "danger")
    }
  }

  const removeMod = async (guid) => {
    if (removing || instanceId == null) return
    setRemoving(guid)
    try {
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      if (Array.isArray(next?.game?.mods)) {
        next.game.mods = next.game.mods.filter(
          m => (m?.modId || m?.mod_guid) !== guid,
        )
      }
      await apiPut(`/api/servers/${instanceId}/config`, next)
      toast?.(`Removed ${guid}`, "warning")
      onReload?.()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
        <input
          value={instSearch}
          onChange={e => setInstSearch(e.target.value)}
          placeholder="Search installed mods..."
          className="flex-1 min-w-[160px] rounded-lg px-3 py-2 outline-none placeholder:opacity-30"
          style={{
            background: C.bgInput,
            border: `1px solid ${instSearch ? C.accent + "60" : C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        />
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
        >
          {SORTS.map(([s, l]) => (
            <button
              key={s}
              onClick={() => setInstSort(s)}
              className="px-3 py-1.5 font-bold cursor-pointer"
              style={{
                background: instSort === s ? C.accentBg : "transparent",
                color: instSort === s ? C.accent : C.textDim,
                fontSize: sz.nav,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        {detailsLoading && (
          <span className="animate-pulse" style={{ color: C.textMuted, fontSize: sz.stat }}>
            Loading artwork...
          </span>
        )}
        <div className="flex-1" />
        <span style={{ color: C.textMuted, fontSize: sz.stat }}>
          {mods.length} mods
        </span>
        <Btn small v="ghost" onClick={onExport}>Export JSON</Btn>
        <Btn small v="ghost" onClick={copyList}>Copy List</Btn>
        <Btn small v="ghost" onClick={() => importRef.current?.click()}>Import Mods</Btn>
        <input
          ref={importRef}
          type="file"
          style={{ display: "none" }}
          onChange={onImport}
        />
        {mods.length > 0 && (
          <Btn
            small
            v="ghost"
            onClick={refreshNames}
            disabled={bulkBusy}
            title="Refresh mod names from the Workshop (fixes garbled imports)"
          >
            Refresh Names
          </Btn>
        )}
        {mods.length > 0 && (
          <Btn
            small
            v="info"
            onClick={setAllLatest}
            disabled={bulkBusy || pinnedCount === 0}
            title={
              pinnedCount === 0
                ? "All mods already unpinned (server pulls latest on start)"
                : `Unpin ${pinnedCount} mod${pinnedCount !== 1 ? "s" : ""} (server will pull latest on start)`
            }
          >
            Unpin All
          </Btn>
        )}
        {mods.length > 0 && (
          <Btn
            small
            v="info"
            onClick={pinToCurrent}
            disabled={bulkBusy}
            title="Fetch latest version number for each mod from the Workshop and write it to config.json — locks the server to the current versions so updates don't break mid-event"
          >
            Pin to Current
          </Btn>
        )}
        {mods.length > 0 && (
          <ClearAllButton
            instanceId={instanceId}
            count={mods.length}
            onCleared={onReload}
            toast={toast}
          />
        )}
      </div>

      {mods.length === 0 ? (
        <Empty
          title="No mods installed"
          sub="Browse the workshop to add mods to your server"
        />
      ) : filteredInstalled.length === 0 ? (
        <Empty title="No results" sub={`No mods match "${instSearch}"`} />
      ) : (
        <div className="flex-1 overflow-auto">
          <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4"}`}>
            {filteredInstalled.map(m => (
              <InstalledCard
                key={m.mod_guid}
                mod={m}
                detail={details[m.mod_guid]}
                onOpen={() => openFor(m)}
                onRemove={() => removeMod(m.mod_guid)}
                removing={removing === m.mod_guid}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
