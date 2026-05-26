import { useT } from "../../ctx.jsx"
import { Card, Bar } from "../../components/index.js"

export default function DiskTable({ disks }) {
  const { C, sz } = useT()
  if (!disks || disks.length === 0) {
    return (
      <Card className="p-4">
        <div
          className="font-black uppercase tracking-widest mb-2"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          Disks
        </div>
        <div style={{ color: C.textMuted, fontSize: sz.base }}>No disks reported.</div>
      </Card>
    )
  }
  return (
    <Card className="p-4">
      <div
        className="font-black uppercase tracking-widest mb-3"
        style={{ color: C.textDim, fontSize: sz.label }}
      >
        Disks
      </div>
      <div className="flex flex-col gap-3">
        {disks.map((d, i) => {
          const pct = d.pct ?? (d.total > 0 ? Math.round(d.used / d.total * 100) : 0)
          const color = pct > 90 ? C.red : pct > 75 ? C.orange : C.accent + "90"
          return (
            <div key={`${d.name}-${i}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span
                  className="font-mono font-bold truncate"
                  style={{ color: C.text, fontSize: sz.base, minWidth: 0, flex: 1 }}
                >
                  {d.name}
                </span>
                <span className="font-mono shrink-0" style={{ color: C.textMuted, fontSize: sz.stat }}>
                  {d.used} / {d.total} GB · {pct}%
                </span>
              </div>
              <Bar pct={pct} color={color} height={6} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
