import { useT } from "../../ctx.jsx"

export default function Breadcrumb({ instance, path, onNavigate }) {
  const { C, sz } = useT()
  const parts = path ? path.split("/").filter(Boolean) : []
  const root = instance?.display_name || instance?.name || "instance"

  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0">
      <button
        onClick={() => onNavigate("")}
        className="font-bold cursor-pointer px-2 py-1 rounded-md"
        style={{
          background: parts.length === 0 ? C.accentBg : "transparent",
          color: parts.length === 0 ? C.accent : C.textDim,
          fontSize: sz.nav,
          border: `1px solid ${parts.length === 0 ? C.accent + "30" : "transparent"}`,
        }}
      >
        {root}/
      </button>
      {parts.map((p, i) => {
        const sub = parts.slice(0, i + 1).join("/")
        const last = i === parts.length - 1
        return (
          <div key={i} className="flex items-center">
            <button
              onClick={() => onNavigate(sub)}
              className="font-bold cursor-pointer px-2 py-1 rounded-md"
              style={{
                background: last ? C.accentBg : "transparent",
                color: last ? C.accent : C.textDim,
                fontSize: sz.nav,
                border: `1px solid ${last ? C.accent + "30" : "transparent"}`,
              }}
            >
              {p}
            </button>
            {!last && (
              <span style={{ color: C.textMuted, fontSize: sz.nav }}>/</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
