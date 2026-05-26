import { useState, useEffect, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, APIError } from "../../api/index.js"

function fmtBytes(n) {
  if (n == null || isNaN(n)) return "—"
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

const BUCKET_LABELS = {
  server: "Game install",
  "workshop-downloads": "Workshop mods",
  profile: "Profile (saves/addons)",
  other: "Other",
}

export default function StorageStrip({ instanceId, compact = true }) {
  const { C, sz } = useT()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState(false)

  const load = useCallback(async (force = false) => {
    if (instanceId == null) return
    try {
      const d = force
        ? await apiPost(`/api/servers/${instanceId}/storage/refresh`, {})
        : await apiGet(`/api/servers/${instanceId}/storage`)
      setData(d)
    } catch (e) {
      if (!(e instanceof APIError)) return
    }
  }, [instanceId])

  useEffect(() => { load(false) }, [load])

  const refresh = async (ev) => {
    ev.stopPropagation()
    if (busy) return
    setBusy(true)
    try { await load(true) } finally { setBusy(false) }
  }

  if (!data) {
    return (
      <div style={{ color: C.textMuted, fontSize: sz.stat - 1, marginTop: 6 }}>
        Storage: scanning…
      </div>
    )
  }

  const used = data.total_bytes || 0
  const quotaGB = data.quota_gb
  const quotaBytes = quotaGB ? quotaGB * 1024 ** 3 : null
  const pct = quotaBytes ? Math.min(100, (used / quotaBytes) * 100) : null
  const overQuota = quotaBytes && used > quotaBytes
  const barColor = overQuota
    ? C.red
    : pct == null
      ? C.accent + "80"
      : pct >= 90 ? C.red : pct >= 70 ? "#eab308" : C.accent

  return (
    <div
      style={{ marginTop: 6, position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-2" style={{ fontSize: sz.stat - 1 }}>
        <span style={{ color: C.textMuted, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          Storage
        </span>
        <span style={{ color: overQuota ? C.red : C.text, fontFamily: "monospace", fontWeight: 700 }}>
          {fmtBytes(used)}
          {quotaGB ? ` / ${quotaGB} GB` : ""}
        </span>
        {data.stale && (
          <span style={{ color: "#eab308", fontSize: sz.stat - 2 }} title={data.error || "stale"}>
            (stale)
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={refresh}
          disabled={busy}
          title="Re-scan disk usage"
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: busy ? C.textMuted : C.textDim,
            borderRadius: 6,
            padding: "0 6px",
            fontSize: sz.stat - 2,
            cursor: busy ? "wait" : "pointer",
            fontFamily: "monospace",
          }}
        >
          {busy ? "…" : "⟳"}
        </button>
      </div>
      <div
        style={{
          height: 6,
          background: C.bgInput,
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 4,
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            height: "100%",
            width: pct == null ? "100%" : `${pct}%`,
            background: barColor,
            opacity: pct == null ? 0.35 : 1,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      {!compact && data.breakdown && (
        <div style={{ marginTop: 8, fontSize: sz.stat - 1 }}>
          {Object.entries(data.breakdown).map(([k, v]) => (
            <div key={k} className="flex justify-between" style={{ color: C.textMuted, padding: "2px 0" }}>
              <span>{BUCKET_LABELS[k] || k}</span>
              <span style={{ fontFamily: "monospace", color: C.text }}>{fmtBytes(v)}</span>
            </div>
          ))}
        </div>
      )}
      {compact && hover && data.breakdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            zIndex: 20,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
            fontSize: sz.stat - 1,
          }}
        >
          {Object.entries(data.breakdown).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3" style={{ color: C.textMuted, padding: "2px 0" }}>
              <span>{BUCKET_LABELS[k] || k}</span>
              <span style={{ fontFamily: "monospace", color: C.text }}>{fmtBytes(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
