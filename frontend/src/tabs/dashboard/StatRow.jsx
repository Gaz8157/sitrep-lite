import { useT } from "../../ctx.jsx"
import { useMobile } from "../../hooks/index.js"
import { StatBox } from "../../components/index.js"
import { MemHealth } from "./MemHealth.jsx"

export function StatRow({ status, metrics, serverMem, procStats, isOwner, floating, hidden, onFloat, onHide }) {
  const mobile = useMobile()
  const active = status?.state === "active"
  const uptime = fmtUptime(status?.uptime_sec)
  const hostCpu = metrics?.cpu
  const gpu = metrics?.gpu
  // Per-server process CPU. psutil's cpu_percent is per-core convention
  // (100% = one full core, can exceed 100 if multi-threaded). We translate
  // to (cores-in-use / physical-cores-pinned), which is what operators
  // actually mean by "how busy is my server".
  const procRaw = procStats?.cpu_percent
  const threadCount = procStats?.affinity?.length || procStats?.total_logical_cpus || 1
  // SMT pairs each physical core with one sibling thread; affinity always
  // contains both, so threads/2 = physical cores. Min of 1 guards the edge
  // case where affinity wasn't reported.
  const physCores = Math.max(1, Math.round(threadCount / 2))
  const coresUsed = procRaw != null ? procRaw / 100 : null
  const procPctOfPhys = coresUsed != null
    ? Math.min(100, (coresUsed / physCores) * 100) : null
  // RAM tile shows THIS SERVER's RSS, not the host pool. Owners also see
  // the configured ceiling and warning when usage exceeds the budget.
  const liveMem = serverMem?.live || {}
  const memOnline = !!liveMem.online
  const rssGB = liveMem.rss_bytes != null ? liveMem.rss_bytes / 1e9 : null
  const ceilingMB = isOwner ? serverMem?.ceiling_mb : null
  const currentMaxMB = isOwner ? serverMem?.current_max_mb : null
  const budgetMB = isOwner ? serverMem?.budget_mb : null
  // hard cap is what the kernel actually enforces right now (MemoryMax,
  // surfaced as current_max_mb). ceiling_mb is the authorized upper bound
  // the watcher is allowed to raise up to — useful but not the kill line.
  const hardCapMB = currentMaxMB ?? ceilingMB
  const memPctOfBudget = (rssGB != null && budgetMB)
    ? (rssGB * 1024 / budgetMB) * 100 : null

  const shouldShow = (id) => !floating?.[id] && !hidden?.[id]
  const visibleCount = ["stat-uptime", "stat-cpu", "stat-gpu", "stat-ram"]
    .filter(shouldShow)
    .filter(id => !(id === "stat-gpu" && !gpu?.available))
    .length

  if (visibleCount === 0) return null

  return (
    <div className={mobile ? "grid grid-cols-2 gap-2" : "flex gap-2.5 flex-wrap"}>
      {shouldShow("stat-uptime") && (
        <StatBox
          label="Uptime"
          value={active ? (uptime || "—") : "---"}
          sub={active ? "online" : "offline"}
          warn={!active}
          onFloat={() => onFloat("stat-uptime")}
          onHide={() => onHide("stat-uptime")}
        />
      )}
      {shouldShow("stat-cpu") && (
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
          onFloat={() => onFloat("stat-cpu")}
          onHide={() => onHide("stat-cpu")}
        />
      )}
      {shouldShow("stat-gpu") && gpu?.available && (
        <StatBox
          label="Host GPU"
          value={`${gpu.usage}%`}
          sub={`host-wide · ${gpu.temp}°C · ${gpu.vram_used}/${gpu.vram_total}G VRAM`}
          warn={gpu.temp > 80}
          onFloat={() => onFloat("stat-gpu")}
          onHide={() => onHide("stat-gpu")}
        />
      )}
      {shouldShow("stat-ram") && (
        <StatBox
          label="RAM"
          value={rssGB != null ? `${rssGB.toFixed(2)}G` : (memOnline ? "--" : "off")}
          sub={
            isOwner && budgetMB
              ? `${memPctOfBudget?.toFixed(0) ?? "—"}% of ${(budgetMB / 1024).toFixed(1)}G budget · ${(hardCapMB / 1024).toFixed(1)}G hard cap${ceilingMB && hardCapMB && ceilingMB !== hardCapMB ? ` (${(ceilingMB / 1024).toFixed(1)}G authz)` : ""}`
              : (memOnline ? "in-use" : "server offline")
          }
          warn={isOwner && memPctOfBudget != null && memPctOfBudget > 100}
          extra={<MemHealth liveMem={liveMem} />}
          onFloat={() => onFloat("stat-ram")}
          onHide={() => onHide("stat-ram")}
        />
      )}
    </div>
  )
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
