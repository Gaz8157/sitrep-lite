export const ACTIONS = [
  { id: "restart", label: "Restart", v: "warning" },
  { id: "stop",    label: "Stop",    v: "danger" },
  { id: "start",   label: "Start",   v: "default" },
  { id: "say",     label: "Say",     v: "info" },
  { id: "update",  label: "Update",  v: "warning" },
]

export const PRESETS = [
  {
    label: "Daily 3am UTC restart",
    cron: "0 3 * * *",
    action: "restart",
    payload: "",
    name: "Daily restart",
  },
  {
    label: "5-minute warning before nightly restart",
    cron: "55 2 * * *",
    action: "say",
    payload: "Server restarts in 5 minutes",
    name: "Restart warning",
  },
  {
    label: "Weekly Sun 5am UTC update",
    cron: "0 5 * * 0",
    action: "update",
    payload: "",
    name: "Weekly update",
  },
]

// Client-side cron sanity check — 5 fields, each non-empty. Server does
// the real croniter validation.
const CRON_FIELD = /^[\d*/,\-]+$/
export function isCronExprPlausible(expr) {
  if (typeof expr !== "string") return false
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  return parts.every(p => CRON_FIELD.test(p))
}

export function fmtTimestamp(epochSec) {
  if (!epochSec) return ""
  try {
    return new Date(epochSec * 1000).toLocaleString()
  } catch {
    return String(epochSec)
  }
}

export function relativeTime(epochSec) {
  if (!epochSec) return null
  const now = Math.floor(Date.now() / 1000)
  const diff = epochSec - now
  if (diff >= 0) {
    if (diff < 60) return `in ${diff}s`
    if (diff < 3600) return `in ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `in ${Math.floor(diff / 3600)}h`
    return `in ${Math.floor(diff / 86400)}d`
  }
  const ago = -diff
  if (ago < 60) return `${ago}s ago`
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`
  return `${Math.floor(ago / 86400)}d ago`
}

export function actionVariant(action) {
  const a = ACTIONS.find(x => x.id === action)
  return a?.v || "default"
}
