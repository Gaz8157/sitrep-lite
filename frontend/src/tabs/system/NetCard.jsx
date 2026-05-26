import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"
import { useT } from "../../ctx.jsx"
import { Card } from "../../components/index.js"

export default function NetCard({ history, latest }) {
  const { C, sz } = useT()
  const up = latest?.up_mbps ?? 0
  const down = latest?.down_mbps ?? 0
  const data = history.map((h, i) => ({ i, up: h.up, down: h.down }))
  return (
    <Card className="p-4">
      <div
        className="font-black uppercase tracking-widest mb-3"
        style={{ color: C.textDim, fontSize: sz.label }}
      >
        Network rate
      </div>
      <div className="flex gap-6 flex-wrap mb-3">
        <div>
          <div style={{ color: C.textDim, fontSize: sz.stat }}>Upload</div>
          <div className="font-black tabular-nums" style={{ color: C.accent, fontSize: sz.base + 10 }}>
            {up}
            <span style={{ color: C.textDim, fontSize: sz.base, marginLeft: 4 }}>Mbps</span>
          </div>
        </div>
        <div>
          <div style={{ color: C.textDim, fontSize: sz.stat }}>Download</div>
          <div className="font-black tabular-nums" style={{ color: C.blue, fontSize: sz.base + 10 }}>
            {down}
            <span style={{ color: C.textDim, fontSize: sz.base, marginLeft: 4 }}>Mbps</span>
          </div>
        </div>
      </div>
      <div style={{ height: 140 }}>
        {data.length > 2 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sysUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sysDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: sz.base, color: C.text,
                }}
              />
              <Area type="monotone" dataKey="up" stroke={C.accent} fill="url(#sysUp)" strokeWidth={1.5} dot={false} name="Upload" />
              <Area type="monotone" dataKey="down" stroke={C.blue} fill="url(#sysDown)" strokeWidth={1.5} dot={false} name="Download" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 4 }}>
        Last {history.length} samples (~2s each)
      </div>
    </Card>
  )
}
