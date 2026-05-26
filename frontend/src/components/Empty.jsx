import { Card } from "./Card.jsx"
import { useT } from "../ctx.jsx"

export function Empty({ title, sub }) {
  const { C, sz } = useT()
  return (
    <Card className="p-12 text-center">
      <div className="mb-1" style={{ color: C.textDim, fontSize: sz.base + 2 }}>
        {title}
      </div>
      {sub && (
        <div style={{ color: C.textMuted, fontSize: sz.base }}>{sub}</div>
      )}
    </Card>
  )
}
