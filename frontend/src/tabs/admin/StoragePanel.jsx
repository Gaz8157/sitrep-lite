import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPut, APIError } from "../../api/index.js"
import { Btn, Input } from "../../components/index.js"

const BUCKET_LABELS = {
  server: "Game install (server/)",
  "workshop-downloads": "Workshop mods (workshop-downloads/)",
  profile: "Profile — saves, addons, logs (profile/)",
  other: "Other (steamcmd-home, tmp, configs)",
}

function fmtBytes(n) {
  if (n == null || isNaN(n)) return "—"
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

export default function StoragePanel({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const iid = instance?.id ?? instance?.instance_id
  const isOwner = authUser?.role === "owner"
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [quotaInput, setQuotaInput] = useState("")
  const [saving, setSaving] = useState(false)

  const load = async (force = false) => {
    if (iid == null) return
    try {
      const d = force
        ? await apiPost(`/api/servers/${iid}/storage/refresh`, {})
        : await apiGet(`/api/servers/${iid}/storage`)
      setData(d)
      setQuotaInput(d.quota_gb == null ? "" : String(d.quota_gb))
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  useEffect(() => { load(false) }, [iid])

  const refresh = async () => {
    setBusy(true)
    try { await load(true) } finally { setBusy(false) }
  }

  const saveQuota = async () => {
    if (!isOwner) return
    const trimmed = quotaInput.trim()
    const value = trimmed === "" ? null : parseInt(trimmed, 10)
    if (value != null && (isNaN(value) || value < 0 || value > 10000)) {
      toast?.("Quota must be 1–10000 GB (or empty for unlimited)", "danger")
      return
    }
    setSaving(true)
    try {
      const d = await apiPut(`/api/servers/${iid}/storage/quota`, { quota_gb: value })
      setData(d)
      setQuotaInput(d.quota_gb == null ? "" : String(d.quota_gb))
      toast?.(value == null ? "Quota cleared" : `Quota set to ${value} GB`, "default")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSaving(false) }
  }

  if (!instance) {
    return <div style={{ color: C.textMuted, fontSize: sz.base }}>Select a server first.</div>
  }
  if (!data) {
    return <div style={{ color: C.textMuted, fontSize: sz.base }}>Scanning disk usage…</div>
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
  const computedAgo = data.computed_at
    ? `${Math.max(0, Math.floor(Date.now() / 1000 - data.computed_at))}s ago`
    : "never"

  return (
    <div className="flex flex-col gap-4" style={{ color: C.text }}>
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-black uppercase tracking-widest" style={{ color: C.textBright, fontSize: sz.base + 2, margin: 0 }}>
          Storage — {instance?.display_name || instance?.name || `instance ${iid}`}
        </h3>
        <span style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
          Last scan: {computedAgo}{data.stale ? " (stale)" : ""}
        </span>
        <div className="flex-1" />
        <Btn small v="ghost" onClick={refresh} disabled={busy}>
          {busy ? "Scanning…" : "Refresh"}
        </Btn>
      </div>

      <div className="rounded-xl p-4" style={{ background: C.bgCard, border: `1px solid ${C.border}` }}>
        <div className="flex items-baseline gap-3" style={{ fontSize: sz.base }}>
          <span style={{ fontFamily: "monospace", fontWeight: 800, color: overQuota ? C.red : C.textBright, fontSize: sz.base + 4 }}>
            {fmtBytes(used)}
          </span>
          {quotaGB ? (
            <span style={{ color: C.textMuted }}>
              of {quotaGB} GB ({pct != null ? pct.toFixed(0) : "—"}%)
            </span>
          ) : (
            <span style={{ color: C.textMuted }}>no quota set</span>
          )}
          {overQuota && (
            <span className="px-2 py-0.5 rounded font-bold" style={{ background: C.redBg, color: C.red, fontSize: sz.stat - 1 }}>
              OVER QUOTA
            </span>
          )}
        </div>
        <div
          style={{
            height: 10,
            background: C.bgInput,
            borderRadius: 999,
            overflow: "hidden",
            marginTop: 10,
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
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: sz.stat }}>
          <thead>
            <tr style={{ background: C.bgInput, color: C.textDim, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", fontSize: sz.label }}>
              <td style={{ padding: "10px 12px" }}>Bucket</td>
              <td style={{ textAlign: "right", padding: "10px 12px" }}>Size</td>
              <td style={{ textAlign: "right", padding: "10px 12px" }}>% of used</td>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.breakdown || {}).map(([k, v]) => {
              const pctBucket = used > 0 ? ((v / used) * 100) : 0
              return (
                <tr key={k} style={{ background: C.bgCard, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 12px" }}>{BUCKET_LABELS[k] || k}</td>
                  <td style={{ textAlign: "right", padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.textBright }}>
                    {fmtBytes(v)}
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 12px", color: C.textMuted }}>
                    {pctBucket.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl p-4" style={{ background: C.bgCard, border: `1px solid ${C.border}` }}>
        <div className="font-bold mb-2" style={{ color: C.textDim, fontSize: sz.label, textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Allocation
        </div>
        <div style={{ color: C.textMuted, fontSize: sz.stat - 1, marginBottom: 10 }}>
          Soft cap. The panel warns when usage crosses 70% (amber) and 90% (red), but does not block writes.
          Leave blank to clear the quota.
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={quotaInput}
            onChange={setQuotaInput}
            placeholder={isOwner ? "GB (1–10000), or empty for unlimited" : "Owner only"}
            disabled={!isOwner || saving}
          />
          <Btn onClick={saveQuota} disabled={!isOwner || saving}>
            {saving ? "Saving…" : "Save"}
          </Btn>
        </div>
        {!isOwner && (
          <div style={{ color: C.textMuted, fontSize: sz.stat - 1, marginTop: 6 }}>
            Only owners can change the quota.
          </div>
        )}
      </div>
    </div>
  )
}
