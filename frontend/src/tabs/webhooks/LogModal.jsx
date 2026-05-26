import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn, Modal } from "../../components/index.js"
import { apiGet, APIError } from "../../api/index.js"
import { fmtTimestamp } from "./util.js"

export default function LogModal({ open, onClose, instanceId, webhook, toast }) {
  const { C, sz } = useT()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !webhook?.id) return
    let alive = true
    setLoading(true)
    apiGet(`/api/servers/${instanceId}/webhooks/${webhook.id}/log?limit=50`)
      .then(r => { if (alive) setRows(r.log || []) })
      .catch(e => {
        if (!alive) return
        toast?.(e instanceof APIError ? e.message : String(e), "danger")
        setRows([])
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, webhook?.id, instanceId, toast])

  return (
    <Modal open={open} onClose={onClose} title={`Log — ${webhook?.name || ""}`}>
      {loading ? (
        <div style={{ color: C.textMuted, fontSize: sz.base }}>Loading log…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: C.textMuted, fontSize: sz.base }}>No firings recorded yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-96 overflow-auto">
          {rows.map(r => {
            const isErr = !r.status?.startsWith("ok")
            return (
              <div
                key={r.id}
                className="rounded-lg p-2.5 flex items-center gap-3 flex-wrap"
                style={{
                  background: isErr ? C.redBg : C.bgInput,
                  border: `1px solid ${isErr ? C.redBorder : C.border}`,
                  fontSize: sz.stat,
                }}
              >
                <span className="font-mono" style={{ color: C.textDim }}>{fmtTimestamp(r.fired_at)}</span>
                <span className="font-bold" style={{ color: isErr ? C.red : C.accent }}>{r.event}</span>
                <span style={{ color: isErr ? C.red : C.text }}>{r.status}</span>
                {r.response_code != null && (
                  <span style={{ color: C.textMuted }}>HTTP {r.response_code}</span>
                )}
                {r.body_excerpt && (
                  <span
                    className="truncate font-mono"
                    style={{ color: C.textMuted, fontSize: sz.stat - 1, maxWidth: "100%" }}
                    title={r.body_excerpt}
                  >
                    {r.body_excerpt}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex justify-end mt-3">
        <Btn v="ghost" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  )
}
