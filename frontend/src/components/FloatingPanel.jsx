import { useEffect, useRef, useState } from "react"
import { useT } from "../ctx.jsx"

// Draggable, resizable detached panel — used to pop charts/console out of the
// dashboard grid. Drag header to move, resize via the bottom-right corner.
// Port from v1 ui.jsx — the drag interaction is fine as-is (per ADR 0003).
export function FloatingPanel({ title, onDock, children, defaultPos }) {
  const { C } = useT()
  const [pos, setPos] = useState(defaultPos || { x: 120, y: 100 })
  const outerRef = useRef(null)
  const headerRef = useRef(null)
  const [contentH, setContentH] = useState(null)
  const drag = useRef(null)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const hdr = headerRef.current
      if (el && hdr) setContentH(el.clientHeight - hdr.offsetHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onDown = (e) => {
    if (e.target.closest("button[data-nodrag]")) return
    if (drag.current) return
    drag.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y }
    const mv = (ev) => setPos({ x: ev.clientX - drag.current.ox, y: ev.clientY - drag.current.oy })
    const up = () => {
      drag.current = null
      window.removeEventListener("mousemove", mv)
      window.removeEventListener("mouseup", up)
    }
    window.addEventListener("mousemove", mv)
    window.addEventListener("mouseup", up)
  }

  return (
    <div
      ref={outerRef}
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 200,
        minWidth: 200, minHeight: 80,
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)", resize: "both", overflow: "hidden",
      }}
    >
      <div
        ref={headerRef}
        onMouseDown={onDown}
        style={{
          cursor: "grab", padding: "7px 10px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 8, userSelect: "none",
        }}
      >
        <span style={{
          flex: 1, fontSize: 9, fontWeight: 700, letterSpacing: "1.5px",
          color: C.textMuted, textTransform: "uppercase",
        }}>{title}</span>
        <button
          data-nodrag
          onClick={onDock}
          style={{
            background: `${C.cyan}18`, border: `1px solid ${C.cyan}50`,
            borderRadius: 4, cursor: "pointer", color: C.cyan,
            fontSize: 9, padding: "2px 7px", fontWeight: 700,
          }}
        >↩ Dock</button>
      </div>
      <div style={contentH != null ? { height: contentH, overflowY: "auto" } : { maxHeight: "60vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  )
}
