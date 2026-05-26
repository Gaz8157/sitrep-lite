import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn, Bar } from "../../components/index.js"

export default function MemorySection({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const [data, setData] = useState(null)
  const [budgetGB, setBudgetGB] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const live = await apiGet(`/api/servers/${id}/memory/live`)
      setData(live)
      if (budgetGB === "" && live.budget_mb) {
        setBudgetGB((live.budget_mb / 1024).toFixed(1))
      }
    } catch (e) {
      if (e instanceof APIError) toast?.(e.message, "danger")
    } finally { setLoading(false) }
  }, [id, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (id == null) return
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [id, load])

  const save = async () => {
    const mb = Math.round(parseFloat(budgetGB) * 1024)
    if (isNaN(mb) || mb < 0) { toast?.("Invalid budget", "danger"); return }
    setSaving(true)
    try {
      await apiPut(`/api/servers/${id}/memory`, { budget_mb: mb, ceiling_mb: mb })
      toast?.(`Memory budget set to ${budgetGB} GB`)
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSaving(false) }
  }

  if (loading && !data) return <div style={{ color: C.textMuted, padding: 12 }}>Loading memory info…</div>
  if (!data) return null

  const totalGB = (data.total_mb || 0) / 1024
  const rssBytes = data.live?.rss_bytes || data.rss_bytes || 0
  const rssGB = rssBytes / 1e9
  const online = data.live?.online || false
  const budgetMB = data.budget_mb || 0
  const budgetGBVal = budgetMB / 1024
  const pct = budgetGBVal > 0 ? (rssGB / budgetGBVal) * 100 : 0

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.textBright, fontSize: sz.base + 1, marginBottom: 6, fontWeight: 800 }}>
        Memory Allocation
      </h3>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 12, lineHeight: 1.4 }}>
        Set a memory budget for this instance. System has <span style={{ color: C.accent, fontWeight: 700 }}>{totalGB.toFixed(1)} GB</span> total.
      </div>

      <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
        <div className="flex justify-between items-baseline mb-2">
          <span style={{ color: C.textDim, fontSize: sz.stat, fontWeight: 700 }}>Instance RSS</span>
          <span className="font-mono" style={{ color: online ? C.textBright : C.textMuted, fontSize: sz.base + 2, fontWeight: 800 }}>
            {online ? `${rssGB.toFixed(2)} GB` : "offline"}
          </span>
        </div>

        {budgetGBVal > 0 && (
          <>
            <Bar pct={Math.min(100, pct)} color={pct > 90 ? C.red : pct > 70 ? C.orange : C.accent + "60"} />
            <div className="flex justify-between mt-1 mb-3">
              <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                {online ? `${pct.toFixed(1)}% of budget` : ""}
              </span>
              <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                {budgetGBVal.toFixed(1)} GB budget
              </span>
            </div>
          </>
        )}

        <div className="flex gap-2 items-center mt-2">
          <span style={{ color: C.textDim, fontSize: sz.stat, fontWeight: 700, whiteSpace: "nowrap" }}>Budget (GB)</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max={totalGB.toFixed(0)}
            value={budgetGB}
            onChange={e => setBudgetGB(e.target.value)}
            className="rounded-lg px-3 py-1.5 outline-none font-mono"
            style={{
              background: C.bg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: sz.input, width: 100,
            }}
          />
          <span style={{ color: C.textMuted, fontSize: sz.stat }}>of {totalGB.toFixed(1)} GB</span>
          <div className="flex-1" />
          <Btn small onClick={save} disabled={saving}>{saving ? "Saving..." : "Set"}</Btn>
        </div>
      </div>
    </section>
  )
}
