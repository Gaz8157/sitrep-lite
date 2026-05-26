import { useCallback, useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPatch, apiDelete, APIError } from "../../api/index.js"
import { Btn, Empty } from "../../components/index.js"
import AddEditModal from "./AddEditModal.jsx"
import WebhookCard from "./WebhookCard.jsx"
import LogModal from "./LogModal.jsx"

export default function Webhooks({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id

  const [hooks, setHooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // null | {} | hook
  const [showAdd, setShowAdd] = useState(false)
  const [logTarget, setLogTarget] = useState(null)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const r = await apiGet(`/api/servers/${id}/webhooks`)
      setHooks(Array.isArray(r.webhooks) ? r.webhooks : [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const create = async (body) => {
    setBusy(true)
    try {
      await apiPost(`/api/servers/${id}/webhooks`, body)
      setShowAdd(false)
      toast?.("Webhook created")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const update = async (hook, fields) => {
    setBusy(true)
    try {
      await apiPatch(`/api/servers/${id}/webhooks/${hook.id}`, fields)
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async (body) => {
    if (!editing?.id) return
    setBusy(true)
    try {
      await apiPatch(`/api/servers/${id}/webhooks/${editing.id}`, body)
      setEditing(null)
      toast?.("Saved")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (hook) => {
    if (!window.confirm(`Delete webhook "${hook.name}"?`)) return
    setBusy(true)
    try {
      await apiDelete(`/api/servers/${id}/webhooks/${hook.id}`)
      toast?.("Deleted", "warning")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const test = async (hook) => {
    setBusy(true)
    try {
      const r = await apiPost(`/api/servers/${id}/webhooks/${hook.id}/test`)
      if (r.status === "ok") {
        toast?.(`Test fired — HTTP ${r.response_code ?? "?"}`)
      } else {
        toast?.(`Test failed: ${r.status}`, "danger")
      }
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  if (id == null) {
    return (
      <div style={{ padding: 24, color: C.textDim, fontSize: sz.base }}>
        No instance selected.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2
          className="font-black uppercase tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
        >
          Webhooks
          <span
            className="ml-3 px-2 py-0.5 rounded font-bold"
            style={{
              background: C.bgInput, color: C.textDim, fontSize: sz.label,
              border: `1px solid ${C.border}`,
            }}
          >
            {hooks.length}
          </span>
        </h2>
        <div className="flex gap-2">
          <Btn small v="ghost" onClick={load} disabled={loading || busy}>
            {loading ? "Loading…" : "Refresh"}
          </Btn>
          <Btn onClick={() => setShowAdd(true)} disabled={busy}>+ Add</Btn>
        </div>
      </div>

      <div
        className="rounded-lg px-3 py-2"
        style={{
          background: C.blueBg,
          border: `1px solid ${C.blue}40`,
          color: C.blue,
          fontSize: sz.label,
        }}
      >
        Lifecycle events <strong>server.start</strong> and <strong>server.stop</strong> fire automatically. Other
        events (player/chat) are accepted now but only emit once the log scraper is wired up.
      </div>

      {loading && hooks.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 16, fontSize: sz.base }}>Loading webhooks…</div>
      ) : hooks.length === 0 ? (
        <Empty
          title="No webhooks"
          sub="Click + Add to wire up Discord/Slack/generic HTTP notifications."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {hooks.map(h => (
            <WebhookCard
              key={h.id}
              hook={h}
              busy={busy}
              onToggle={() => update(h, { enabled: !h.enabled })}
              onEdit={() => setEditing(h)}
              onTest={() => test(h)}
              onDelete={() => remove(h)}
              onShowLog={() => setLogTarget(h)}
            />
          ))}
        </div>
      )}

      <AddEditModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={create}
        existing={null}
        busy={busy}
      />
      <AddEditModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        existing={editing}
        busy={busy}
      />
      <LogModal
        open={!!logTarget}
        onClose={() => setLogTarget(null)}
        instanceId={id}
        webhook={logTarget}
        toast={toast}
      />
    </div>
  )
}
