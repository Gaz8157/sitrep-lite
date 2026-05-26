import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"

export default function CpuAffinitySection({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/servers/${id}/cpu-affinity`)
      setData(d)
    } catch (e) {
      if (e instanceof APIError) toast?.(e.message, "danger")
    } finally { setLoading(false) }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color: C.textMuted, padding: 12 }}>Loading CPU info…</div>
  if (!data) return null

  const totalCores = data.topology?.reduce((s, t) => s + (t.cpu_count || 0), 0) || 0

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.textBright, fontSize: sz.base + 1, marginBottom: 6, fontWeight: 800 }}>
        CPU
      </h3>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 12, lineHeight: 1.4 }}>
        {totalCores} logical cores detected. CPU affinity pins the server process to specific cores.
      </div>

      <div
        style={{
          background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 14,
        }}
      >
        <div className="flex justify-between items-baseline mb-2">
          <span style={{ color: C.textDim, fontSize: sz.stat, fontWeight: 700 }}>
            Pinning Mode
          </span>
          <span className="font-mono" style={{ color: C.accent, fontSize: sz.stat, fontWeight: 800 }}>
            {data.mode === "auto" ? "All Cores" : data.cpu_list || data.mode}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={async () => {
              try {
                const r = await apiPut(`/api/servers/${id}/cpu-affinity`, { mode: "auto" })
                setData(r)
                toast?.("CPU pinning cleared — using all cores", "info")
              } catch (e) { toast?.(e instanceof APIError ? e.message : String(e), "danger") }
            }}
            style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
              background: data.mode === "auto" ? C.accentBg : C.bgInput,
              border: `1px solid ${data.mode === "auto" ? C.accent + "50" : C.border}`,
              color: data.mode === "auto" ? C.accent : C.textDim,
              fontSize: sz.stat, fontWeight: 700,
            }}
          >
            All Cores ({totalCores})
          </button>

          {(data.topology || []).map((t, i) => {
            const mode = `ccd${i}`
            const active = data.mode === mode
            return (
              <button
                key={i}
                onClick={async () => {
                  try {
                    const r = await apiPut(`/api/servers/${id}/cpu-affinity`, { mode })
                    setData(r)
                    toast?.(`Pinned to cores ${t.cpu_list} — restart server to apply`, "info")
                  } catch (e) { toast?.(e instanceof APIError ? e.message : String(e), "danger") }
                }}
                style={{
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  background: active ? C.accentBg : C.bgInput,
                  border: `1px solid ${active ? C.accent + "50" : C.border}`,
                  color: active ? C.accent : C.textDim,
                  fontSize: sz.stat, fontWeight: 700,
                }}
              >
                Cores {t.cpu_list} ({t.cpu_count})
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
