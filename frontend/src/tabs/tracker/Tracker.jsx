import { useCallback, useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"
import PlayersPanel from "./PlayersPanel.jsx"
import CamerasPanel from "./CamerasPanel.jsx"
import SettingsPanel from "./SettingsPanel.jsx"

const SUB_TABS = [
  { id: "players",  label: "Players" },
  { id: "cameras",  label: "Cameras" },
  { id: "settings", label: "Settings", adminOnly: true },
]

export default function Tracker({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const isAdmin = ["owner", "head_admin", "admin"].includes(authUser?.role)
  const visibleSubs = SUB_TABS.filter(t => !t.adminOnly || isAdmin)
  const [sub, setSub] = useState(() => {
    try { return localStorage.getItem("sitrep-tracker-sub") || "players" } catch { return "players" }
  })
  const [persist, setPersist] = useState({ players_enabled: false, cameras_enabled: false })
  const [status, setStatus] = useState(null)

  const changeSub = (newSub) => {
    setSub(newSub)
    try { localStorage.setItem("sitrep-tracker-sub", newSub) } catch {}
  }

  const loadPersist = useCallback(async () => {
    if (id == null) return
    try {
      const r = await apiGet(`/api/servers/${id}/tracker/persist`)
      setPersist({
        players_enabled: !!r.players_enabled,
        cameras_enabled: !!r.cameras_enabled,
      })
    } catch (e) {
      // Silent — falls back to false defaults
    }
  }, [id])

  const loadStatus = useCallback(async () => {
    if (id == null) return
    try {
      const r = await apiGet(`/api/servers/${id}/tracker/status`)
      setStatus(r)
    } catch (e) {
      setStatus(null)
    }
  }, [id])

  useEffect(() => { loadPersist() }, [loadPersist])
  useEffect(() => {
    loadStatus()
    const t = setInterval(loadStatus, 5000)
    return () => clearInterval(t)
  }, [loadStatus])

  const setPersistFor = useCallback(async (key, value) => {
    if (id == null) return
    try {
      const r = await apiPut(`/api/servers/${id}/tracker/persist`, { [key]: value })
      setPersist({
        players_enabled: !!r.players_enabled,
        cameras_enabled: !!r.cameras_enabled,
      })
      toast?.(`Persist ${key === "players_enabled" ? "players" : "cameras"} ${value ? "ON" : "OFF"}`)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }, [id, toast])

  if (id == null) {
    return (
      <div style={{ padding: 24, color: C.textDim, fontSize: sz.base }}>
        No instance selected.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Header
        C={C}
        sz={sz}
        status={status}
        sub={sub}
        onSubChange={changeSub}
        visibleSubs={visibleSubs}
      />

      {sub === "players" && (
        <PlayersPanel
          instanceId={id}
          toast={toast}
          persistEnabled={persist.players_enabled}
          onTogglePersist={(v) => setPersistFor("players_enabled", v)}
          status={status}
        />
      )}
      {sub === "cameras" && (
        <CamerasPanel
          instanceId={id}
          toast={toast}
          persistEnabled={persist.cameras_enabled}
          onTogglePersist={(v) => setPersistFor("cameras_enabled", v)}
          status={status}
        />
      )}
      {sub === "settings" && isAdmin && (
        <SettingsPanel
          instanceId={id}
          toast={toast}
        />
      )}
    </div>
  )
}

function Header({ C, sz, status, sub, onSubChange, visibleSubs }) {
  const playerCount = status?.players_buffer_size ?? 0
  const cameraCount = status?.cameras_camera_count ?? 0
  const lastPlayerSec = status?.last_rx_players ? Math.max(0, Math.floor(Date.now() / 1000) - status.last_rx_players) : null
  const lastCamSec = status?.last_rx_cameras ? Math.max(0, Math.floor(Date.now() / 1000) - status.last_rx_cameras) : null
  const playerActive = lastPlayerSec !== null && lastPlayerSec < 60
  const camActive = lastCamSec !== null && lastCamSec < 10

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2
          className="font-black uppercase tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
        >
          Tracker
        </h2>
        <div className="flex gap-1">
          {(visibleSubs || SUB_TABS).map(t => (
            <button
              key={t.id}
              onClick={() => onSubChange(t.id)}
              style={{
                background: sub === t.id ? C.accentBg : "transparent",
                color: sub === t.id ? C.accent : C.textDim,
                border: `1px solid ${sub === t.id ? C.accent + "60" : C.border}`,
                borderRadius: 6,
                padding: "5px 14px",
                fontSize: sz.label,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              {t.label}
              {t.id !== "settings" && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: sz.label - 1,
                    fontWeight: 700,
                    color: sub === t.id ? C.accent : C.textMuted,
                  }}
                >
                  {t.id === "players" ? playerCount : cameraCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: sz.label - 1, color: C.textMuted }}>
        <StatusDot label="Players" active={playerActive} ageSec={lastPlayerSec} C={C} />
        <StatusDot label="Cameras" active={camActive} ageSec={lastCamSec} C={C} />
      </div>
    </div>
  )
}

function StatusDot({ label, active, ageSec, C }) {
  const color = active ? C.accent : C.textMuted
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          boxShadow: active ? `0 0 6px ${color}` : "none",
        }}
      />
      <span style={{ color: C.textDim, letterSpacing: "0.04em", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ color: C.textMuted }}>
        {ageSec === null ? "no data" : ageSec < 5 ? "live" : `${ageSec}s ago`}
      </span>
    </div>
  )
}
