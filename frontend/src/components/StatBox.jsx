import { Card } from "./Card.jsx"
import { useT } from "../ctx.jsx"
import { useMobile } from "../hooks/useMobile.js"

// onFloat/onHide: detach into a floating panel / hide from the dashboard (restored
// via the "Hidden:" pill bar above the grid in Dashboard). v1 behavior preserved.
export function StatBox({ label, value, sub, warn, extra, onFloat, onHide }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  return (
    <Card className="p-4 flex-1 min-w-[120px]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold uppercase tracking-widest" style={{ color: C.textDim, fontSize: sz.stat }}>
          {label}
        </div>
        {!mobile && (onFloat || onHide) && (
          <div className="flex items-center gap-1">
            {onFloat && (
              <button
                onClick={onFloat}
                title="Float panel"
                style={{ background: "none", border: `1px solid ${C.blue}50`, cursor: "pointer", color: C.blue, fontSize: 11, padding: "1px 4px", lineHeight: 1, borderRadius: 4 }}
              >
                ⬡
              </button>
            )}
            {onHide && (
              <button
                onClick={onHide}
                title="Hide panel"
                style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", color: C.textMuted, fontSize: 13, padding: "0px 4px", lineHeight: 1.2, borderRadius: 4 }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className="font-black leading-none tracking-tight"
        style={{ color: warn ? C.red : C.textBright, fontSize: sz.value }}
      >
        {value || "--"}
      </div>
      {sub && (
        <div className="mt-1.5" style={{ color: C.textMuted, fontSize: sz.stat }}>
          {sub}
        </div>
      )}
      {extra}
    </Card>
  )
}
