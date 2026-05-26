import { useT } from "../../ctx.jsx"
import { Badge, Btn, Card } from "../../components/index.js"
import { actionVariant, fmtTimestamp, relativeTime } from "./util.js"

export default function JobCard({ job, busy, onToggle, onEdit, onRun, onDelete, onShowLog }) {
  const { C, sz } = useT()
  const ok = job.last_status === "ok"
  const errored = job.last_status && !ok
  const indicatorColor = !job.last_run_at
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
          title={job.last_status || "never run"}
        />
        <div className="font-bold truncate" style={{ color: C.text, fontSize: sz.base + 1 }}>
          {job.name}
        </div>
        <Badge text={job.action} v={actionVariant(job.action)} />
        <Badge text={job.enabled ? "ON" : "OFF"} v={job.enabled ? "default" : "dim"} />
        <div className="flex-1" />
        <Btn small v="ghost" onClick={onShowLog} disabled={busy}>Log</Btn>
        <Btn small v="info" onClick={onRun} disabled={busy}>Run</Btn>
        <Btn small v="ghost" onClick={onEdit} disabled={busy}>Edit</Btn>
        <Btn small v={job.enabled ? "warning" : "default"} onClick={onToggle} disabled={busy}>
          {job.enabled ? "Disable" : "Enable"}
        </Btn>
        <Btn small v="danger" onClick={onDelete} disabled={busy}>Delete</Btn>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className="font-mono px-2 py-0.5 rounded"
          style={{ background: C.accentBg, color: C.accent, fontSize: sz.stat, border: `1px solid ${C.accent}30` }}
        >
          {job.cron_expr}
        </span>
        {job.next_run_at && (
          <span style={{ color: C.textMuted, fontSize: sz.stat }}>
            Next: <span style={{ color: C.text }}>{fmtTimestamp(job.next_run_at)}</span>{" "}
            <span style={{ color: C.textDim }}>({relativeTime(job.next_run_at)})</span>
          </span>
        )}
      </div>

      {job.action === "say" && job.payload && (
        <div
          className="mt-2 px-2 py-1 rounded font-mono truncate"
          style={{ background: C.bgInput, color: C.textDim, fontSize: sz.stat, border: `1px solid ${C.border}` }}
          title={job.payload}
        >
          “{job.payload}”
        </div>
      )}

      {job.last_run_at && (
        <div className="mt-2 flex items-center gap-2" style={{ fontSize: sz.stat }}>
          <span style={{ color: C.textMuted }}>Last run:</span>
          <span style={{ color: errored ? C.red : C.textDim }}>{fmtTimestamp(job.last_run_at)}</span>
          {job.last_status && (
            <span style={{ color: errored ? C.red : C.accent }}>· {job.last_status}</span>
          )}
        </div>
      )}
    </Card>
  )
}
