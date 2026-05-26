export const SUPPORTED_EVENTS = [
  "server.start",
  "server.stop",
  "server.crash",
  "player.join",
  "player.leave",
  "chat.message",
]

export const FIRING_EVENTS = new Set([
  "server.start",
  "server.stop",
])

export const KIND_OPTIONS = [
  { id: "discord", label: "Discord" },
  { id: "slack", label: "Slack" },
  { id: "generic", label: "Generic HTTP" },
]

export function relativeTime(epochSec) {
  if (!epochSec) return null
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - epochSec)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function fmtTimestamp(epochSec) {
  if (!epochSec) return ""
  try {
    return new Date(epochSec * 1000).toLocaleString()
  } catch {
    return String(epochSec)
  }
}

export function truncateUrl(url, max = 64) {
  if (!url) return ""
  if (url.length <= max) return url
  return url.slice(0, max - 1) + "…"
}

export function isValidHttpUrl(s) {
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}
