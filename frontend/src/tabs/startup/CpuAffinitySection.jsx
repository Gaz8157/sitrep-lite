import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"

export default function CpuAffinitySection({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/servers/${id}/cpu-affinity`)
      setData(d)
      setSelected(new Set(d.pinned_cores || d.all_cores || []))
    } catch (e) {
      if (e instanceof APIError) toast?.(e.message, "danger")
    } finally { setLoading(false) }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const toggle = (core) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(core)) {
        if (next.size > 1) next.delete(core)
      } else {
        next.add(core)
      }
      return next
    })
  }

  const selectAll = () => setSelected(new Set(data?.all_cores || []))
  const dirty = data && JSON.stringify([...selected].sort()) !== JSON.stringify([...(data.pinned_cores || [])].sort())

  const apply = async () => {
    if (saving || !dirty) return
    setSaving(true)
    try {
      const r = await apiPut(`/api/servers/${id}/cpu-affinity`, { cores: [...selected].sort() })
      setData(r)
      setSelected(new Set(r.pinned_cores || r.all_cores || []))
      toast?.(`Pinned to ${selected.size} cores — restart server to apply`, "info")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ color: C.textMuted, padding: 12 }}>Loading CPU info…</div>
  if (!data) return null

  const total = data.total_cores || data.all_cores?.length || 0

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.textBright, fontSize: sz.base + 1, marginBottom: 6, fontWeight: 800 }}>
        CPU Allocation
      </h3>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 12, lineHeight: 1.4 }}>
        Select which cores this server can use. Changes apply after restart.
        <span style={{ color: C.accent, fontWeight: 700 }}> {selected.size}/{total}</span> cores selected.
      </div>

      <div
        style={{
          background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 14,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(total, 8)}, 1fr)`, gap: 6 }}>
          {(data.all_cores || []).map(core => {
            const active = selected.has(core)
            return (
              <button
                key={core}
                onClick={() => toggle(core)}
                style={{
                  padding: "6px 0", borderRadius: 6, cursor: "pointer",
                  background: active ? C.accentBg : "transparent",
                  border: `1px solid ${active ? C.accent + "60" : C.border}`,
                  color: active ? C.accent : C.textMuted,
                  fontSize: sz.stat, fontWeight: active ? 800 : 500,
                  textAlign: "center",
                }}
              >
                {core}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 mt-3">
          <Btn small v="ghost" onClick={selectAll} disabled={selected.size === total}>All</Btn>
          <div className="flex-1" />
          {dirty && <Btn small onClick={apply} disabled={saving}>{saving ? "Applying..." : "Apply"}</Btn>}
        </div>
      </div>
    </section>
  )
}
