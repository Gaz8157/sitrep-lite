import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Badge, Card } from "../../components/index.js"
import { PanelHeader } from "./PanelHeader.jsx"

// "Live · 3s ago" indicator. We tick at 1 Hz while mounted so the age
// counts up smoothly between polls; on each new fetch the parent passes
// a fresh `lastUpdated` and the counter snaps back to "now".
function FreshnessTag({ lastUpdated, serverRunning }) {
  const { C, sz } = useT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  let label
  let color = C.textMuted
  if (!serverRunning) {
    label = "Server offline"
    color = C.textDim
  } else if (lastUpdated == null) {
    label = "Polling…"
  } else {
    const ageSec = Math.max(0, Math.round((now - lastUpdated) / 1000))
    const ageText = ageSec < 1 ? "now" : `${ageSec}s ago`
    label = `Live · ${ageText}`
    // Stale guard: poll interval is 5s, so anything past ~12s means the
    // backend is wedged or the server died mid-poll.
    if (ageSec > 12) color = C.warning ?? C.textMuted
  }
  return (
    <span
      className="font-mono"
      style={{ color, fontSize: sz.stat - 2, whiteSpace: "nowrap" }}
      title="Player list is parsed from the live console.log on every poll"
    >
      {label}
    </span>
  )
}

// Live player list — receives the /api/servers/<id>/players response.
// The agent's players.list parses BattlEye console.log on every call so
// the data is always derived from the current log, not cached state.
// Fields available: name, slot, steam_id, ip.
export function PlayersPanel({ data, maxPlayers, lastUpdated, serverRunning = true, onFloat, onHide }) {
  const { C, sz } = useT()
  const players = data?.players || []
  const total = data?.total ?? players.length
  const empty = players.length === 0
  return (
    <Card className="shrink-0 p-4">
      <PanelHeader
        label="Online Players"
        rightSlot={
          <div className="flex items-center gap-2">
            <FreshnessTag lastUpdated={lastUpdated} serverRunning={serverRunning} />
            <Badge
              text={`${total} / ${maxPlayers ?? "—"}`}
              v={total > 0 ? "default" : "dim"}
            />
          </div>
        }
        onFloat={onFloat}
        onHide={onHide}
      />
      {empty ? (
        <div style={{ color: C.textMuted, fontSize: sz.base }}>No players connected</div>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {players.map((p, i) => {
            const initial = (p.name || p.player_name || "?")[0]?.toUpperCase() || "?"
            const slot = p.slot != null ? `#${p.slot}` : ""
            return (
              <div
                key={p.steam_id || `${p.name}-${i}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-7 h-7 rounded flex items-center justify-center font-black shrink-0"
                  style={{ background: C.accentBg, color: C.accent, fontSize: sz.base + 1 }}
                >
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate" style={{ color: C.textBright, fontSize: sz.base }}>
                    {p.name || p.player_name || "(unknown)"}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {slot && (
                      <span className="font-mono" style={{ color: C.accent, fontSize: sz.stat - 1 }}>
                        {slot}
                      </span>
                    )}
                    {p.steam_id && (
                      <span className="font-mono truncate" style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
                        {p.steam_id}
                      </span>
                    )}
                    {p.ip && (
                      <span style={{ color: C.textDim, fontSize: sz.stat - 1 }}>{p.ip}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
