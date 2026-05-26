import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut } from "../../api/index.js"
import { Btn } from "../../components/index.js"

const LEVELS = ["viewer", "moderator", "admin", "head_admin"]

export default function ServerAccessMatrix({ userId, userRole }) {
  const { C, sz } = useT()
  const [servers, setServers] = useState([])
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      apiGet("/api/servers"),
      apiGet(`/api/users/${userId}/access`),
    ]).then(([s, a]) => {
      setServers(s.instances || [])
      const map = {}
      for (const o of (a.overrides || [])) map[o.instance_id] = o.role
      setOverrides(map)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [userId])

  const set = (iid, role) => setOverrides(o => ({ ...o, [iid]: role }))
  const clear = (iid) => setOverrides(o => { const c = { ...o }; delete c[iid]; return c })

  const save = async () => {
    setSaving(true)
    try {
      const payload = Object.entries(overrides).map(([iid, role]) => ({ instance_id: Number(iid), role }))
      await apiPut(`/api/users/${userId}/access`, { overrides: payload })
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ color: C.textMuted }}>Loading servers…</div>
  if (!servers.length) return <div style={{ color: C.textMuted, fontSize: sz.stat }}>No servers provisioned yet.</div>

  return (
    <div>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 10 }}>
        {userRole} users have no server access by default — grant a role per server below.
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}>
        {servers.map((s, i) => {
          const cur = overrides[s.id]
          const noAccess = !cur || cur === "none"
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? `1px solid ${C.border}` : "none", background: C.bgCard, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 140px", minWidth: 140, color: C.text, fontSize: sz.stat }}>{s.display_name || s.name || `#${s.id}`}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <RadioBtn label="no access" active={noAccess} onClick={() => clear(s.id)} variant="danger" />
                {LEVELS.map(l => (
                  <RadioBtn key={l} label={l} active={cur === l} onClick={() => set(s.id, l)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <Btn small onClick={save} disabled={saving}>{saving ? "Saving…" : "Save access"}</Btn>
      </div>
    </div>
  )
}

function RadioBtn({ label, active, onClick, variant = "default" }) {
  const { C } = useT()
  const danger = variant === "danger"
  return (
    <button onClick={onClick} style={{
      padding: "4px 8px", fontSize: 11, fontWeight: 700, borderRadius: 6,
      border: `1px solid ${active ? (danger ? C.red : C.accent) : C.border}`,
      background: active ? (danger ? C.redBg : C.accentBg) : "transparent",
      color: active ? (danger ? C.red : C.accent) : C.textMuted,
      cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.8px",
    }}>{label}</button>
  )
}
