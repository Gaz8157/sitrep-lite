import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiDelete, APIError } from "../../api/index.js"
import TrackerControls from "./TrackerControls.jsx"
import DepthGridRenderer from "./DepthGridRenderer.jsx"

const POLL_INTERVAL_MS = 500

export default function CamerasPanel({
  instanceId,
  toast,
  persistEnabled,
  onTogglePersist,
  status,
}) {
  const { C, sz } = useT()
  const [cameras, setCameras] = useState({})
  const [camCount, setCamCount] = useState(0)
  const [lastRx, setLastRx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedCamId, setSelectedCamId] = useState(null)
  const [renderMode, setRenderMode] = useState("jbu")
  const [colorRamp, setColorRamp] = useState("viridis")
  const visibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true)

  const load = useCallback(async () => {
    if (instanceId == null) return
    if (!visibleRef.current) return
    try {
      const r = await apiGet(`/api/servers/${instanceId}/tracker/cameras`)
      setCameras(r.cameras || {})
      setCamCount(r.camera_count || 0)
      setLastRx(r.last_rx || 0)
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [instanceId, load])

  useEffect(() => {
    const onVis = () => { visibleRef.current = !document.hidden }
    document.addEventListener("visibilitychange", onVis)
    const t = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [load])

  const camIds = useMemo(() => Object.keys(cameras).sort(), [cameras])

  // Default-select the first camera once available
  useEffect(() => {
    if (selectedCamId == null && camIds.length) setSelectedCamId(camIds[0])
    if (selectedCamId != null && !camIds.includes(selectedCamId)) {
      setSelectedCamId(camIds[0] || null)
    }
  }, [camIds, selectedCamId])

  const clear = async () => {
    setBusy(true)
    try {
      await apiDelete(`/api/servers/${instanceId}/tracker/cameras`)
      setCameras({})
      setCamCount(0)
      setSelectedCamId(null)
      toast?.("Camera buffer cleared")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const frame = selectedCamId ? cameras[selectedCamId]?.latest : null

  if (loading && !camCount) {
    return (
      <div style={{ color: C.textDim, padding: 16, fontSize: sz.base }}>Loading…</div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <TrackerControls
        onClear={clear}
        persistEnabled={persistEnabled}
        onTogglePersist={onTogglePersist}
        persistLabel="Persist camera frames to disk"
        persistHelp="heavy on disk — off by default"
        busy={busy}
        extras={
          <span style={{ color: C.textMuted, fontSize: sz.label - 1 }}>
            {camCount} {camCount === 1 ? "camera" : "cameras"}
          </span>
        }
      />

      {camCount === 0 ? (
        <EmptyCameras C={C} sz={sz} />
      ) : (
        <div className="flex flex-col gap-3">
          <CameraSelector
            C={C}
            sz={sz}
            ids={camIds}
            cameras={cameras}
            selectedId={selectedCamId}
            onSelect={setSelectedCamId}
          />
          {frame && (
            <>
              <RenderControls
                C={C}
                sz={sz}
                renderMode={renderMode}
                onRenderMode={setRenderMode}
                colorRamp={colorRamp}
                onColorRamp={setColorRamp}
              />
              <CameraView
                C={C}
                sz={sz}
                frame={frame}
                renderMode={renderMode}
                colorRamp={colorRamp}
              />
              <CameraMeta C={C} sz={sz} frame={frame} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyCameras({ C, sz }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 32,
        textAlign: "center",
      }}
    >
      <div style={{ color: C.textDim, fontSize: sz.base + 2, marginBottom: 6 }}>
        No camera frames received
      </div>
      <div style={{ color: C.textMuted, fontSize: sz.base, lineHeight: 1.6 }}>
        Install the <strong style={{ color: C.text }}>CameraTracker</strong> mod
        on this server.
        <br />
        It posts depth grids to <code style={{ color: C.accent }}>/api/ingest/{"{id}"}/camera</code> every 0.3s.
      </div>
    </div>
  )
}

function CameraSelector({ C, sz, ids, cameras, selectedId, onSelect }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: C.textMuted, fontSize: sz.label - 1, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Cameras
      </span>
      <div className="flex gap-1 flex-wrap">
        {ids.map(id => {
          const sel = id === selectedId
          const cam = cameras[id]
          const ts = cam?.latest?.ts || 0
          const ageSec = ts ? Math.max(0, Math.floor(Date.now() / 1000) - ts) : null
          const fresh = ageSec !== null && ageSec < 5
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              style={{
                background: sel ? C.accentBg : "transparent",
                color: sel ? C.accent : C.text,
                border: `1px solid ${sel ? C.accent : C.border}`,
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: sz.label,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "ui-monospace, monospace",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              title={`${id} (${cam?.frame_count || 0} frames buffered)`}
            >
              <span style={{
                width: 7, height: 7, borderRadius: 999,
                background: fresh ? C.accent : C.textMuted,
                boxShadow: fresh ? `0 0 5px ${C.accent}` : "none",
              }} />
              {id.slice(-8)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RenderControls({ C, sz, renderMode, onRenderMode, colorRamp, onColorRamp }) {
  const modes = [
    { id: "raw", label: "Raw" },
    { id: "jbu", label: "JBU" },
    { id: "mesh", label: "Mesh (preview)" },
  ]
  const ramps = [
    { id: "viridis", label: "Viridis" },
    { id: "gray",    label: "Grayscale" },
    { id: "thermal", label: "Thermal" },
  ]
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <Group label="Mode" C={C} sz={sz}>
        {modes.map(m => (
          <Radio
            key={m.id}
            label={m.label}
            selected={renderMode === m.id}
            onClick={() => onRenderMode(m.id)}
            C={C}
            sz={sz}
            disabled={m.id === "mesh"}
          />
        ))}
      </Group>
      <Group label="Color" C={C} sz={sz}>
        {ramps.map(r => (
          <Radio
            key={r.id}
            label={r.label}
            selected={colorRamp === r.id}
            onClick={() => onColorRamp(r.id)}
            C={C}
            sz={sz}
          />
        ))}
      </Group>
    </div>
  )
}

function Group({ label, children, C, sz }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: C.textMuted, fontSize: sz.label - 1, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 4 }}>{children}</div>
    </div>
  )
}

function Radio({ label, selected, onClick, C, sz, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: selected ? C.accentBg : "transparent",
        color: selected ? C.accent : (disabled ? C.textMuted : C.text),
        border: `1px solid ${selected ? C.accent : C.border}`,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: sz.label,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      title={disabled ? "Mesh render mode is a future enhancement" : undefined}
    >
      {label}
    </button>
  )
}

function CameraView({ C, sz, frame, renderMode, colorRamp }) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <DepthGridRenderer
        frame={frame}
        renderMode={renderMode}
        colorRamp={colorRamp}
      />
    </div>
  )
}

function CameraMeta({ C, sz, frame }) {
  const meta = frame.meta || {}
  const items = [
    ["Camera ID", frame.camera_id || "—"],
    ["Pos", fmtVec(frame.pos)],
    ["Yaw/Pitch", `${fmtNum(frame.rot?.[0], 1)}° / ${fmtNum(frame.rot?.[1], 1)}°`],
    ["Grid", `${frame.grid_w}×${frame.grid_h}`],
    ["FoV", `${fmtNum(frame.hfov, 0)}°`],
    ["Range", `${fmtNum(frame.max_range, 0)} m`],
    ["Hit", frame.hit_entity || "—"],
    ["Hit dist", frame.hit_dist == null ? "—" : `${fmtNum(frame.hit_dist, 1)} m`],
    ["Faction", meta.faction || "—"],
    ["Weapon", meta.weapon_name || "—"],
    ["Vehicle", meta.vehicle_name || "—"],
    ["Speed", meta.speed == null ? "—" : `${fmtNum(meta.speed, 1)} m/s`],
    ["Rounds", meta.rounds_loaded == null ? "—" : `${meta.rounds_loaded}/+${meta.mags_remaining || 0}`],
  ]
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 8,
      }}
    >
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: C.textMuted, fontSize: sz.label - 1, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
            {k}
          </span>
          <span style={{ color: C.text, fontSize: sz.label, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  )
}

function fmtNum(v, places = 1) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return Number(v).toFixed(places)
}

function fmtVec(v) {
  if (!Array.isArray(v)) return "—"
  return `${fmtNum(v[0], 0)}, ${fmtNum(v[1], 0)}, ${fmtNum(v[2], 0)}`
}
