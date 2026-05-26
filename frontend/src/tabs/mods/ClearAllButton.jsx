import { useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn, Modal } from "../../components/index.js"

export default function ClearAllButton({ instanceId, count, onCleared, toast }) {
  const { C, sz } = useT()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const confirm = async () => {
    if (submitting || instanceId == null) return
    setSubmitting(true)
    try {
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      const before = Array.isArray(next?.game?.mods) ? next.game.mods.length : 0
      if (!next.game) next.game = {}
      next.game.mods = []
      await apiPut(`/api/servers/${instanceId}/config`, next)
      toast?.(`Cleared ${before} mod${before === 1 ? "" : "s"}`, "warning")
      setOpen(false)
      onCleared?.()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Btn small v="danger" onClick={() => setOpen(true)} disabled={!count}>
        Clear all mods
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Clear all mods?">
        <div style={{ color: C.text, fontSize: sz.base, lineHeight: 1.5 }}>
          Remove all <strong>{count}</strong> mod{count === 1 ? "" : "s"} from
          the server config. Reforger will not load them on the next start.
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Btn small v="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Btn>
          <Btn v="danger" onClick={confirm} disabled={submitting}>
            {submitting ? "Clearing..." : "Clear all"}
          </Btn>
        </div>
      </Modal>
    </>
  )
}
