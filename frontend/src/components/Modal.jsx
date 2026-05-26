import { useT } from "../ctx.jsx"

const SIZE_PX = { default: 480, wide: 760, xwide: 960 }

export function Modal({ open, onClose, title, children, size = "default" }) {
  const { C, sz } = useT()
  if (!open) return null
  const widthPx = SIZE_PX[size] || SIZE_PX.default
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-xl shadow-2xl max-w-[95vw] max-h-[85vh] overflow-auto"
        style={{ background: C.bgCard, border: `1px solid ${C.border}`, width: `${widthPx}px` }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-black" style={{ color: C.textBright, fontSize: sz.base + 2 }}>
            {title}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer text-lg hover:opacity-70"
            style={{ color: C.textDim }}
          >
            X
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
