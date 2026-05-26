import { useEffect, useRef } from "react"
import { useT } from "../../ctx.jsx"
import { useMobile } from "../../hooks/index.js"
import { ConsoleCursor } from "../../components/index.js"
import { PanelHeader } from "./PanelHeader.jsx"

// Live tail of /api/servers/<id>/logs. The backend returns
// { lines: string[], log_dir, total_lines } — plain text lines from
// the engine's console.log. We display them monospaced, with severe
// errors highlighted by simple prefix-matching (the agent doesn't
// pre-classify levels yet).
export function ConsolePanel({ data, onFloat, onHide }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  const ref = useRef(null)
  const scrolledUp = useRef(false)
  const lines = (data?.lines || []).slice(-200)

  // Auto-scroll to bottom unless the user has scrolled away from the tail.
  useEffect(() => {
    if (!ref.current || scrolledUp.current) return
    ref.current.scrollTop = ref.current.scrollHeight
  }, [data])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PanelHeader
        label="Live Console"
        rightSlot={
          <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
            {lines.length} lines
          </span>
        }
        onFloat={onFloat}
        onHide={onHide}
      />
      <div
        ref={ref}
        onScroll={() => {
          if (ref.current) {
            scrolledUp.current =
              ref.current.scrollHeight - ref.current.scrollTop - ref.current.clientHeight > 40
          }
        }}
        className={`rounded-lg overflow-auto leading-[1.8] font-mono py-1 ${mobile ? "" : "flex-1 min-h-0"}`}
        style={{
          background: C.consoleBg,
          border: `1px solid ${C.border}`,
          fontSize: sz.code,
          ...(mobile ? { maxHeight: 200 } : {}),
        }}
      >
        {lines.length === 0 ? (
          <div className="px-3 py-2" style={{ color: C.textMuted }}>
            (no log output yet — start the server)
          </div>
        ) : (
          lines.map((l, i) => {
            const severe = /\b(ERROR|FATAL|CRITICAL)\b/i.test(l)
            const warn = /\b(WARN|WARNING)\b/i.test(l)
            const color = severe ? C.red : warn ? C.orange : C.textDim
            return (
              <div
                key={i}
                className="flex items-start gap-1.5 px-3 py-[2px]"
                style={severe
                  ? { background: "#ff475706", borderLeft: `2px solid ${C.red}` }
                  : { borderLeft: "2px solid transparent" }
                }
              >
                <span className="flex-1 break-words" style={{ color, fontWeight: severe ? 700 : 400 }}>
                  {l}
                </span>
              </div>
            )
          })
        )}
        <ConsoleCursor />
      </div>
    </div>
  )
}
