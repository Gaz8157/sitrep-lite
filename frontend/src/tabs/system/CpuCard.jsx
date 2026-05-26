import { useT } from "../../ctx.jsx"
import { Card, Bar } from "../../components/index.js"

export default function CpuCard({ cpu }) {
  const { C, sz } = useT()
  const usage = cpu?.usage ?? 0
  const temp = cpu?.temp ?? 0
  const cores = cpu?.cores ?? 0
  const perCore = cpu?.per_core || []
  const usageColor = usage > 90 ? C.red : usage > 70 ? C.orange : C.accent
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span
          className="font-black uppercase tracking-widest"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          CPU
        </span>
        <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
          {cores} cores · {temp || "—"}°C
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span
          className="font-black tabular-nums"
          style={{ color: usageColor, fontSize: sz.base + 14, lineHeight: 1 }}
        >
          {usage}
        </span>
        <span style={{ color: C.textDim, fontSize: sz.base + 2 }}>%</span>
      </div>
      <Bar pct={usage} color={usageColor} height={6} />
      {perCore.length > 0 && (
        <div className="mt-4">
          <div
            className="font-bold uppercase tracking-widest mb-2"
            style={{ color: C.textMuted, fontSize: sz.label }}
          >
            Per-core
          </div>
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(perCore.length, 8)}, minmax(0, 1fr))`,
            }}
          >
            {perCore.map((v, i) => (
              <div key={i} className="flex flex-col gap-1 items-stretch">
                <div
                  className="font-mono text-center"
                  style={{ color: C.textMuted, fontSize: Math.max(8, sz.stat - 1) }}
                >
                  {i}
                </div>
                <Bar pct={v} color={v > 80 ? C.red : v > 60 ? C.orange : C.accent + "80"} height={4} />
                <div
                  className="font-mono text-center"
                  style={{ color: v > 80 ? C.red : C.text, fontSize: Math.max(8, sz.stat - 1) }}
                >
                  {Math.round(v)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
