import { SRC_COLORS, SRC_LABELS } from "../constants.js"

export function SrcTag({ source }) {
  const color = SRC_COLORS[source] || "#5a6a7a"
  const label = SRC_LABELS[source] || source?.slice(0, 3) || "???"
  return (
    <span
      className="inline-flex items-center justify-center min-w-[38px] px-1.5 py-[2px] rounded font-black"
      style={{ color, background: color + "0a", border: `1px solid ${color}25`, fontSize: 8 }}
    >
      {label}
    </span>
  )
}
