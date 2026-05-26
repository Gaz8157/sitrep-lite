import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, APIError } from "../../api/index.js"
import { Bar } from "../../components/index.js"

export default function MemorySection({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const [live, topo] = await Promise.all([
        apiGet(`/api/servers/${id}/memory/live`),
        apiGet(`/api/servers/memory-topology`),
      ])
      setData({ ...live, ...topo })
    } catch (e) {
      if (e instanceof APIError) toast?.(e.message, "danger")
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (id == null) return
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [id, load])

  if (loading && !data) return <div style={{ color: C.textMuted, padding: 12 }}>Loading memory info…</div>
  if (!data) return null

  const totalGB = (data.total_mb || 0) / 1024
  const rssBytes = data.live?.rss_bytes || data.rss_bytes || 0
  const rssGB = rssBytes / 1e9
  const online = data.live?.online || false
  const pct = totalGB > 0 ? (rssGB / totalGB) * 100 : 0

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.textBright, fontSize: sz.base + 1, marginBottom: 6, fontWeight: 800 }}>
        Memory
      </h3>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 12, lineHeight: 1.4 }}>
        System RAM usage by this server instance.
      </div>

      <div
        style={{
          background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 14,
        }}
      >
        <div className="flex justify-between items-baseline mb-2">
          <span style={{ color: C.textDim, fontSize: sz.stat, fontWeight: 700 }}>
            Server RSS
          </span>
          <span className="font-mono" style={{ color: online ? C.textBright : C.textMuted, fontSize: sz.base + 2, fontWeight: 800 }}>
            {online ? `${rssGB.toFixed(2)} GB` : "offline"}
          </span>
        </div>

        <Bar pct={Math.min(100, pct)} color={pct > 90 ? C.red : pct > 70 ? C.orange : C.accent + "60"} />

        <div className="flex justify-between mt-2">
          <span style={{ color: C.textMuted, fontSize: sz.stat }}>
            {online ? `${pct.toFixed(1)}% of system RAM` : "Server not running"}
          </span>
          <span style={{ color: C.textMuted, fontSize: sz.stat }}>
            {totalGB.toFixed(1)} GB total
          </span>
        </div>
      </div>
    </section>
  )
}
