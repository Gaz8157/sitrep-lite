import { useT } from "../../ctx.jsx"

function bytes(n) {
  if (n == null) return null
  if (n < 1024) return `${n}B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)}K`
  if (n < 1073741824) return `${(n / 1048576).toFixed(0)}M`
  return `${(n / 1073741824).toFixed(2)}G`
}

export function MemHealth({ liveMem }) {
  const { C, sz } = useT()
  if (!liveMem || !liveMem.online) return null

  const psi = liveMem.pressure?.some?.avg60 ?? 0
  const evts = liveMem.events || {}
  const swap = liveMem.swap_bytes || 0
  const highCount = evts.high || 0
  const oomCount = (evts.oom || 0) + (evts.oom_kill || 0)

  const pct = Math.max(0, Math.min(100, psi))
  const color = psi >= 10 ? C.red : psi >= 1 ? C.orange : C.accent
  const labelColor = psi >= 10 ? C.red : psi >= 1 ? C.orange : C.textMuted

  const badges = []
  if (highCount > 0) {
    badges.push({ k: "throttled", v: `${highCount}x`, color: C.orange })
  }
  if (oomCount > 0) {
    badges.push({ k: "oom-kill", v: `${oomCount}x`, color: C.red })
  }
  if (swap > 0) {
    badges.push({ k: "swap", v: bytes(swap), color: C.orange })
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2" title={`PSI some.avg60 — % of last 60s the cgroup was stalled on memory`}>
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 4, background: C.bgInput, border: `1px solid ${C.border}` }}
        >
          <div
            style={{
              width: `${Math.max(pct, psi > 0 ? 2 : 0)}%`,
              height: "100%",
              background: color,
              transition: "width 300ms ease, background 300ms ease",
            }}
          />
        </div>
        <span
          className="font-mono"
          style={{ color: labelColor, fontSize: sz.stat - 1, minWidth: 36, textAlign: "right" }}
        >
          {psi < 0.1 ? "0.0" : psi.toFixed(1)}%
        </span>
      </div>
      {badges.length > 0 && (
        <div className="mt-1.5 flex gap-1.5 flex-wrap">
          {badges.map(b => (
            <span
              key={b.k}
              className="px-1.5 py-0.5 rounded font-bold"
              style={{
                background: b.color + "20",
                color: b.color,
                border: `1px solid ${b.color}40`,
                fontSize: sz.stat - 2,
              }}
              title={
                b.k === "throttled"
                  ? "Hit MemoryHigh and was throttled by kernel"
                  : b.k === "oom-kill"
                  ? "Kernel killed a process in this cgroup"
                  : "Swap currently in use by this server"
              }
            >
              {b.k} {b.v}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
