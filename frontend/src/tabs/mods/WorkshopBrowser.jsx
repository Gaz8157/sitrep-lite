import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, APIError } from "../../api/index.js"
import { Btn, Empty } from "../../components/index.js"
import { useMobile } from "../../hooks/index.js"
import { WS_TAGS } from "../../constants.js"
import ModCard from "./ModCard.jsx"

const SORTS = [
  ["downloads", "Popular"],
  ["newest", "Newest"],
  ["popular", "Trending"],
]

function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v
  } catch { return fallback }
}

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : JSON.parse(v)
  } catch { return fallback }
}

function saveLS(key, value) {
  try { localStorage.setItem(key, value) } catch {}
}

export default function WorkshopBrowser({ installedMap, onOpenMod, toast }) {
  const { C, sz } = useT()
  const mobile = useMobile()

  const [dispSearch, setDispSearch] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState(() => loadLS("ws-sort", "downloads"))
  const [page, setPage] = useState(() => {
    const n = parseInt(loadLS("ws-page", "1"), 10)
    return Number.isFinite(n) && n >= 1 ? n : 1
  })
  const [tags, setTags] = useState(() => {
    const v = loadJSON("ws-tags", [])
    return Array.isArray(v) ? v : []
  })

  const cacheKey = useMemo(
    () => `ws-search:${search}:${page}:${sort}:${tags.join(",")}`,
    [search, page, sort, tags],
  )
  const [wsData, setWsData] = useState(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  const [wsLoading, setWsLoading] = useState(false)
  const [wsError, setWsError] = useState(null)

  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualId, setManualId] = useState("")

  const debRef = useRef(null)
  useEffect(() => () => clearTimeout(debRef.current), [])

  useEffect(() => { saveLS("ws-page", String(page)) }, [page])
  useEffect(() => { saveLS("ws-sort", sort) }, [sort])
  useEffect(() => {
    try { localStorage.setItem("ws-tags", JSON.stringify(tags)) } catch {}
  }, [tags])

  useEffect(() => {
    let aborted = false
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) setWsData(JSON.parse(raw))
    } catch {}
    setWsLoading(true)
    setWsError(null)
    const params = new URLSearchParams({ page: String(page), sort })
    if (search) params.set("q", search)
    if (tags.length) params.set("tags", tags.join(","))
    apiGet(`/api/workshop/search?${params}`)
      .then(d => {
        if (aborted) return
        setWsData(d)
        try { sessionStorage.setItem(cacheKey, JSON.stringify(d)) } catch {}
      })
      .catch(e => {
        if (!aborted) setWsError(e)
      })
      .finally(() => { if (!aborted) setWsLoading(false) })
    return () => { aborted = true }
  }, [cacheKey, search, page, sort, tags])

  const handleSearch = useCallback((v) => {
    setDispSearch(v)
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      setSearch(v)
      setPage(1)
    }, 500)
  }, [])

  const toggleTag = useCallback((t) => {
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
    setPage(1)
  }, [])

  const displayedMods = useMemo(() => {
    if (!wsData?.mods) return []
    if (!tags.length || wsData.from_index) return wsData.mods
    return wsData.mods.filter(m =>
      (m.tags || []).some(t =>
        tags.some(tag =>
          t.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(t.toLowerCase()),
        ),
      ),
    )
  }, [wsData, tags])

  const lookupById = () => {
    const id = manualId.trim().replace(/[{}]/g, "").toUpperCase()
    if (!id || !/^[0-9A-F]{16}$/.test(id)) {
      toast?.("Enter a 16-char hex mod ID", "danger")
      return
    }
    setShowManualAdd(false)
    setManualId("")
    onOpenMod?.({
      id,
      name: id,
      version: "",
      image: null,
      author: "",
      rating: 0,
      ratingCount: 0,
      subscribers: 0,
      tags: [],
      summary: "",
    })
  }

  const buildIndex = async () => {
    try {
      await apiPost("/api/workshop/index/build")
      toast?.("Index build started", "info")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const cardClickHandlers = useMemo(() => {
    const map = new Map()
    return (mod) => {
      let h = map.get(mod.id)
      if (!h) {
        h = () => onOpenMod?.(mod)
        map.set(mod.id, h)
      }
      return h
    }
  }, [onOpenMod])

  const totalPages = wsData?.pages || 1

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`flex mb-3 items-center ${mobile ? "flex-col gap-2" : "flex-wrap gap-2"}`}>
        <input
          value={dispSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search 34,000+ mods..."
          className="flex-1 min-w-[180px] rounded-lg px-3 py-2 outline-none placeholder:opacity-30"
          style={{
            background: C.bgInput,
            border: `1px solid ${dispSearch ? C.accent + "60" : C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        />
        <div
          className={`flex rounded-lg overflow-hidden ${mobile ? "w-full" : ""}`}
          style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
        >
          {SORTS.map(([s, l]) => (
            <button
              key={s}
              onClick={() => { setSort(s); setPage(1) }}
              className={`px-3 py-1.5 font-bold cursor-pointer ${mobile ? "flex-1" : ""}`}
              style={{
                background: sort === s ? C.accentBg : "transparent",
                color: sort === s ? C.accent : C.textDim,
                fontSize: sz.nav,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        {showManualAdd ? (
          <div className="flex gap-2 items-center">
            <input
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupById()}
              placeholder="Paste mod ID..."
              autoFocus
              className={`rounded-lg px-3 py-2 outline-none font-mono placeholder:opacity-30 ${mobile ? "flex-1" : "w-52"}`}
              style={{
                background: C.bgInput,
                border: `1px solid ${C.accent + "60"}`,
                color: C.text,
                fontSize: sz.input,
              }}
            />
            <Btn small onClick={lookupById}>Lookup</Btn>
            <Btn small v="ghost" onClick={() => { setShowManualAdd(false); setManualId("") }}>X</Btn>
          </div>
        ) : (
          <Btn small v="ghost" onClick={() => setShowManualAdd(true)}>+ Add by ID</Btn>
        )}
      </div>

      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        {WS_TAGS.map(t => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className="px-2.5 py-1 rounded-full font-bold cursor-pointer"
            style={{
              background: tags.includes(t) ? C.accentBg : "transparent",
              color: tags.includes(t) ? C.accent : C.textMuted,
              border: `1px solid ${tags.includes(t) ? C.accent + "50" : C.border}`,
              fontSize: sz.stat,
            }}
          >
            {t}
          </button>
        ))}
        {tags.length > 0 && (
          <button
            onClick={() => { setTags([]); setPage(1) }}
            className="px-2.5 py-1 rounded-full font-bold cursor-pointer"
            style={{
              background: "transparent",
              color: C.textDim,
              border: `1px solid ${C.border}`,
              fontSize: sz.stat,
            }}
          >
            X Clear
          </button>
        )}
        <div className="flex-1" />
        {tags.length > 0 && wsData?.index_status === "building" && (
          <span className="animate-pulse" style={{ color: C.textMuted, fontSize: sz.stat }}>
            Building index...
          </span>
        )}
        {tags.length > 0 && wsData?.index_status === "idle" && (
          <button
            onClick={buildIndex}
            className="px-2.5 py-1 rounded-full font-bold cursor-pointer"
            style={{
              background: C.accentBg,
              color: C.accent,
              border: `1px solid ${C.accent}50`,
              fontSize: sz.stat,
            }}
          >
            Build Index
          </button>
        )}
        {tags.length > 0 && wsData?.from_index && (
          <span style={{ color: C.textMuted, fontSize: sz.stat }}>
            {(wsData.index_count || 0).toLocaleString()} mods indexed
          </span>
        )}
      </div>

      {wsLoading && !wsData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse mb-2" style={{ color: C.textDim, fontSize: sz.base + 2 }}>
              Loading workshop...
            </div>
            <div style={{ color: C.textMuted, fontSize: sz.stat }}>
              Fetching from Bohemia servers
            </div>
          </div>
        </div>
      ) : wsError || wsData?.error ? (
        <Empty title="Workshop unavailable" sub={wsError?.message || wsData?.error} />
      ) : (
        <div className="flex-1 overflow-auto">
          {wsData && (
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                {(wsData.total || 0).toLocaleString()} mods
                {tags.length && wsData.from_index ? " (tag filtered)" : ""}
              </span>
              <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                Page {page} of {(totalPages || 0).toLocaleString()}
              </span>
            </div>
          )}
          <div className={`grid gap-3 mb-3 ${mobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4"}`}>
            {displayedMods.map(mod => (
              <ModCard
                key={mod.id}
                mod={mod}
                installed={installedMap.has(mod.id)}
                onClick={cardClickHandlers(mod)}
              />
            ))}
          </div>
          {wsData && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Btn small v="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                Prev
              </Btn>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`${mobile ? "w-10 h-10" : "w-8 h-8"} rounded-lg font-bold cursor-pointer`}
                      style={{
                        background: p === page ? C.accentBg : "transparent",
                        color: p === page ? C.accent : C.textDim,
                        border: `1px solid ${p === page ? C.accent + "30" : C.border}`,
                        fontSize: sz.stat,
                      }}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
              <Btn
                small
                v="ghost"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
