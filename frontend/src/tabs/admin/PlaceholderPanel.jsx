import { useT } from "../../ctx.jsx"

export default function PlaceholderPanel({ name }) {
  const { C, sz } = useT()
  return (
    <div style={{
      padding: 32, textAlign: "center",
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 14, color: C.textMuted, fontSize: sz.base,
    }}>
      <div style={{ fontWeight: 800, color: C.textBright, fontSize: sz.base + 2, marginBottom: 8 }}>
        {name}
      </div>
      Coming in the next Admin tab rollout.
    </div>
  )
}
