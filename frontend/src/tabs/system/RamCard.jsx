import { useT } from "../../ctx.jsx"
import { Card, Bar } from "../../components/index.js"

export default function RamCard({ ram }) {
  const { C, sz } = useT()
  const used = ram?.used ?? 0
  const total = ram?.total ?? 0
  const pct = ram?.pct ?? 0
  const color = pct > 90 ? C.red : pct > 75 ? C.orange : C.accent
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span
          className="font-black uppercase tracking-widest"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          RAM
        </span>
        <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
          {used} / {total} GB
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span
          className="font-black tabular-nums"
          style={{ color, fontSize: sz.base + 14, lineHeight: 1 }}
        >
          {pct}
        </span>
        <span style={{ color: C.textDim, fontSize: sz.base + 2 }}>%</span>
      </div>
      <Bar pct={pct} color={color} height={6} />
    </Card>
  )
}
