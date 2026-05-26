import { useT } from "../ctx.jsx"

export function Toasts({ toasts, dismiss }) {
  const { C } = useT()
  if (!toasts.length) return null
  const vs = {
    default: { bg: C.accentBg, text: C.accent, bd: C.accent + "30" },
    danger:  { bg: C.redBg,    text: C.red,    bd: C.redBorder },
    warning: { bg: C.orangeBg, text: C.orange, bd: C.orange + "30" },
    info:    { bg: C.blueBg,   text: C.blue,   bd: C.blue + "30" },
  }
  return (
    <div className="fixed right-4 z-[9999] flex flex-col gap-2" style={{ top: 60 }}>
      {toasts.map(t => {
        const s = vs[t.v] || vs.default
        return (
          <div
            key={t.id}
            className="toast-item px-4 py-2.5 rounded-lg font-bold shadow-xl"
            style={{
              background: s.bg, color: s.text, border: `1px solid ${s.bd}`,
              fontSize: 12, display: "flex", alignItems: "center", gap: 10,
              position: "relative", paddingRight: 32,
            }}
          >
            {t.msg}
            <button
              className="toast-x"
              onClick={() => dismiss(t.id)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: s.text, cursor: "pointer",
                fontSize: 15, fontWeight: 900, lineHeight: 1, opacity: 0,
                transition: "opacity 0.15s", padding: "2px 4px",
              }}
            >
              x
            </button>
          </div>
        )
      })}
    </div>
  )
}
