import { useT } from "../../ctx.jsx"

// Inline error list — shown below the textarea after a validate / save.
export default function ValidationList({ errors, parseError }) {
  const { C, sz } = useT()

  if (parseError) {
    return (
      <div
        className="rounded-lg px-3 py-2 mt-2"
        style={{
          background: C.redBg,
          border: `1px solid ${C.redBorder}`,
          color: C.red,
          fontSize: sz.base,
        }}
      >
        <span className="font-bold">JSON syntax error: </span>
        {parseError}
      </div>
    )
  }

  if (!errors || errors.length === 0) return null

  return (
    <div
      className="rounded-lg p-3 mt-2 flex flex-col gap-1"
      style={{
        background: C.redBg,
        border: `1px solid ${C.redBorder}`,
      }}
    >
      <div
        className="font-black uppercase tracking-wide"
        style={{ color: C.red, fontSize: sz.label }}
      >
        Schema errors ({errors.length})
      </div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {errors.map((e, i) => (
          <li
            key={i}
            style={{ color: C.red, fontSize: sz.base, lineHeight: 1.5 }}
          >
            <span className="font-mono font-bold">{e.path}</span>
            {": "}
            <span>{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
