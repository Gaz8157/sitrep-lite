import { useState, useEffect, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, APIError } from "../../api/index.js"
import { Bar, Card } from "../../components/index.js"
import { PanelHeader } from "./PanelHeader.jsx"

function fmtBytes(n) {
  if (n == null || isNaN(n)) return "—"
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}


export function StorageCard({ instanceId, onFloat, onHide }) {
  const { C, sz } = useT()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)

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

  const refresh = async () => {
    if (busy) return
    setBusy(true)
    try { await load(true) } finally { setBusy(false) }
  }

  return (
    <Card className="p-4">
      <PanelHeader label="Storage" onFloat={onFloat} onHide={onHide} />
      {!data && (
        <div style={{ color: C.textMuted, fontSize: sz.stat }}>Scanning…</div>
      )}
      {data && (() => {
        const used = data.total_bytes || 0
        const quotaGB = data.quota_gb
        const quotaBytes = quotaGB ? quotaGB * 1024 ** 3 : null
        const pct = quotaBytes ? Math.min(100, (used / quotaBytes) * 100) : null
        const overQuota = quotaBytes && used > quotaBytes
        const barColor = overQuota
          ? C.red
          : pct == null
            ? C.accent + "60"
            : pct >= 90 ? C.red : pct >= 70 ? C.orange : C.accent + "60"
        return (
          <>
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-bold" style={{ color: C.textDim, fontSize: sz.stat }}>
                Used{quotaGB ? "" : " (no quota set)"}
              </span>
              <span className="font-mono" style={{ color: overQuota ? C.red : C.text, fontSize: sz.stat }}>
                {fmtBytes(used)}{quotaGB ? ` / ${quotaGB} GB` : ""}
              </span>
            </div>
            <Bar pct={pct ?? 100} color={barColor} />
            {data.stale && (
              <div style={{ color: "#eab308", fontSize: sz.stat - 1, marginTop: 4 }} title={data.error || "stale"}>
                stale — click refresh
              </div>
            )}
            {data.breakdown && (
              <div className="mt-3">
                {Object.entries(data.breakdown).map(([key, entry]) => {
                  const sizeMb = typeof entry === "object" ? entry.size_mb : (typeof entry === "number" ? entry : 0)
                  const label = typeof entry === "object" && entry.label ? entry.label : key
                  return (
                    <div key={key} className="flex justify-between mb-1 last:mb-0">
                      <span style={{ color: C.textMuted, fontSize: sz.stat }}>{label}</span>
                      <span className="font-mono" style={{ color: C.text, fontSize: sz.stat }}>
                        {sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(1)} GB` : `${sizeMb.toFixed(0)} MB`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end mt-2">
              <button
                onClick={refresh}
                disabled={busy}
                title="Re-scan disk usage"
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: busy ? C.textMuted : C.textDim,
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: sz.stat - 1,
                  cursor: busy ? "wait" : "pointer",
                  fontFamily: "monospace",
                }}
              >
                {busy ? "scanning…" : "⟳ refresh"}
              </button>
            </div>
          </>
        )
      })()}
    </Card>
  )
}
