import { memo } from "react"
import { useT } from "../../ctx.jsx"
import { useThumbnail } from "../../hooks/index.js"

const WORKSHOP_BASE = "https://reforger.armaplatform.com/workshop/"

function fmtSize(s) {
  if (!s || s <= 0) return ""
  if (s >= 1048576) return `${(s / 1048576).toFixed(0)} MB`
  if (s >= 1024) return `${(s / 1024).toFixed(0)} KB`
  return ""
}

function fmtDL(n) {
  if (!n || n <= 0) return ""
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function ModCardImpl({ mod, installed, onClick, dense }) {
  const { C, sz } = useT()
  const { ref, src } = useThumbnail(mod.id)
  const size = fmtSize(mod.size || 0)
  const dl = fmtDL(mod.subscribers || 0)
  const initial = (mod.name || mod.id || "?")[0]?.toUpperCase() || "?"

  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden cursor-pointer flex flex-col"
      style={{
        background: C.bgCard,
        border: `1px solid ${installed ? C.accent + "50" : C.border}`,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-3px)"
        e.currentTarget.style.boxShadow = `0 8px 24px ${C.accent}15`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ""
        e.currentTarget.style.boxShadow = ""
      }}
    >
      <div
        ref={ref}
        className="relative overflow-hidden shrink-0"
        style={{ paddingTop: "56.25%", background: C.bgInput }}
      >
        {src ? (
          <img
            src={src}
            alt={mod.name || mod.id}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={e => { e.currentTarget.style.display = "none" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center font-black"
            style={{ color: C.textMuted, fontSize: 28 }}
          >
            {initial}
          </div>
        )}
        {installed && (
          <div
            className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md font-black"
            style={{ background: C.accent, color: "#000", fontSize: 8, letterSpacing: 1 }}
          >
            ON SERVER
          </div>
        )}
        {size && (
          <div
            className="absolute top-2 right-2 px-2 py-1 rounded-md font-mono font-bold"
            style={{ background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: sz.stat }}
          >
            {size}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div
          className="font-bold truncate mb-0.5"
          style={{ color: C.text, fontSize: sz.base }}
          title={mod.name || mod.id}
        >
          {mod.name || mod.id}
        </div>
        {mod.author ? (
          <div
            className="truncate mb-1.5"
            style={{ color: C.textMuted, fontSize: sz.stat }}
          >
            by {mod.author}
          </div>
        ) : (
          <div style={{ height: sz.stat + 4 }} />
        )}
        <div
          className="flex items-center justify-between"
          style={{ fontSize: sz.stat }}
        >
          {dl ? (
            <span style={{ color: C.textDim }}>{dl} DL</span>
          ) : <span />}
          {mod.rating > 0 ? (
            <span style={{ color: C.orange }}>{mod.rating}/5</span>
          ) : <span />}
          {mod.version ? (
            <span className="font-mono" style={{ color: C.textMuted }}>
              v{mod.version}
            </span>
          ) : <span />}
        </div>
        {!dense && (
          <a
            href={WORKSHOP_BASE + mod.id}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1 font-bold"
            style={{
              color: C.accent,
              fontSize: sz.stat,
              textDecoration: "none",
            }}
          >
            ↗ View on Workshop
          </a>
        )}
      </div>
    </div>
  )
}

export const ModCard = memo(ModCardImpl, (prev, next) => {
  return (
    prev.mod === next.mod &&
    prev.installed === next.installed &&
    prev.dense === next.dense &&
    prev.onClick === next.onClick
  )
})

export default ModCard
