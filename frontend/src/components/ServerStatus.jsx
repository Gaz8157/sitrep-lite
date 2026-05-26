import { useT } from "../ctx.jsx"

// Replaces v1's pulsing-dot status indicator with a static badge + uptime.
// state: "active" | "failed" | "inactive" | other (treated as offline).
// working: shows "WORKING" in orange (used while start/stop/reset is in flight).
export function ServerStatus({ state, uptime, working }) {
  const { C, sz } = useT()
  const color = working
    ? C.orange
    : state === "active"
      ? C.accent
      : state === "failed"
        ? C.red
        : C.textMuted
  const label = working
    ? "WORKING"
    : state === "active"
      ? "ONLINE"
      : state === "failed"
        ? "FAILED"
        : "OFFLINE"
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span
        className="font-black"
        style={{ color, fontSize: sz.stat, letterSpacing: ".06em" }}
      >
        {label}
      </span>
      {uptime && state === "active" && !working && (
        <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
          {uptime}
        </span>
      )}
    </div>
  )
}
