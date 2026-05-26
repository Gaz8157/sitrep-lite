import { useT } from "../../ctx.jsx"
import { Badge, Btn, Card } from "../../components/index.js"
import { relativeTime, truncateUrl } from "./util.js"

const KIND_LABEL = { discord: "Discord", slack: "Slack", generic: "HTTP" }
const KIND_VARIANT = { discord: "info", slack: "warning", generic: "default" }

export default function WebhookCard({ hook, busy, onToggle, onEdit, onTest, onDelete, onShowLog }) {
  const { C, sz } = useT()
  const ok = hook.last_status === "ok"
  const errored = hook.last_status && !ok
  const indicatorColor = !hook.last_fired_at
    ? C.textMuted
    : ok
      ? C.accent
      : C.red

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: indicatorColor }}
          title={hook.last_status || "never fired"}
        />
        <div className="font-bold truncate" style={{ color: C.text, fontSize: sz.base + 1 }}>
          {hook.name}
        </div>
        <Badge text={KIND_LABEL[hook.kind] || hook.kind} v={KIND_VARIANT[hook.kind] || "default"} />
        <Badge text={hook.enabled ? "ON" : "OFF"} v={hook.enabled ? "default" : "dim"} />
        <div className="flex-1" />
        <Btn small v="ghost" onClick={onShowLog} disabled={busy}>Log</Btn>
        <Btn small v="info" onClick={onTest} disabled={busy}>Test</Btn>
        <Btn small v="ghost" onClick={onEdit} disabled={busy}>Edit</Btn>
        <Btn small v={hook.enabled ? "warning" : "default"} onClick={onToggle} disabled={busy}>
          {hook.enabled ? "Disable" : "Enable"}
        </Btn>
        <Btn small v="danger" onClick={onDelete} disabled={busy}>Delete</Btn>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <div
          className="font-mono px-2 py-1 rounded truncate"
          style={{
            background: C.bgInput,
            color: C.textDim,
            fontSize: sz.stat,
            maxWidth: "100%",
          }}
          title={hook.url}
        >
          {truncateUrl(hook.url, 80)}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {(hook.events || []).map(ev => (
          <span
            key={ev}
            className="px-2 py-0.5 rounded font-bold"
            style={{
              background: C.accentBg,
              color: C.accent,
              fontSize: sz.stat,
              border: `1px solid ${C.accent}30`,
            }}
          >
            {ev}
          </span>
        ))}
      </div>

      {hook.last_fired_at && (
        <div className="mt-2 flex items-center gap-2" style={{ fontSize: sz.stat }}>
          <span style={{ color: C.textMuted }}>Last fired:</span>
          <span style={{ color: errored ? C.red : C.textDim }}>{relativeTime(hook.last_fired_at)}</span>
          {hook.last_status && (
            <span style={{ color: errored ? C.red : C.accent }}>· {hook.last_status}</span>
          )}
        </div>
      )}
    </Card>
  )
}
