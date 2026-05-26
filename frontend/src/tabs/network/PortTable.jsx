import { useT } from "../../ctx.jsx"

const LABELS = {
  game: "Game",
  a2s: "A2S / Query",
  rcon: "RCON",
}

const DESC = {
  game: "Game data — connecting players send packets here",
  a2s: "Server-browser status — engine answers heartbeats",
  rcon: "Remote console — panel uses this for chat + commands",
}

export default function PortTable({ listeners }) {
  const { C, sz } = useT()
  if (!listeners || listeners.length === 0) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMuted, fontSize: sz.base }}
      >
        No ports configured yet — check config.json.
      </div>
    )
  }
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
    >
      <div
        className="flex items-center gap-3 px-4 py-2"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.bgInput }}
      >
        <span className="font-bold uppercase tracking-widest" style={{ flex: 1, color: C.textMuted, fontSize: sz.label }}>
          Service
        </span>
        <span className="font-bold uppercase tracking-widest" style={{ width: 80, color: C.textMuted, fontSize: sz.label, textAlign: "right" }}>
          Port
        </span>
        <span className="font-bold uppercase tracking-widest" style={{ width: 60, color: C.textMuted, fontSize: sz.label, textAlign: "right" }}>
          Proto
        </span>
        <span className="font-bold uppercase tracking-widest" style={{ width: 90, color: C.textMuted, fontSize: sz.label, textAlign: "right" }}>
          Listener
        </span>
      </div>
      {listeners.map((l, i) => (
        <div
          key={l.name}
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: i < listeners.length - 1 ? `1px solid ${C.border}40` : "none",
            background: i % 2 === 0 ? "transparent" : C.bgInput + "20",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-bold" style={{ color: C.text, fontSize: sz.base }}>
              {LABELS[l.name] || l.name}
            </div>
            <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 2 }}>
              {DESC[l.name] || ""}
            </div>
          </div>
          <span
            className="font-mono font-bold"
            style={{ width: 80, color: C.text, fontSize: sz.base, textAlign: "right" }}
          >
            {l.port}
          </span>
          <span
            className="font-mono"
            style={{ width: 60, color: C.textDim, fontSize: sz.stat, textAlign: "right", textTransform: "uppercase" }}
          >
            {l.proto}
          </span>
          <div style={{ width: 90, textAlign: "right" }}>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-bold"
              style={{
                background: l.active ? C.accent + "18" : C.redBg,
                color: l.active ? C.accent : C.red,
                border: `1px solid ${l.active ? C.accent + "40" : C.redBorder}`,
                fontSize: sz.stat,
              }}
            >
              <span
                className="rounded-full"
                style={{ width: 6, height: 6, background: l.active ? C.accent : C.red, display: "inline-block" }}
              />
              {l.active ? "bound" : "down"}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
