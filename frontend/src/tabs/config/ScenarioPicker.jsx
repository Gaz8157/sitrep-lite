import { useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { VANILLA_SCENARIOS } from "../../constants.js"

// Scenario picker — built-in scenario list grouped by game mode, with
// a "custom" tab for paste-your-own. Built-in coverage from constants.js.
export default function ScenarioPicker({ value, onChange }) {
  const { C, sz } = useT()
  const [mode, setMode] = useState(() =>
    VANILLA_SCENARIOS.find(s => s.id === value) ? "builtin" : "custom"
  )
  const [customValue, setCustomValue] = useState(value || "")

  const grouped = useMemo(() => {
    const m = {}
    for (const s of VANILLA_SCENARIOS) {
      const k = s.mode || "Other"
      if (!m[k]) m[k] = []
      m[k].push(s)
    }
    return m
  }, [])

  const matchedLabel = useMemo(() => {
    const hit = VANILLA_SCENARIOS.find(s => s.id === value)
    return hit ? hit.label : null
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      <label
        className="font-bold uppercase tracking-wide"
        style={{ color: C.textDim, fontSize: sz.label }}
      >
        Scenario
      </label>
      <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        {["builtin", "custom"].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="px-3 py-1.5 font-bold cursor-pointer"
            style={{
              background: mode === m ? C.accentBg : "transparent",
              color: mode === m ? C.accent : C.textDim,
              fontSize: sz.label,
            }}
          >
            {m === "builtin" ? "Built-in" : "Custom"}
          </button>
        ))}
      </div>
      {mode === "builtin" ? (
        <select
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg px-3 py-2 outline-none cursor-pointer"
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        >
          <option value="" disabled>Select a scenario...</option>
          {Object.entries(grouped).map(([modeName, list]) => (
            <optgroup key={modeName} label={modeName}>
              {list.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={customValue}
          onChange={e => {
            setCustomValue(e.target.value)
            onChange(e.target.value)
          }}
          placeholder="{GUID}Missions/My_Scenario.conf"
          spellCheck={false}
          className="w-full rounded-lg px-3 py-2 outline-none font-mono placeholder:opacity-30"
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        />
      )}
      {matchedLabel && mode === "builtin" && (
        <span style={{ color: C.textMuted, fontSize: sz.label }}>
          Matched: {matchedLabel}
        </span>
      )}
      {mode === "custom" && (
        <span style={{ color: C.textMuted, fontSize: sz.label }}>
          Format: <span style={{ fontFamily: "monospace" }}>{"{16-hex-GUID}Missions/Name.conf"}</span>
        </span>
      )}
    </div>
  )
}
