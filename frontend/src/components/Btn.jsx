import { useT } from "../ctx.jsx"

export function Btn({ children, v = "default", small, onClick, disabled, type = "button", className = "" }) {
  const { C, sz } = useT()
  const vs = {
    default: { bg: C.accentBg, text: C.accent, bd: C.accent + "30" },
    danger:  { bg: C.redBg,    text: C.red,    bd: C.redBorder },
    warning: { bg: C.orangeBg, text: C.orange, bd: C.orange + "30" },
    info:    { bg: C.blueBg,   text: C.blue,   bd: C.blue + "30" },
    ghost:   { bg: "transparent", text: C.textDim, bd: C.border },
  }
  const s = vs[v] || vs.default
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] ${small ? "px-3 py-1.5" : "px-4 py-2"} ${className}`}
      style={{
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.bd}`,
        fontSize: small ? sz.label : sz.base - 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.3)")}
      onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
    >
      {children}
    </button>
  )
}
