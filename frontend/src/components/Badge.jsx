import { useT } from "../ctx.jsx"

// ADR 0003 cleanup: `pulse` prop renders a static dot (no pulse animation).
export function Badge({ text, v = "default", pulse }) {
  const { C } = useT()
  const vs = {
    default: { bg: C.accentBg, text: C.accent, bd: C.accent + "30" },
    danger:  { bg: C.redBg,    text: C.red,    bd: C.redBorder },
    warning: { bg: C.orangeBg, text: C.orange, bd: C.orange + "30" },
    info:    { bg: C.blueBg,   text: C.blue,   bd: C.blue + "30" },
    dim:     { bg: C.textMuted + "08", text: C.textDim, bd: C.textMuted + "20" },
  }
  const s = vs[v] || vs.default
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-bold uppercase tracking-wider leading-none"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.bd}`, fontSize: 9 }}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.text }} />}
      {text}
    </span>
  )
}
