import { useT } from "../../ctx.jsx"
import { Btn } from "../../components/index.js"

export default function TrackerControls({
  onClear,
  persistEnabled,
  onTogglePersist,
  persistLabel = "Persist to disk",
  persistHelp,
  busy,
  extras,
}) {
  const { C, sz } = useT()
  return (
    <div
      className="flex items-center justify-between gap-3 flex-wrap"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <PersistCheckbox
          checked={!!persistEnabled}
          onChange={onTogglePersist}
          label={persistLabel}
          help={persistHelp}
          C={C}
          sz={sz}
          disabled={busy}
        />
        {extras}
      </div>
      <div className="flex items-center gap-2">
        <Btn small v="ghost" onClick={onClear} disabled={busy}>
          Clear buffer
        </Btn>
      </div>
    </div>
  )
}

function PersistCheckbox({ checked, onChange, label, help, C, sz, disabled }) {
  return (
    <label
      className="flex items-center gap-2"
      style={{
        cursor: disabled ? "default" : "pointer",
        userSelect: "none",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        onClick={(e) => {
          if (disabled) return
          e.preventDefault()
          onChange(!checked)
        }}
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1px solid ${checked ? C.accent : C.border}`,
          background: checked ? C.accentBg : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 120ms",
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polyline
              points="1.5,5 4,7.5 8.5,2.5"
              fill="none"
              stroke={C.accent}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span style={{ color: C.text, fontSize: sz.label, fontWeight: 700 }}>
        {label}
      </span>
      {help && (
        <span style={{ color: C.textMuted, fontSize: sz.label - 1 }}>
          ({help})
        </span>
      )}
    </label>
  )
}
