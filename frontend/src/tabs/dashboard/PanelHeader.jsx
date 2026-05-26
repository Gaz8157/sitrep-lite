import { useT } from "../../ctx.jsx"
import { useMobile } from "../../hooks/index.js"

// Shared header for dashboard panels — label + optional right slot + the
// float/hide buttons. Mirrors v1's DH() inline factory.
export function PanelHeader({ label, rightSlot, onFloat, onHide }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  return (
    <div className="flex items-center justify-between mb-2 gap-2">
      <span
        className="font-bold uppercase tracking-widest"
        style={{ color: C.textDim, fontSize: sz.label }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {rightSlot}
        {!mobile && onFloat && (
          <button
            onClick={onFloat}
            title="Detach / float panel"
            style={{
              background: "none", border: `1px solid ${C.blue}50`, cursor: "pointer",
              color: C.blue, fontSize: 11, padding: "1px 4px", lineHeight: 1, borderRadius: 4,
            }}
          >
            ⬡
          </button>
        )}
        {onHide && (
          <button
            onClick={onHide}
            title="Hide panel (restore from bar above)"
            style={{
              background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
              color: C.textMuted, fontSize: 13, padding: "0px 4px", lineHeight: 1.2, borderRadius: 4,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
