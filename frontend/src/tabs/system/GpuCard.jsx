import { useT } from "../../ctx.jsx"
import { Card, Bar } from "../../components/index.js"

export default function GpuCard({ gpu }) {
  const { C, sz } = useT()
  if (!gpu?.available) {
    return (
      <Card className="p-4">
        <div
          className="font-black uppercase tracking-widest mb-3"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          GPU
        </div>
        <div style={{ color: C.textMuted, fontSize: sz.base }}>No GPU detected.</div>
        <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 4 }}>
          nvidia-smi is required for live readings.
        </div>
      </Card>
    )
  }
  const usage = gpu.usage ?? 0
  const temp = gpu.temp ?? 0
  const vramPct = gpu.vram_total ? Math.round((gpu.vram_used / gpu.vram_total) * 100) : 0
  const usageColor = usage > 90 ? C.red : usage > 70 ? C.orange : C.accent
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span
          className="font-black uppercase tracking-widest"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          GPU
        </span>
        <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
          {temp}°C
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
      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span className="font-bold" style={{ color: C.textDim, fontSize: sz.stat }}>VRAM</span>
          <span className="font-mono" style={{ color: C.text, fontSize: sz.stat }}>
            {gpu.vram_used} / {gpu.vram_total} GB
          </span>
        </div>
        <Bar pct={vramPct} color={vramPct > 90 ? C.red : C.blue} height={5} />
      </div>
    </Card>
  )
}
