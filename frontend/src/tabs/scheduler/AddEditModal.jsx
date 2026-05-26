import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn, Modal } from "../../components/index.js"
import { ACTIONS, PRESETS, isCronExprPlausible } from "./util.js"

const EMPTY = { name: "", cron_expr: "0 3 * * *", action: "restart", payload: "" }

export default function AddEditModal({ open, onClose, onSave, existing, busy }) {
  const { C, sz } = useT()
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        name: existing.name || "",
        cron_expr: existing.cron_expr || "0 3 * * *",
        action: existing.action || "restart",
        payload: existing.payload || "",
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, existing])

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const cronOk = isCronExprPlausible(form.cron_expr)
  const requirePayload = form.action === "say"
  const payloadOk = !requirePayload || form.payload.trim().length > 0
  const canSave = form.name.trim() && cronOk && payloadOk

  const applyPreset = (p) => {
    setForm({
      name: p.name,
      cron_expr: p.cron,
      action: p.action,
      payload: p.payload || "",
    })
  }

  const save = () => {
    if (!canSave) return
    onSave({
      name: form.name.trim(),
      cron_expr: form.cron_expr.trim(),
      action: form.action,
      payload: requirePayload ? form.payload : (form.payload || null),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit job" : "Add scheduled job"}>
      <div className="flex flex-col gap-3">
        {!existing && (
          <div>
            <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
              Presets
            </div>
            <div className="flex flex-col gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-left px-2.5 py-1.5 rounded cursor-pointer"
                  style={{
                    background: C.bgInput,
                    border: `1px solid ${C.border}`,
                    color: C.textDim,
                    fontSize: sz.stat,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent + "60")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                >
                  <span className="font-bold" style={{ color: C.text }}>{p.label}</span>
                  <span className="ml-2 font-mono" style={{ color: C.accent }}>{p.cron}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            Name
          </div>
          <input
            type="text"
            value={form.name}
            onChange={e => setField("name", e.target.value)}
            placeholder="Daily restart"
            className="w-full rounded-lg px-3 py-2.5 outline-none"
            style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
          />
        </label>

        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            Action
          </div>
          <div className="flex gap-2 flex-wrap">
            {ACTIONS.map(a => {
              const active = form.action === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setField("action", a.id)}
                  className="px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                  style={{
                    background: active ? C.accentBg : "transparent",
                    color: active ? C.accent : C.textDim,
                    border: `1px solid ${active ? C.accent + "60" : C.border}`,
                    fontSize: sz.stat,
                  }}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </label>

        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            Cron expression (UTC) <span className="font-mono" style={{ color: C.textMuted }}>min hour dom mon dow</span>
          </div>
          <input
            type="text"
            value={form.cron_expr}
            onChange={e => setField("cron_expr", e.target.value)}
            placeholder="0 3 * * *"
            className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
            style={{
              background: C.bgInput,
              border: `1px solid ${form.cron_expr && !cronOk ? C.red + "60" : C.border}`,
              color: C.text,
              fontSize: sz.input,
            }}
          />
          {form.cron_expr && !cronOk && (
            <div className="mt-1" style={{ color: C.red, fontSize: sz.stat }}>
              Cron expression must have 5 fields (server validates the rest).
            </div>
          )}
        </label>

        {requirePayload && (
          <label className="block">
            <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
              Message
            </div>
            <textarea
              value={form.payload}
              onChange={e => setField("payload", e.target.value)}
              placeholder="Server restarts in 5 minutes"
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 outline-none"
              style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
            />
            {!payloadOk && (
              <div className="mt-1" style={{ color: C.red, fontSize: sz.stat }}>
                Required for &apos;say&apos; action.
              </div>
            )}
          </label>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Btn v="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn onClick={save} disabled={!canSave || busy}>{existing ? "Save" : "Create"}</Btn>
        </div>
      </div>
    </Modal>
  )
}
