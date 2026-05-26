import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, apiDelete, APIError } from "../../api/index.js"

function fmtGB(bytes) {
  if (bytes == null) return "—"
  return (bytes / 1e9).toFixed(2) + " GB"
}

function fmtMB(mb) {
  if (mb == null) return "—"
  return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : mb + " MB"
}

const PRESET_LABEL = {
  production: "Production",
  test: "Test",
  custom: "Custom",
}

const PRESET_HINT = {
  production: "Headroom = 25% of budget (2–6 GB clamp), ceiling = budget × 1.5, watcher raises only (never restarts), OOM score −200",
  test: "Headroom = 25% of budget (2–6 GB clamp), ceiling = budget × 1.5, watcher may restart on sustained pressure, OOM score +500",
  custom: "Manual control of all knobs",
}

// Headroom scales as 25% of budget, clamped to [2 GB, 6 GB]. Mirrors
// _default_headroom_mb in agent/ops/memory.py — both ends must agree.
function defaultHeadroomGB(budgetGB) {
  const h = budgetGB * 0.25
  return Math.max(2, Math.min(6, h))
}

export default function MemorySection({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const [data, setData] = useState(null)
  const [topology, setTopology] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [preset, setPreset] = useState("production")
  const [budgetGB, setBudgetGB] = useState("12")
  const [headroomGB, setHeadroomGB] = useState("4")
  const [ceilingGB, setCeilingGB] = useState("36")
  const [watcherEnabled, setWatcherEnabled] = useState(true)
  const [autoRaise, setAutoRaise] = useState(true)
  const [oomAdj, setOomAdj] = useState("-200")

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const [d, topo] = await Promise.all([
        apiGet(`/api/servers/${id}/memory`),
        apiGet(`/api/servers/memory-topology`),
      ])
      setData(d)
      setTopology(topo)
      const s = d?.state
      if (s) {
        setPreset(s.preset || "custom")
        setBudgetGB((s.budget_mb / 1024).toFixed(1))
        setHeadroomGB((s.headroom_mb / 1024).toFixed(1))
        setCeilingGB((s.ceiling_mb / 1024).toFixed(1))
        setWatcherEnabled(!!s.watcher_enabled)
        setAutoRaise(!!s.auto_raise_max)
        setOomAdj(String(s.oom_score_adjust))
      }
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  // Poll live RSS every 5s while this section is open.
  const [live, setLive] = useState(null)
  useEffect(() => {
    if (id == null) return
    let cancelled = false
    const poll = async () => {
      try {
        const r = await apiGet(`/api/servers/${id}/memory/live`)
        if (!cancelled) setLive(r)
      } catch {}
    }
    poll()
    const iv = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [id])

  const applyPreset = (p) => {
    setPreset(p)
    const b = parseFloat(budgetGB || (p === "production" ? "20" : "8"))
    if (p === "production") {
      setHeadroomGB(defaultHeadroomGB(b).toFixed(1))
      setCeilingGB((b * 1.5).toFixed(1))
      setOomAdj("-200")
      setWatcherEnabled(true); setAutoRaise(true)
    } else if (p === "test") {
      setHeadroomGB(defaultHeadroomGB(b).toFixed(1))
      setCeilingGB((b * 1.5).toFixed(1))
      setOomAdj("500")
      setWatcherEnabled(true); setAutoRaise(true)
    }
  }

  const save = async () => {
    if (saving) return
    const budget = Math.round(parseFloat(budgetGB) * 1024)
    const headroom = Math.round(parseFloat(headroomGB) * 1024)
    const ceiling = Math.round(parseFloat(ceilingGB) * 1024)
    const oom = parseInt(oomAdj, 10)
    if (!(budget >= 512)) { toast?.("Budget must be ≥ 0.5 GB", "danger"); return }
    if (!(headroom >= 0)) { toast?.("Headroom must be ≥ 0", "danger"); return }
    if (!(ceiling >= budget + headroom)) {
      toast?.("Ceiling must be ≥ budget + headroom", "danger"); return
    }
    if (!(oom >= -1000 && oom <= 1000)) {
      toast?.("OOM score adjust must be in [-1000, 1000]", "danger"); return
    }
    setSaving(true)
    try {
      const r = await apiPut(`/api/servers/${id}/memory`, {
        preset, budget_mb: budget, headroom_mb: headroom, ceiling_mb: ceiling,
        oom_score_adjust: oom, watcher_enabled: watcherEnabled,
        auto_raise_max: autoRaise,
      })
      setData(r)
      toast?.(`Memory configured — budget ${fmtMB(budget)}, ceiling ${fmtMB(ceiling)}`, "info")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSaving(false) }
  }

  const clearConfig = async () => {
    if (saving) return
    setSaving(true)
    try {
      const r = await apiDelete(`/api/servers/${id}/memory`)
      setData(r)
      toast?.("Memory cap removed — server is uncapped", "warning")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ color: C.textMuted, padding: 12 }}>Loading memory state…</div>

  const configured = data?.configured
  const liveLive = live?.live || data?.live || {}
  const rss = liveLive.rss_bytes
  const high = liveLive.high_bytes
  const max = liveLive.max_bytes
  const pressureFull = liveLive.pressure?.full?.avg60 ?? 0
  const eventsHigh = liveLive.events?.high ?? 0
  const eventsMax = liveLive.events?.max ?? 0
  const budgetMB = data?.state?.budget_mb
  const ceilingMB = data?.state?.ceiling_mb
  const pctOfBudget = (rss != null && budgetMB) ? (rss / (budgetMB * 1024 * 1024) * 100) : null
  const pctOfCeiling = (rss != null && ceilingMB) ? (rss / (ceilingMB * 1024 * 1024) * 100) : null

  const Bar = ({ pct, color }) => (
    <div style={{ position: "relative", height: 12, background: C.bgInput, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${Math.max(0, Math.min(100, pct || 0))}%`,
        background: color, transition: "width 300ms ease",
      }} />
    </div>
  )

  const liveColor = pctOfCeiling > 90 ? C.red : pctOfBudget > 100 ? C.orange : pctOfBudget > 80 ? C.yellow : C.green

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.textBright, fontSize: sz.base + 1, marginBottom: 6, fontWeight: 800 }}>
        Memory
      </h3>
      <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 12, lineHeight: 1.4 }}>
        Per-server RAM budget enforced via systemd cgroup v2. Soft cap reclaims gently;
        hard cap (with headroom) is the kernel's last-resort kill. The watcher service
        dynamically raises the hard cap up to the ceiling — the process keeps running.
      </div>

      {/* Live snapshot */}
      <div style={{
        background: C.bgInput, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 12, marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ color: C.textDim, fontWeight: 700, fontSize: sz.label }}>LIVE RSS</span>
          <span style={{ color: liveColor, fontWeight: 800, fontSize: sz.base + 1, fontFamily: "monospace" }}>
            {fmtGB(rss)}
          </span>
        </div>
        {configured ? (
          <>
            <Bar pct={pctOfCeiling} color={liveColor} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: C.textMuted, fontSize: sz.stat }}>
              <span>budget {fmtMB(budgetMB)} ({pctOfBudget?.toFixed(0)}%)</span>
              <span>high {fmtGB(high)}</span>
              <span>max {fmtGB(max)}</span>
              <span>ceiling {fmtMB(ceilingMB)} ({pctOfCeiling?.toFixed(0)}%)</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6, color: C.textMuted, fontSize: sz.stat }}>
              <span>PSI full avg60: <b style={{ color: pressureFull > 10 ? C.orange : C.textBright }}>{pressureFull.toFixed(1)}%</b></span>
              <span>events.high: <b style={{ color: C.textBright }}>{eventsHigh}</b></span>
              <span>events.max: <b style={{ color: eventsMax > 0 ? C.red : C.textBright }}>{eventsMax}</b></span>
            </div>
          </>
        ) : (
          <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 4 }}>
            No cap configured — uncapped (current default behavior)
            {rss != null && <> · current usage {fmtGB(rss)}</>}
          </div>
        )}
      </div>

      {/* Config form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: C.textDim, fontSize: sz.label, fontWeight: 700 }}>Preset</label>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {["production", "test", "custom"].map(p => (
              <button key={p} onClick={() => applyPreset(p)} disabled={saving}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8,
                  background: preset === p ? C.accentBg : C.bgInput,
                  border: `1px solid ${preset === p ? C.accent + "50" : C.border}`,
                  color: preset === p ? C.accent : C.text,
                  fontWeight: preset === p ? 800 : 600, fontSize: sz.stat,
                  cursor: saving ? "not-allowed" : "pointer",
                }}>
                {PRESET_LABEL[p]}
              </button>
            ))}
          </div>
          <div style={{ color: C.textMuted, fontSize: sz.label - 1, marginTop: 4, lineHeight: 1.4 }}>
            {PRESET_HINT[preset]}
          </div>
        </div>

        <div>
          <label style={{ color: C.textDim, fontSize: sz.label, fontWeight: 700 }}>OOM Score Adjust</label>
          <input type="number" value={oomAdj} onChange={e => setOomAdj(e.target.value)}
            style={{
              width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8,
              background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
              fontSize: sz.stat,
            }} />
          <div style={{ color: C.textMuted, fontSize: sz.label - 1, marginTop: 4 }}>
            −1000 = kernel never kills this · +1000 = kernel always picks this first
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: C.textDim, fontSize: sz.label, fontWeight: 700 }}>Budget (GB)</label>
          <input type="number" step="0.5" value={budgetGB} onChange={e => setBudgetGB(e.target.value)}
            style={{
              width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8,
              background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
              fontSize: sz.stat,
            }} />
          <div style={{ color: C.textMuted, fontSize: sz.label - 1, marginTop: 4 }}>
            soft cap (MemoryHigh) — kernel reclaims above this
          </div>
        </div>

        <div>
          <label style={{ color: C.textDim, fontSize: sz.label, fontWeight: 700 }}>Headroom (GB)</label>
          <input type="number" step="0.5" value={headroomGB} onChange={e => setHeadroomGB(e.target.value)}
            style={{
              width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8,
              background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
              fontSize: sz.stat,
            }} />
          <div style={{ color: C.textMuted, fontSize: sz.label - 1, marginTop: 4 }}>
            initial burst room (MemoryMax = budget + headroom)
          </div>
        </div>

        <div>
          <label style={{ color: C.textDim, fontSize: sz.label, fontWeight: 700 }}>Ceiling (GB)</label>
          <input type="number" step="0.5" value={ceilingGB} onChange={e => setCeilingGB(e.target.value)}
            style={{
              width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8,
              background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
              fontSize: sz.stat,
            }} />
          <div style={{ color: C.textMuted, fontSize: sz.label - 1, marginTop: 4 }}>
            absolute max — watcher will not raise MemoryMax above this
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: sz.stat, color: C.text, cursor: "pointer" }}>
          <input type="checkbox" checked={watcherEnabled} onChange={e => setWatcherEnabled(e.target.checked)} />
          Watcher enabled
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: sz.stat, color: C.text, cursor: "pointer" }}>
          <input type="checkbox" checked={autoRaise} onChange={e => setAutoRaise(e.target.checked)} disabled={!watcherEnabled} />
          Auto-raise MemoryMax when approaching cap
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={saving}
          style={{
            padding: "10px 16px", borderRadius: 8, fontWeight: 800, fontSize: sz.base,
            background: C.accent, color: C.bg, border: "none",
            cursor: saving ? "not-allowed" : "pointer",
          }}>
          {saving ? "Saving…" : configured ? "Update Configuration" : "Apply Configuration"}
        </button>
        {configured && (
          <button onClick={clearConfig} disabled={saving}
            style={{
              padding: "10px 16px", borderRadius: 8, fontWeight: 700, fontSize: sz.base,
              background: "transparent", color: C.red, border: `1px solid ${C.red}40`,
              cursor: saving ? "not-allowed" : "pointer",
            }}>
            Remove cap (back to uncapped)
          </button>
        )}
      </div>

      {topology?.total_bytes != null && (
        <div style={{ marginTop: 16, padding: 10, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMuted, fontSize: sz.label }}>
          Host RAM: {fmtGB(topology.total_bytes)} total · {fmtGB(topology.available_bytes)} available
        </div>
      )}
    </section>
  )
}
