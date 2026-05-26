import { useT } from "../../ctx.jsx"
import { useFetch } from "../../hooks/index.js"
import { Btn, Bar, Card } from "../../components/index.js"
import { StorageCard } from "../dashboard/StorageCard.jsx"

function fmtBytes(n) {
  if (n == null || isNaN(n)) return "—"
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

function fmtUptime(sec) {
  if (sec == null) return "—"
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
}

export default function System({ instance, authUser }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const isOwner = authUser?.role === "owner"

  const { data: proc, loading: procLoading, refetch: refetchProc } = useFetch(
    id != null ? `/api/servers/${id}/process-stats` : null, 2000,
  )
  const { data: mem } = useFetch(
    id != null ? `/api/servers/${id}/memory/live` : null, 2000,
  )
  const { data: status } = useFetch(
    id != null ? `/api/servers/${id}/status` : null, 3000,
  )

  if (id == null) {
    return (
      <div style={{ padding: 24, color: C.textDim, fontSize: sz.base }}>
        No instance selected.
      </div>
    )
  }

  const running = proc?.running
  const cpu = proc?.cpu_percent
  const rssBytes = (mem?.live?.rss_bytes) ?? (proc?.rss_mb != null ? proc.rss_mb * 1024 * 1024 : null)
  const ceilingBytes = isOwner && mem?.ceiling_mb ? mem.ceiling_mb * 1024 * 1024 : null
  const budgetBytes = isOwner && mem?.budget_mb ? mem.budget_mb * 1024 * 1024 : null
  // pct of ceiling if owner has set one, else relative to a sane scale (8GB)
  // so the bar still has visual meaning for non-owner viewers.
  const ramRefBytes = ceilingBytes || (8 * 1024 * 1024 * 1024)
  const ramPct = rssBytes != null ? Math.min(100, (rssBytes / ramRefBytes) * 100) : 0
  const cpuPct = cpu != null ? Math.min(100, cpu) : 0  // bar caps at 100; raw % shown alongside

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-black uppercase tracking-widest" style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}>
          System
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
            {running ? "live · 2s" : "server offline"}
          </span>
          <Btn small v="ghost" onClick={refetchProc} disabled={procLoading}>
            {procLoading ? "Loading..." : "Refresh"}
          </Btn>
        </div>
      </div>

      <div style={{ color: C.textMuted, fontSize: sz.stat - 1, marginTop: -4 }}>
        Live consumption for <span style={{ color: C.text, fontFamily: "monospace" }}>{instance?.display_name || instance?.name || `#${id}`}</span>
        {" "}— host-wide stats are intentionally hidden so admins see only what THIS server is pulling.
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {/* CPU card — process %, plus per-core breakdown across assigned cores */}
        <Card className="p-4" style={{ gridColumn: proc?.is_pinned ? "1 / -1" : undefined }}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-black uppercase tracking-widest" style={{ color: C.textDim, fontSize: sz.label }}>
              Process CPU
            </div>
            {proc?.is_pinned && (
              <div className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
                pinned to {proc.affinity.length} of {proc.total_logical_cpus} cores
              </div>
            )}
            {running && proc && !proc.is_pinned && (
              <div className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
                no affinity (allowed on all {proc.total_logical_cpus})
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-black tabular-nums" style={{ color: running ? C.accent : C.textMuted, fontSize: sz.base + 16 }}>
              {running ? (cpu ?? 0).toFixed(1) : "—"}
            </span>
            <span className="font-bold" style={{ color: C.textMuted, fontSize: sz.base }}>%</span>
            <span style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
              process total (100% = one logical core)
            </span>
          </div>
          <Bar pct={cpuPct} color={cpuPct >= 90 ? C.red : cpuPct >= 70 ? C.orange : C.accent + "80"} />

          {/* Per-core grid for pinned cores */}
          {running && proc?.is_pinned && Object.keys(proc.per_core_percent || {}).length > 0 && (
            <div className="mt-4">
              <div className="font-bold uppercase tracking-widest mb-2" style={{ color: C.textMuted, fontSize: sz.stat - 1, letterSpacing: 1 }}>
                Per assigned core
              </div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(120px, 1fr))` }}
              >
                {proc.affinity.map(cpuId => {
                  const pct = proc.per_core_percent[String(cpuId)] ?? 0
                  const color = pct >= 90 ? C.red : pct >= 70 ? C.orange : C.accent + "80"
                  return (
                    <div key={cpuId} className="flex items-center gap-2">
                      <div
                        className="font-mono shrink-0"
                        style={{ color: C.textMuted, fontSize: sz.stat - 1, minWidth: 36 }}
                      >
                        CPU {cpuId}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Bar pct={Math.min(100, pct)} color={color} />
                      </div>
                      <div
                        className="font-mono tabular-nums shrink-0 text-right"
                        style={{ color: C.text, fontSize: sz.stat - 1, minWidth: 36 }}
                      >
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-3" style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
            <span>
              {proc?.is_pinned
                ? "per-core bars show system util on each pinned core"
                : "set CPU affinity in Startup → CPU to see per-core breakdown"}
            </span>
            <span className="font-mono">PID {proc?.main_pid ?? "—"}</span>
          </div>
        </Card>

        {/* RAM card — RSS, with owner-only ceiling/budget readout */}
        <Card className="p-4">
          <div className="font-black uppercase tracking-widest mb-2" style={{ color: C.textDim, fontSize: sz.label }}>
            Process RAM
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-black tabular-nums" style={{ color: running ? C.accent : C.textMuted, fontSize: sz.base + 16 }}>
              {running && rssBytes != null ? fmtBytes(rssBytes) : "—"}
            </span>
            {isOwner && ceilingBytes && (
              <span className="font-bold" style={{ color: C.textMuted, fontSize: sz.stat }}>
                / {fmtBytes(ceilingBytes)} ceiling
              </span>
            )}
          </div>
          <Bar pct={ramPct} color={ramPct >= 90 ? C.red : ramPct >= 70 ? C.orange : C.accent + "80"} />
          <div className="mt-2" style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
            {isOwner
              ? (budgetBytes
                  ? `budget ${fmtBytes(budgetBytes)} · ceiling ${fmtBytes(ceilingBytes || 0)}`
                  : "no ceiling configured (uncapped)")
              : "ceiling/budget visible to owner only"}
          </div>
        </Card>

        {/* Uptime / status card */}
        <Card className="p-4">
          <div className="font-black uppercase tracking-widest mb-2" style={{ color: C.textDim, fontSize: sz.label }}>
            Runtime
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-black tabular-nums" style={{ color: running ? C.accent : C.red, fontSize: sz.base + 12 }}>
              {running ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>
          <div className="font-mono mt-1" style={{ color: C.text, fontSize: sz.stat }}>
            uptime {fmtUptime(status?.uptime_sec)}
          </div>
          {status?.scenario_id && (
            <div className="mt-1 truncate" style={{ color: C.textMuted, fontSize: sz.stat - 1 }} title={status.scenario_id}>
              {status.scenario_id}
            </div>
          )}
        </Card>
      </div>

      {/* Storage breakdown — same per-instance card the Dashboard uses */}
      <StorageCard instanceId={id} />
    </div>
  )
}
