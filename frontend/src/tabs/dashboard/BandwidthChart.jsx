import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts"
import { useT } from "../../ctx.jsx"
import { useMobile } from "../../hooks/index.js"
import { Card } from "../../components/index.js"
import { PanelHeader } from "./PanelHeader.jsx"

// Up/Down area chart for the host's network rate.
// `latest` is the most recent system_metrics response so we can show
// the current numeric values below the chart.
export function BandwidthChart({ data, latest, onFloat, onHide }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  const rate = latest?.network_rate || { up_mbps: 0, down_mbps: 0 }
  return (
    <Card className="p-4 flex-1">
      <PanelHeader label="Host Bandwidth" onFloat={onFloat} onHide={onHide} />
      <ResponsiveContainer width="100%" height={mobile ? 80 : 110}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="upG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dnG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: sz.base, color: C.text,
            }}
          />
          <Area type="monotone" dataKey="up" stroke={C.accent} fill="url(#upG)" strokeWidth={1.5} dot={false} name="Up" />
          <Area type="monotone" dataKey="down" stroke={C.blue} fill="url(#dnG)" strokeWidth={1.5} dot={false} name="Down" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1">
        <span className="font-bold" style={{ color: C.accent, fontSize: sz.stat }}>
          Up {rate.up_mbps} Mbps
        </span>
        <span className="font-bold" style={{ color: C.blue, fontSize: sz.stat }}>
          Down {rate.down_mbps} Mbps
        </span>
      </div>
    </Card>
  )
}
