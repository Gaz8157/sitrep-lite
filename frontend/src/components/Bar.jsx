import { useT } from "../ctx.jsx"

export function Bar({ pct, color, height = 4 }) {
  const { C } = useT()
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: C.border }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, pct)}%`, background: color || C.accent }}
      />
    </div>
  )
}
