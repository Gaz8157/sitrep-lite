import { useT } from "../../ctx.jsx"
import { Badge, Btn, ServerStatus } from "../../components/index.js"

// Top bar: ServerStatus badge, instance name, info badges, action buttons.
// No pulsing dot — ServerStatus is static (ADR 0003).
//
// Props:
//   status       — { state, name, uptime_sec, max_players, mods_count, binary_installed, ... }
//   players      — { players: [...] } | null
//   acting       — bool, an action is in flight
//   resetting    — bool, reset modal in progress
//   onStart/Stop/Restart/Reset — () => void callbacks
export function ServerActionBar({ status, players, acting, resetting, onStart, onStop, onRestart, onReset }) {
  const { C, sz } = useT()
  const state = status?.state || "inactive"
  const active = state === "active"
  const installed = !!status?.binary_installed
  const installState = status?.install_state || (installed ? "installed" : "missing")
  const installing = installState === "installing"
  const installError = installState === "error"
  const installElapsed = status?.install_elapsed_sec
  const name = status?.display_name || status?.name || (status?.instance_id ? `Instance ${status.instance_id}` : "—")
  const uptime = fmtUptime(status?.uptime_sec)
  const playerCount = players?.players?.length ?? 0
  const maxPlayers = status?.max_players ?? 0
  const modsCount = status?.mods_count ?? 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <h1 className="font-black tracking-wide" style={{ color: C.textBright, fontSize: sz.base + 6 }}>
          {name}
        </h1>
      </div>
      <ServerStatus state={state} uptime={uptime} working={acting} />
      {modsCount > 0 && <Badge text={`${modsCount} mods`} v="dim" />}
      {active && maxPlayers > 0 && (
        <Badge text={`${playerCount}/${maxPlayers} players`} v="default" />
      )}
      {!installed && installing && (
        <Badge
          text={installElapsed != null ? `INSTALLING · ${fmtElapsed(installElapsed)}` : "INSTALLING"}
          v="info"
        />
      )}
      {!installed && installError && (
        <Badge text="INSTALL FAILED" v="danger" />
      )}
      <div className="flex-1" />
      <div className="flex gap-1.5 flex-wrap items-center">
        {active ? (
          <Btn v="danger" onClick={onStop} disabled={acting}>
            <span style={{ fontSize: sz.base + 2 }}>{acting ? "⟳" : "■"}</span>
            {acting ? "Working..." : "Stop"}
          </Btn>
        ) : (
          <Btn onClick={onStart} disabled={acting || !installed}>
            <span style={{ fontSize: sz.base + 2 }}>{acting ? "⟳" : "▶"}</span>
            {acting ? "Working..." : "Start"}
          </Btn>
        )}
        {active && (
          <Btn small v="warning" onClick={onRestart} disabled={acting}>Restart</Btn>
        )}
        <Btn small v="info" onClick={onReset} disabled={resetting || acting}>
          {resetting ? "Resetting..." : "Reset"}
        </Btn>
      </div>
    </div>
  )
}

function fmtElapsed(sec) {
  if (sec == null || sec < 0) return null
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function fmtUptime(sec) {
  if (sec == null || sec < 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
