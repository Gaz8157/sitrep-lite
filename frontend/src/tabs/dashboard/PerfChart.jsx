import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useT } from "../../ctx.jsx"
import { useMobile } from "../../hooks/index.js"
import { Card } from "../../components/index.js"
import { PanelHeader } from "./PanelHeader.jsx"

// CPU/GPU rolling area chart. `data` is the shared history array
// (each entry has at least { cpu, gpu, i }). The chart auto-fills
// the container's width.
//
// If GPU isn't available on this host, we hide the GPU series so
// the chart still makes sense for the CPU line.
export function PerfChart({ data, latest, procStats, gpuAvailable, onFloat, onHide }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  // Per-server CPU as "cores-used / physical-cores-pinned" — mirrors the
  // StatRow tile and Dashboard's chart-history push so label, chart, and
  // stat all agree on what the percentage means.
  const threads = procStats?.affinity?.length || procStats?.total_logical_cpus || 1
  const physCores = Math.max(1, Math.round(threads / 2))
  const coresUsed = procStats?.cpu_percent != null ? procStats.cpu_percent / 100 : null
  const procPctOfPhys = coresUsed != null
    ? Math.min(100, (coresUsed / physCores) * 100) : null
  return (
    <Card className="p-4 flex-1">
      <PanelHeader label="Server Performance" onFloat={onFloat} onHide={onHide} />
      <ResponsiveContainer width="100%" height={mobile ? 80 : 110}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gpuG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.purple} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: sz.base, color: C.text,
            }}
          />
          <Area type="monotone" dataKey="cpu" stroke={C.accent} fill="url(#cpuG)" strokeWidth={1.5} dot={false} name="CPU" />
          {gpuAvailable && (
            <Area type="monotone" dataKey="gpu" stroke={C.purple} fill="url(#gpuG)" strokeWidth={1.5} dot={false} name="GPU" />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1">
        <span className="font-bold" style={{ color: C.accent, fontSize: sz.stat }}>
          {procPctOfPhys != null
            ? `Server ${procPctOfPhys.toFixed(0)}%`
            : `Server CPU ${latest?.cpu?.usage ?? 0}%`}
        </span>
        {coresUsed != null && (
          <span style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
            {coresUsed.toFixed(1)} of {physCores} cores · host {latest?.cpu?.usage ?? 0}%
          </span>
        )}
        {gpuAvailable && (
          <span className="font-bold" style={{ color: C.purple, fontSize: sz.stat }}>
            Host GPU {latest?.gpu?.usage ?? 0}%
          </span>
        )}
      </div>
    </Card>
  )
}
