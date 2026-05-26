import { LVL } from "../constants.js"
import { useT } from "../ctx.jsx"
import { SrcTag } from "./SrcTag.jsx"

// One row of the live console. Extracted from the Dashboard/Console tabs in v1
// where it was inlined. Severe levels get a left border + tinted background.
// onClick lets the parent toggle a source filter (Console tab); omit otherwise.
export function ConsoleRow({ entry, onClick, compact }) {
  const { C, sz } = useT()
  const lv = LVL[entry.level] || LVL.INFO
  const sev = entry.level === "ERROR" || entry.level === "FATAL"
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-1.5 px-3 py-[2px] ${onClick ? "cursor-pointer transition-colors" : ""}`}
      style={sev
        ? { background: "#ff475706", borderLeft: `2px solid ${lv.c}` }
        : { borderLeft: "2px solid transparent" }
      }
    >
      <span className="w-3 text-center shrink-0" style={{ color: lv.c }}>{lv.i}</span>
      {!compact && (
        <span className="shrink-0" style={{ color: C.textMuted, fontSize: sz.code - 1, width: 72 }}>
          {entry.ts}
        </span>
      )}
      <SrcTag source={entry.source} />
      <span
        className="flex-1 break-words"
        style={{
          color: sev ? lv.c : entry.level === "WARN" ? C.orange : C.textDim,
          fontWeight: sev ? 700 : 400,
        }}
      >
        {entry.msg}
      </span>
    </div>
  )
}

// Blink cursor placed at the tail of a console list. Animation is functional
// (mimics a live tail), not a "look at me, I'm an AI" tell — kept per ADR 0003.
export function ConsoleCursor() {
  const { C } = useT()
  return (
    <div className="px-3 py-[2px]">
      <span className="animate-[blink_1s_step-end_infinite]" style={{ color: C.accent }}>_</span>
    </div>
  )
}
