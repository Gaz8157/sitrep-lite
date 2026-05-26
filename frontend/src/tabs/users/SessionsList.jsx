import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiDelete, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"

export default function SessionsList({ toast }) {
  const { C, sz } = useT()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const d = await apiGet("/api/users/me/sessions")
      setSessions(d.sessions || [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const revoke = async (sid) => {
    try {
      await apiDelete(`/api/users/me/sessions/${sid}`)
      load()
    } catch (e) { toast?.(e.message, "danger") }
  }
  const revokeAll = async () => {
    try {
      await apiDelete("/api/users/me/sessions")
      load()
    } catch (e) { toast?.(e.message, "danger") }
  }

  if (loading) return <div style={{ color: C.textMuted }}>Loading…</div>
  const fmt = (t) => new Date(t * 1000).toLocaleString()

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "10px 12px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: sz.stat, fontWeight: 700 }}>
                {s.user_agent || "Unknown browser"}
                {s.is_current && <span style={{ color: C.accent, fontWeight: 800, fontSize: 10, marginLeft: 6 }}>· CURRENT</span>}
              </div>
              <div style={{ color: C.textMuted, fontSize: sz.label, marginTop: 2 }}>
                {s.ip || "—"} · last used {fmt(s.last_used_at)} · expires {fmt(s.expires_at)}
              </div>
            </div>
            {!s.is_current && <Btn small v="danger" onClick={() => revoke(s.id)}>Revoke</Btn>}
          </div>
        ))}
      </div>
      {sessions.filter(s => !s.is_current).length > 0 && (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <Btn small v="danger" onClick={revokeAll}>Log out everywhere else</Btn>
        </div>
      )}
    </div>
  )
}
