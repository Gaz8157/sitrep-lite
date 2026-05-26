import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"

export default function CpuAffinitySection({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/servers/${id}/cpu-affinity`)
      setData(d)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const setMode = async (newMode) => {
    if (saving || newMode === data?.mode) return
    setSaving(true)
    try {
      const r = await apiPut(`/api/servers/${id}/cpu-affinity`, { mode: newMode })
      setData(r)
      toast?.(
        newMode === "auto"
          ? "CPU pinning cleared — restart server for it to take effect"
          : `Pinned to ${newMode.toUpperCase()} (${r.cpu_list}) — restart server to apply`,
        "info",
      )
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ color: C.textMuted, padding: 12 }}>Loading CPU topology…</div>
  if (!data) return null

  const topo = data.topology || []
  const single = topo.length <= 1
  const current = data.mode

  const Option = ({ mode, label, sub, disabled }) => {
    const active = current === mode
    return (
      <button
        onClick={() => setMode(mode)}
        disabled={saving || disabled}
        style={{
          flex: 1, padding: "10px 12px", textAlign: "left",
          background: active ? C.accentBg : C.bgInput,
          border: `1px solid ${active ? C.accent + "50" : C.border}`,
          color: active ? C.accent : C.text,
          borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
          fontSize: sz.stat, fontWeight: active ? 800 : 600,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: sz.stat, fontWeight: 800 }}>{label}</div>
        {sub && <div style={{ color: C.textMuted, fontSize: sz.label - 1, fontWeight: 500, marginTop: 2 }}>{sub}</div>}
      </button>
    )
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.textBright, fontSize: sz.base + 1, marginBottom: 6, fontWeight: 800 }}>
        CPU Affinity
      </h3>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 10, lineHeight: 1.4 }}>
        Pin this server to a specific CCD on multi-CCD AMD Ryzen CPUs to reduce cross-CCD latency.
        Change requires a server restart to take effect.
      </div>
      {single ? (
        <div style={{ color: C.textMuted, fontSize: sz.stat, padding: 12, background: C.bgInput, borderRadius: 8, border: `1px solid ${C.border}` }}>
          Single-CCD host detected ({topo[0]?.cpu_list || "all cores"}). No pinning options available.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Option
            mode="auto"
            label="Auto (all cores)"
            sub={`uses all ${topo.reduce((s, t) => s + (t.cpu_count || 0), 0)} CPUs`}
          />
          {topo.map((t, i) => (
            <Option
              key={i}
              mode={`ccd${i}`}
              label={`CCD ${i}`}
              sub={`cores ${t.cpu_list} (${t.cpu_count} CPUs)`}
            />
          ))}
        </div>
      )}
      {data.mode === "custom" && (
        <div style={{ marginTop: 8, padding: 10, background: C.orangeBg, border: `1px solid ${C.orange}40`, color: C.orange, fontSize: sz.label, borderRadius: 8 }}>
          Drop-in has a custom CPUAffinity ({data.cpu_list}) that doesn't match a known CCD. Pick a mode above to overwrite, or edit the file directly.
        </div>
      )}
    </section>
  )
}
