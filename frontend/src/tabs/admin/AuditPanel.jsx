import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, APIError } from "../../api/index.js"
import { Btn, Empty } from "../../components/index.js"

// Audit Log panel — ported from v1 Admin.jsx lines 440-456.
// Panel-wide (not per-server). Reads /api/audit, color-codes the action.

export default function AuditPanel({ toast }) {
  const { C, sz } = useT()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(100)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiGet(`/api/audit?limit=${limit}`)
      setEntries(d.entries || [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [limit, toast])

  useEffect(() => { load() }, [load])

  const fmtTs = (t) => t ? new Date(t * 1000).toLocaleString() : "—"

  // Color mapping for common action verbs. Falls through to textDim.
  const colorFor = (action) => {
    if (!action) return C.textDim
    const a = action.toLowerCase()
    if (a.includes("ban") || a.includes("delete") || a.includes("disable")
        || a.includes("fail")) return C.red
    if (a.includes("kick") || a.includes("warn")) return C.orange
    if (a.includes("login") || a.includes("create") || a.includes("enable")
        || a.includes("link") || a.includes("password.reset")) return C.accent
    if (a.includes("config") || a.includes("update") || a.includes("set"))
      return C.blue
    return C.textDim
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-black uppercase tracking-widest"
            style={{ color: C.textBright, fontSize: sz.base + 1, margin: 0 }}>
          Audit Log
          <span className="ml-3 px-2 py-0.5 rounded font-bold"
                style={{ background: C.bgInput, color: C.textDim,
                         fontSize: sz.label, border: `1px solid ${C.border}` }}>
            {entries.length}
          </span>
        </h2>
        <div className="flex-1" />
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
                className="rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                style={{ background: C.bgInput, border: `1px solid ${C.border}`,
                         color: C.text, fontSize: sz.label }}>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
          <option value="250">250 rows</option>
          <option value="500">500 rows</option>
          <option value="1000">1000 rows</option>
        </select>
        <Btn small v="ghost" onClick={load}>Refresh</Btn>
      </div>

      <div style={{ color: C.textMuted, fontSize: sz.label }}>
        All admin and auth actions are recorded here. Stored in the panel
        database; persists across restarts.
      </div>

      {loading ? (
        <Empty title="Loading..." />
      ) : entries.length === 0 ? (
        <Empty title="No actions logged yet"
               sub="Logins, user changes, config saves, and bans appear here" />
      ) : (
        <div className="space-y-1">
          {entries.map((e, i) => {
            const col = colorFor(e.action)
            return (
              <div key={e.id || i}
                   className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
                   style={{ background: C.bgCard,
                            border: `1px solid ${C.border}` }}>
                <span className="font-black px-2 py-0.5 rounded font-mono"
                      style={{ background: col + "10", color: col,
                               fontSize: sz.label,
                               minWidth: 110, textAlign: "center" }}>
                  {e.action || "?"}
                </span>
                <span className="font-bold"
                      style={{ color: C.textBright, fontSize: sz.base,
                               minWidth: 100 }}>
                  {e.actor || "system"}
                </span>
                {e.target && (
                  <span className="font-mono"
                        style={{ color: C.textDim, fontSize: sz.label }}>
                    {e.target}
                  </span>
                )}
                {e.data && (
                  <span className="font-mono truncate flex-1"
                        style={{ color: C.textMuted, fontSize: sz.label }}>
                    {typeof e.data === "string" ? e.data : JSON.stringify(e.data)}
                  </span>
                )}
                {!e.data && <div className="flex-1" />}
                {e.ip && (
                  <span className="font-mono"
                        style={{ color: C.textMuted, fontSize: sz.label }}>
                    {e.ip}
                  </span>
                )}
                <span className="whitespace-nowrap"
                      style={{ color: C.textMuted, fontSize: sz.label }}>
                  {fmtTs(e.ts)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
