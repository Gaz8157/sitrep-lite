import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { useFetch } from "../../hooks/index.js"

// DiagnosticsBanner polls /api/servers/:id/diagnostics every 5s while the
// server is running and renders a red banner when the engine has logged a
// script-module or mission-load failure. The dismiss is in-memory only —
// next remount (tab switch / refresh) will re-show if the failure is still
// in the latest log. Matches v1's behaviour.
export function DiagnosticsBanner({ instanceId, serverRunning }) {
  const { C, sz } = useT()
  const url = (instanceId != null && serverRunning)
    ? `/api/servers/${instanceId}/diagnostics`
    : null
  const { data } = useFetch(url, 5000)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissal when the failure changes — if a new failure crops up
  // after the operator dismissed an old one, surface it again.
  const sigKey = data ? JSON.stringify({
    s: data.script_module_failed,
    m: data.mission_load_failed,
    sm: data.script_module_messages?.[0] ?? "",
    mm: data.mission_load_messages?.[0] ?? "",
  }) : ""
  useEffect(() => { setDismissed(false) }, [sigKey])

  if (!data) return null
  if (!data.script_module_failed && !data.mission_load_failed) return null
  if (dismissed) return null

  const scriptMsgs = (data.script_module_messages || []).slice(-2)
  const missionMsgs = (data.mission_load_messages || []).slice(-2)

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2"
      style={{
        background: C.redBg,
        border: `1px solid ${C.redBorder}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="font-black uppercase tracking-wider"
          style={{ color: C.red, fontSize: sz.label }}
        >
          {data.script_module_failed && data.mission_load_failed
            ? "Server startup errors"
            : data.script_module_failed
              ? "Script module failed to load"
              : "Mission failed to load"}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setDismissed(true)}
          className="rounded px-2 py-0.5 font-bold cursor-pointer leading-none"
          aria-label="Dismiss"
          style={{
            background: `${C.red}18`,
            border: `1px solid ${C.red}50`,
            color: C.red,
            fontSize: sz.stat,
          }}
        >
          ×
        </button>
      </div>

      {data.script_module_failed && (
        <Section
          title="Script module"
          messages={scriptMsgs}
          C={C}
          sz={sz}
        />
      )}
      {data.mission_load_failed && (
        <Section
          title="Mission load"
          messages={missionMsgs}
          C={C}
          sz={sz}
        />
      )}
    </div>
  )
}

function Section({ title, messages, C, sz }) {
  if (!messages || messages.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-bold uppercase tracking-wider"
        style={{ color: C.red, fontSize: sz.stat, opacity: 0.9 }}
      >
        {title}
      </span>
      <div
        className="rounded px-2 py-1.5 font-mono whitespace-pre-wrap break-all"
        style={{
          background: `${C.red}10`,
          color: C.red,
          fontSize: sz.stat,
          lineHeight: 1.5,
        }}
      >
        {messages.join("\n")}
      </div>
    </div>
  )
}
