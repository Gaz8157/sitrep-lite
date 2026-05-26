import { useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiPost, APIError } from "../../api/index.js"
import { useFetch, useHistory, useMobile } from "../../hooks/index.js"
import { Card, FloatingPanel, StatBox } from "../../components/index.js"
import { ServerActionBar } from "./ServerActionBar.jsx"
import { ResetModal } from "./ResetModal.jsx"
import { RestartModal } from "./RestartModal.jsx"
import { StatRow } from "./StatRow.jsx"
import { PerfChart } from "./PerfChart.jsx"
import { BandwidthChart } from "./BandwidthChart.jsx"
import { StorageCard } from "./StorageCard.jsx"
import { PlayersPanel } from "./PlayersPanel.jsx"
import { ConsolePanel } from "./ConsolePanel.jsx"
import { DiagnosticsBanner } from "./DiagnosticsBanner.jsx"
import { MemHealth } from "./MemHealth.jsx"
import { useFloatingPanels } from "./floatingPanelsHook.js"

// Labels used in the "Hidden:" pill bar at the top of the dashboard
// when the operator has X'd a panel.
const PANEL_LABELS = {
  "stat-uptime": "Uptime",
  "stat-cpu": "Server CPU",
  "stat-gpu": "Host GPU",
  "stat-ram": "RAM",
  perf: "Performance",
  bw: "Host Bandwidth",
  storage: "Storage",
  players: "Players",
  console: "Console",
}

export default function Dashboard({ instance, toast, authUser }) {
  const isOwner = authUser?.role === "owner"
  const { C, sz } = useT()
  const mobile = useMobile()
  const id = instance?.id ?? instance?.instance_id
  const haveId = id != null

  // Polling endpoints — short cadences match the panel's responsiveness target.
  const { data: status, refetch: refetchStatus } = useFetch(
    haveId ? `/api/servers/${id}/status` : null, 3000,
  )
  const { data: metrics } = useFetch("/api/system/metrics", 3000)
  // Per-server memory live snapshot — feeds the RAM stat tile so it shows
  // THIS server's RSS instead of the host pool.
  const { data: serverMem } = useFetch(
    haveId ? `/api/servers/${id}/memory/live` : null, 5000,
  )
  // Per-server process CPU/affinity — feeds the CPU stat tile so it shows
  // THIS Reforger process, not the entire host.
  const { data: procStats } = useFetch(
    haveId ? `/api/servers/${id}/process-stats` : null, 3000,
  )
  const { data: logData } = useFetch(
    haveId ? `/api/servers/${id}/logs?lines=500` : null, 4000,
  )
  const { data: playersData, lastUpdated: playersUpdatedAt } = useFetch(
    haveId ? `/api/servers/${id}/players` : null, 5000,
  )

  // Rolling history buffers feed the area charts. We append on every
  // /metrics tick so the chart smoothly slides.
  const { history: cpuHist, push: pushCpu } = useHistory(40)
  const { history: netHist, push: pushNet } = useHistory(40)
  useEffect(() => {
    if (!metrics) return
    // CPU line: % of THIS server's physical-core pin (0-100 chart axis).
    // psutil cpu_percent / 100 = cores used; /physCores * 100 = % of pin.
    // Falls back to host CPU when the process isn't running yet.
    const threads = procStats?.affinity?.length || procStats?.total_logical_cpus || 1
    const physCores = Math.max(1, Math.round(threads / 2))
    const coresUsed = procStats?.cpu_percent != null ? procStats.cpu_percent / 100 : null
    const serverCpu = coresUsed != null
      ? Math.min(100, (coresUsed / physCores) * 100)
      : (metrics.cpu?.usage ?? 0)
    pushCpu({ cpu: serverCpu, gpu: metrics.gpu?.usage ?? 0 })
    pushNet({
      up: metrics.network_rate?.up_mbps ?? 0,
      down: metrics.network_rate?.down_mbps ?? 0,
    })
  }, [metrics, procStats, pushCpu, pushNet])

  const chartData = useMemo(
    () => cpuHist.map((h, i) => ({
      i,
      cpu: h.cpu,
      gpu: h.gpu,
      up: netHist[i]?.up ?? 0,
      down: netHist[i]?.down ?? 0,
    })),
    [cpuHist, netHist],
  )

  const { floating, hidden, detach, dock, hide, show } = useFloatingPanels("dash")

  // On mobile, floating panels make no sense — re-dock everything.
  useEffect(() => {
    if (mobile && Object.keys(floating).length > 0) {
      Object.keys(floating).forEach(id => dock(id))
    }
  }, [mobile, floating, dock])

  // Server action wrapping — a single in-flight flag prevents double-clicks.
  const [acting, setActing] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [restartOpen, setRestartOpen] = useState(false)
  const act = async (path, label) => {
    if (acting) return
    setActing(true)
    toast?.(`${label}...`, "warning")
    try {
      await apiPost(`/api/servers/${id}/${path}`)
      toast?.(`${label} done`)
    } catch (e) {
      const msg = e instanceof APIError ? e.message : String(e)
      toast?.(msg, "danger")
    } finally {
      setActing(false)
      refetchStatus?.()
    }
  }

  if (!haveId) {
    return (
      <div style={{ padding: 24, color: C.textDim, fontSize: sz.base }}>
        No instance selected.
      </div>
    )
  }

  const gpuAvailable = !!metrics?.gpu?.available
  const hiddenIds = Object.keys(hidden)

  const serverRunning = status?.state === "active"

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Diagnostics banner — surfaces script-module / mission-load failures */}
      <DiagnosticsBanner instanceId={id} serverRunning={serverRunning} />

      {/* Hidden-panel restore bar */}
      {hiddenIds.length > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg"
          style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
        >
          <span
            className="font-bold uppercase tracking-widest shrink-0"
            style={{ color: C.textMuted, fontSize: sz.stat }}
          >
            Hidden:
          </span>
          {hiddenIds.map(hid => (
            <button
              key={hid}
              onClick={() => show(hid)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold cursor-pointer"
              style={{
                background: C.accentBg, color: C.accent,
                border: `1px solid ${C.accent}30`, fontSize: sz.stat,
              }}
            >
              {PANEL_LABELS[hid] || hid}
              <span style={{ opacity: 0.6, fontSize: 10 }}>↩</span>
            </button>
          ))}
        </div>
      )}

      {/* Floating-panel overlays */}
      {floating.perf && (
        <FloatingPanel title="Performance" onDock={() => dock("perf")} defaultPos={floating.perf}>
          <div className="p-4">
            <PerfChart data={chartData} latest={metrics} procStats={procStats} gpuAvailable={gpuAvailable} />
          </div>
        </FloatingPanel>
      )}
      {floating.bw && (
        <FloatingPanel title="Bandwidth" onDock={() => dock("bw")} defaultPos={floating.bw}>
          <div className="p-4">
            <BandwidthChart data={chartData} latest={metrics} />
          </div>
        </FloatingPanel>
      )}
      {floating.storage && (
        <FloatingPanel title="Storage" onDock={() => dock("storage")} defaultPos={floating.storage}>
          <div className="p-4">
            <StorageCard instanceId={id} />
          </div>
        </FloatingPanel>
      )}
      {floating.players && (
        <FloatingPanel title="Players" onDock={() => dock("players")} defaultPos={floating.players}>
          <div className="p-2">
            <PlayersPanel
              data={playersData}
              maxPlayers={status?.max_players}
              lastUpdated={playersUpdatedAt}
              serverRunning={serverRunning}
            />
          </div>
        </FloatingPanel>
      )}
      {floating.console && (
        <FloatingPanel title="Console" onDock={() => dock("console")} defaultPos={floating.console}>
          <div className="p-2" style={{ height: "100%" }}>
            <ConsolePanel data={logData} />
          </div>
        </FloatingPanel>
      )}
      {/* Floating stat boxes — each renders independently */}
      {["stat-uptime", "stat-cpu", "stat-gpu", "stat-ram"].map(sid => {
        if (!floating[sid]) return null
        const label = PANEL_LABELS[sid]
        return (
          <FloatingPanel key={sid} title={label} onDock={() => dock(sid)} defaultPos={floating[sid]}>
            <div className="p-4">
              <FloatingStat id={sid} status={status} metrics={metrics} serverMem={serverMem} procStats={procStats} isOwner={isOwner} />
            </div>
          </FloatingPanel>
        )
      })}

      <ServerActionBar
        status={status}
        players={playersData}
        acting={acting}
        resetting={resetOpen}
        onStart={() => act("start", "Starting")}
        onStop={() => act("stop", "Stopping")}
        onRestart={() => setRestartOpen(true)}
        onReset={() => setResetOpen(true)}
      />

      <StatRow
        status={status}
        metrics={metrics}
        serverMem={serverMem}
        procStats={procStats}
        isOwner={isOwner}
        floating={floating}
        hidden={hidden}
        onFloat={detach}
        onHide={hide}
      />

      <div className={`flex-1 flex ${mobile ? "flex-col" : "flex-row"} gap-3 min-h-0`}>
        <div className={`${mobile ? "w-full" : "w-[380px]"} shrink-0 flex flex-col gap-3`}>
          {!floating.perf && !hidden.perf && (
            <PerfChart
              data={chartData}
              latest={metrics}
              procStats={procStats}
              gpuAvailable={gpuAvailable}
              onFloat={() => detach("perf")}
              onHide={() => hide("perf")}
            />
          )}
          {!floating.bw && !hidden.bw && (
            <BandwidthChart
              data={chartData}
              latest={metrics}
              onFloat={() => detach("bw")}
              onHide={() => hide("bw")}
            />
          )}
          {!floating.storage && !hidden.storage && (
            <StorageCard
              instanceId={id}
              onFloat={() => detach("storage")}
              onHide={() => hide("storage")}
            />
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {!floating.players && !hidden.players && (
            <PlayersPanel
              data={playersData}
              maxPlayers={status?.max_players}
              lastUpdated={playersUpdatedAt}
              serverRunning={serverRunning}
              onFloat={() => detach("players")}
              onHide={() => hide("players")}
            />
          )}
          {!floating.console && !hidden.console && (
            <ConsolePanel
              data={logData}
              onFloat={() => detach("console")}
              onHide={() => hide("console")}
            />
          )}
        </div>
      </div>

      <ResetModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        instanceId={id}
        onComplete={refetchStatus}
        toast={toast}
      />

      <RestartModal
        open={restartOpen}
        onClose={() => setRestartOpen(false)}
        onConfirm={() => act("restart", "Restarting")}
        instanceId={id}
        instanceName={status?.display_name || status?.name}
      />
    </div>
  )
}

// Floating variant of the four StatBoxes — keeps the layout self-contained
// when popped out (no float/hide buttons, just the data).
function FloatingStat({ id, status, metrics, serverMem, procStats, isOwner }) {
  const active = status?.state === "active"
  if (id === "stat-uptime") {
    const sec = status?.uptime_sec
    return (
      <StatBox
        label="Uptime"
        value={active ? fmtUptime(sec) || "—" : "---"}
        sub={active ? "online" : "offline"}
        warn={!active}
      />
    )
  }
  if (id === "stat-cpu") {
    const hostCpu = metrics?.cpu
    const procRaw = procStats?.cpu_percent
    const threadCount = procStats?.affinity?.length || procStats?.total_logical_cpus || 1
    const physCores = Math.max(1, Math.round(threadCount / 2))
    const coresUsed = procRaw != null ? procRaw / 100 : null
    const procPctOfPhys = coresUsed != null
      ? Math.min(100, (coresUsed / physCores) * 100) : null
    return (
      <StatBox
        label="Server CPU"
        value={
          procPctOfPhys != null
            ? `${procPctOfPhys.toFixed(0)}%`
            : (hostCpu ? `${hostCpu.usage}%` : "--")
        }
        sub={
          procStats?.running
            ? `${coresUsed.toFixed(1)} of ${physCores} cores · host ${hostCpu?.usage ?? "?"}%${hostCpu?.temp ? ` · ${hostCpu.temp}°C` : ""}`
            : (hostCpu?.temp ? `host · ${hostCpu.temp}°C` : "host")
        }
        warn={(procPctOfPhys ?? 0) > 85}
      />
    )
  }
  if (id === "stat-gpu") {
    const gpu = metrics?.gpu
    if (!gpu?.available) return <StatBox label="Host GPU" value="--" sub="not available" />
    return (
      <StatBox
        label="Host GPU"
        value={`${gpu.usage}%`}
        sub={`host-wide · ${gpu.temp}°C · ${gpu.vram_used}/${gpu.vram_total}G VRAM`}
        warn={gpu.temp > 80}
      />
    )
  }
  if (id === "stat-ram") {
    const liveMem = serverMem?.live || {}
    const memOnline = !!liveMem.online
    const rssGB = liveMem.rss_bytes != null ? liveMem.rss_bytes / 1e9 : null
    const ceilingMB = isOwner ? serverMem?.ceiling_mb : null
    const currentMaxMB = isOwner ? serverMem?.current_max_mb : null
    const budgetMB = isOwner ? serverMem?.budget_mb : null
    const hardCapMB = currentMaxMB ?? ceilingMB
    const pct = (rssGB != null && budgetMB) ? (rssGB * 1024 / budgetMB) * 100 : null
    return (
      <StatBox
        label="RAM"
        value={rssGB != null ? `${rssGB.toFixed(2)}G` : (memOnline ? "--" : "off")}
        sub={
          isOwner && budgetMB
            ? `${pct?.toFixed(0) ?? "—"}% of ${(budgetMB / 1024).toFixed(1)}G budget · ${(hardCapMB / 1024).toFixed(1)}G hard cap${ceilingMB && hardCapMB && ceilingMB !== hardCapMB ? ` (${(ceilingMB / 1024).toFixed(1)}G authz)` : ""}`
            : (memOnline ? "in-use" : "server offline")
        }
        warn={isOwner && pct != null && pct > 100}
        extra={<MemHealth liveMem={liveMem} />}
      />
    )
  }
  return null
}

function fmtUptime(sec) {
  if (sec == null || sec < 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
