import { useCallback, useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPut, apiDelete, APIError } from "../../api/index.js"
import { Btn, Modal, Empty } from "../../components/index.js"

const RETENTION_MIN = 1
const RETENTION_MAX = 365

export default function SettingsPanel({ instanceId, toast }) {
  const { C, sz } = useT()

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [retention, setRetention] = useState({ days: 7, last_prune_at: null, rows_pruned_last: 0 })
  const [retentionInput, setRetentionInput] = useState("7")
  const [storage, setStorage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [confirmClearPlayers, setConfirmClearPlayers] = useState(false)
  const [confirmClearCameras, setConfirmClearCameras] = useState(false)

  const ingestUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/api/ingest/${instanceId}`
  }, [instanceId])

  const loadKey = useCallback(async () => {
    try {
      const r = await apiGet(`/api/servers/${instanceId}/tracker/api-key`)
      setApiKey(r.api_key || "")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }, [instanceId, toast])

  const loadRetention = useCallback(async () => {
    try {
      const r = await apiGet(`/api/servers/${instanceId}/tracker/retention`)
      setRetention(r)
      setRetentionInput(String(r.days ?? 7))
    } catch (e) {
      // Silent — defaults to 7
    }
  }, [instanceId])

  const loadStorage = useCallback(async () => {
    try {
      const r = await apiGet(`/api/servers/${instanceId}/tracker/storage`)
      setStorage(r)
    } catch (e) {
      setStorage(null)
    }
  }, [instanceId])

  const loadAll = useCallback(async () => {
    if (instanceId == null) return
    setLoading(true)
    await Promise.all([loadKey(), loadRetention(), loadStorage()])
    setLoading(false)
  }, [instanceId, loadKey, loadRetention, loadStorage])

  useEffect(() => { loadAll() }, [loadAll])

  const rotateKey = async () => {
    setConfirmRotate(false)
    try {
      const r = await apiPost(`/api/servers/${instanceId}/tracker/api-key/rotate`)
      setApiKey(r.api_key || "")
      setShowKey(true)
      toast?.("API key rotated — update your mod config", "warning")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const saveRetention = async () => {
    const days = parseInt(retentionInput, 10)
    if (!Number.isFinite(days) || days < RETENTION_MIN || days > RETENTION_MAX) {
      toast?.(`Retention must be ${RETENTION_MIN}-${RETENTION_MAX} days`, "danger")
      return
    }
    try {
      const r = await apiPut(`/api/servers/${instanceId}/tracker/retention`, { days })
      setRetention(r)
      toast?.(`Retention set to ${days} days`)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const clearPlayers = async () => {
    setConfirmClearPlayers(false)
    try {
      const r = await apiDelete(`/api/servers/${instanceId}/tracker/players`)
      toast?.(`Cleared ${r.cleared ?? 0} player snapshots`, "warning")
      loadStorage()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const clearCameras = async () => {
    setConfirmClearCameras(false)
    try {
      const r = await apiDelete(`/api/servers/${instanceId}/tracker/cameras`)
      toast?.(`Cleared ${r.cleared ?? 0} camera frames`, "warning")
      loadStorage()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const copy = (text, label) => {
    navigator.clipboard.writeText(text)
      .then(() => toast?.(`${label} copied`, "info"))
      .catch(() => toast?.("Copy failed", "danger"))
  }

  const maskedKey = apiKey
    ? apiKey.slice(0, 4) + "•".repeat(Math.max(4, apiKey.length - 8)) + apiKey.slice(-4)
    : ""

  if (instanceId == null) return <Empty title="No instance selected" />
  if (loading) return <Empty title="Loading settings…" />

  const fmtTs = (t) => t ? new Date(t * 1000).toLocaleString() : "—"
  const fmtBytes = (n) => {
    if (n == null) return "—"
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(2)} MB`
    return `${(n / 1073741824).toFixed(2)} GB`
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Mod Setup */}
      <Section title="Mod Setup" C={C} sz={sz}>
        <div style={{ color: C.textDim, fontSize: sz.label, marginBottom: 10 }}>
          Paste the ingest URL and API key into your PlayerTracker / CameraTracker mod config.
          The mod sends the key as an <span style={{ fontFamily: "monospace", color: C.text }}>X-Sitrep-Token</span> header on every POST.
        </div>
        <ConfigBlock C={C} sz={sz} lines={[
          { label: "Ingest URL (players)", value: `${ingestUrl}/players`, onCopy: () => copy(`${ingestUrl}/players`, "Ingest URL") },
          { label: "Ingest URL (cameras)", value: `${ingestUrl}/cam`,     onCopy: () => copy(`${ingestUrl}/cam`, "Camera URL") },
          { label: "X-Sitrep-Token",       value: apiKey,                  onCopy: () => copy(apiKey, "API key"), mono: true },
        ]} />
      </Section>

      {/* API Key */}
      <Section title="API Key" C={C} sz={sz}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1" style={{ minWidth: 280 }}>
            <code style={{
              display: "block",
              padding: "8px 12px",
              background: C.bgInput,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: sz.label,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {apiKey ? (showKey ? apiKey : maskedKey) : "(no key — will be created on next request)"}
            </code>
          </div>
          <Btn small v="ghost" onClick={() => setShowKey(v => !v)}>{showKey ? "Hide" : "Show"}</Btn>
          <Btn small onClick={() => copy(apiKey, "API key")} disabled={!apiKey}>Copy</Btn>
          <Btn small v="danger" onClick={() => setConfirmRotate(true)}>Rotate</Btn>
        </div>
        <div style={{ color: C.textMuted, fontSize: sz.label - 1, marginTop: 8 }}>
          Rotating invalidates the previous key — your mod config must be updated immediately or ingest will return 401.
        </div>
      </Section>

      {/* Retention */}
      <Section title="Retention" C={C} sz={sz}>
        <div className="flex items-center gap-3 flex-wrap">
          <label style={{ color: C.textDim, fontSize: sz.label, fontWeight: 700 }}>
            Keep player snapshots for
          </label>
          <input
            type="number"
            min={RETENTION_MIN}
            max={RETENTION_MAX}
            value={retentionInput}
            onChange={e => setRetentionInput(e.target.value)}
            className="rounded-lg px-3 py-1.5 outline-none w-24"
            style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
          />
          <span style={{ color: C.textDim, fontSize: sz.label }}>days (1-365)</span>
          <Btn small onClick={saveRetention}>Save</Btn>
        </div>
        <div className="flex gap-4 flex-wrap" style={{ marginTop: 10 }}>
          <Stat label="Last prune"      value={fmtTs(retention.last_prune_at)} C={C} sz={sz} />
          <Stat label="Rows pruned last" value={String(retention.rows_pruned_last ?? 0)} C={C} sz={sz} />
        </div>
      </Section>

      {/* Storage */}
      <Section title="Storage" C={C} sz={sz}>
        <div className="flex gap-4 flex-wrap">
          <Stat label="Player rows"   value={String(storage?.player_rows ?? 0)} C={C} sz={sz} />
          <Stat label="Camera frames" value={String(storage?.camera_rows ?? 0)} C={C} sz={sz} />
          <Stat label="DB size"       value={fmtBytes(storage?.db_size_bytes)} C={C} sz={sz} />
          <Stat label="Oldest data"   value={fmtTs(storage?.oldest_ts)} C={C} sz={sz} />
          <Stat label="Newest data"   value={fmtTs(storage?.newest_ts)} C={C} sz={sz} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn small v="ghost" onClick={loadStorage}>Refresh</Btn>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone" C={C} sz={sz} danger>
        <div style={{ color: C.textDim, fontSize: sz.label, marginBottom: 10 }}>
          These operations are not reversible. Buffered + persisted rows are deleted for this instance.
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn v="danger" onClick={() => setConfirmClearPlayers(true)}>Clear all player data</Btn>
          <Btn v="danger" onClick={() => setConfirmClearCameras(true)}>Clear all camera data</Btn>
        </div>
      </Section>

      <Modal open={confirmRotate} onClose={() => setConfirmRotate(false)} title="Rotate API Key">
        <div style={{ color: C.text, fontSize: sz.base, marginBottom: 12 }}>
          The previous key will stop working immediately. Any mod still using the old key
          will receive 401 on every POST until its config is updated.
        </div>
        <div className="flex gap-2 justify-end">
          <Btn v="ghost" onClick={() => setConfirmRotate(false)}>Cancel</Btn>
          <Btn v="danger" onClick={rotateKey}>Rotate Key</Btn>
        </div>
      </Modal>

      <Modal open={confirmClearPlayers} onClose={() => setConfirmClearPlayers(false)} title="Clear player data?">
        <div style={{ color: C.text, fontSize: sz.base, marginBottom: 12 }}>
          Delete all buffered player snapshots for this instance. Persisted rows in SQLite
          are not deleted by this action — use the retention setting + wait for prune,
          or stop persisting first.
        </div>
        <div className="flex gap-2 justify-end">
          <Btn v="ghost" onClick={() => setConfirmClearPlayers(false)}>Cancel</Btn>
          <Btn v="danger" onClick={clearPlayers}>Delete</Btn>
        </div>
      </Modal>

      <Modal open={confirmClearCameras} onClose={() => setConfirmClearCameras(false)} title="Clear camera data?">
        <div style={{ color: C.text, fontSize: sz.base, marginBottom: 12 }}>
          Delete all buffered camera frames for this instance.
        </div>
        <div className="flex gap-2 justify-end">
          <Btn v="ghost" onClick={() => setConfirmClearCameras(false)}>Cancel</Btn>
          <Btn v="danger" onClick={clearCameras}>Delete</Btn>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, C, sz, danger, children }) {
  return (
    <div className="rounded-xl p-4" style={{
      background: C.bgCard,
      border: `1px solid ${danger ? C.red + "40" : C.border}`,
    }}>
      <div style={{
        color: danger ? C.red : C.textBright,
        fontSize: sz.base,
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  )
}

function ConfigBlock({ C, sz, lines }) {
  return (
    <div className="rounded-lg" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
      {lines.map((l, i) => (
        <div key={i}
             className="flex items-center gap-2 px-3 py-2"
             style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
          <div style={{ width: 170, color: C.textMuted, fontSize: sz.label - 1, fontWeight: 700 }}>
            {l.label}
          </div>
          <code style={{
            flex: 1,
            color: C.text,
            fontSize: sz.label,
            fontFamily: l.mono ? "monospace" : "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{l.value || "(empty)"}</code>
          <button onClick={l.onCopy}
                  className="cursor-pointer px-2 py-0.5 rounded"
                  style={{
                    background: C.bgCard,
                    color: C.textDim,
                    border: `1px solid ${C.border}`,
                    fontSize: sz.label - 1,
                    fontWeight: 700,
                  }}>
            copy
          </button>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, C, sz }) {
  return (
    <div>
      <div style={{ color: C.textMuted, fontSize: sz.label - 1, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: C.text, fontSize: sz.base, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  )
}
