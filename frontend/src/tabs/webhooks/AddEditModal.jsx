import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn, Modal } from "../../components/index.js"
import { KIND_OPTIONS, SUPPORTED_EVENTS, FIRING_EVENTS, isValidHttpUrl } from "./util.js"

const EMPTY = { name: "", url: "", kind: "discord", events: ["server.start", "server.stop"] }

export default function AddEditModal({ open, onClose, onSave, existing, busy }) {
  const { C, sz } = useT()
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        name: existing.name || "",
        url: existing.url || "",
        kind: existing.kind || "discord",
        events: Array.isArray(existing.events) ? [...existing.events] : [],
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, existing])

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleEvent = (e) =>
    setForm(p => ({
      ...p,
      events: p.events.includes(e) ? p.events.filter(x => x !== e) : [...p.events, e],
    }))

  const urlOk = isValidHttpUrl(form.url)
  const canSave = form.name.trim() && urlOk && form.events.length > 0

  const save = () => {
    if (!canSave) return
    onSave({
      name: form.name.trim(),
      url: form.url.trim(),
      kind: form.kind,
      events: form.events,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit webhook" : "Add webhook"}>
      <div className="flex flex-col gap-3">
        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            Name
          </div>
          <input
            type="text"
            value={form.name}
            onChange={e => setField("name", e.target.value)}
            placeholder="Discord — alerts"
            className="w-full rounded-lg px-3 py-2.5 outline-none"
            style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
          />
        </label>

        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            Kind
          </div>
          <div className="flex gap-2 flex-wrap">
            {KIND_OPTIONS.map(k => {
              const active = form.kind === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setField("kind", k.id)}
                  className="px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                  style={{
                    background: active ? C.accentBg : "transparent",
                    color: active ? C.accent : C.textDim,
                    border: `1px solid ${active ? C.accent + "60" : C.border}`,
                    fontSize: sz.stat,
                  }}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </label>

        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            URL
          </div>
          <input
            type="text"
            value={form.url}
            onChange={e => setField("url", e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
            style={{
              background: C.bgInput,
              border: `1px solid ${form.url && !urlOk ? C.red + "60" : C.border}`,
              color: C.text,
              fontSize: sz.input,
            }}
          />
          {form.url && !urlOk && (
            <div className="mt-1" style={{ color: C.red, fontSize: sz.stat }}>
              URL must start with http:// or https://
            </div>
          )}
        </label>

        <label className="block">
          <div className="font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
            Events
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {SUPPORTED_EVENTS.map(ev => {
              const on = form.events.includes(ev)
              const wired = FIRING_EVENTS.has(ev)
              return (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className="px-2.5 py-1 rounded font-bold cursor-pointer"
                  style={{
                    background: on ? C.accentBg : "transparent",
                    color: on ? C.accent : (wired ? C.textDim : C.textMuted),
                    border: `1px solid ${on ? C.accent + "60" : C.border}`,
                    fontSize: sz.stat,
                  }}
                  title={wired ? "Wired up — will fire on lifecycle event" : "Subscribed, but no event emitter yet"}
                >
                  {ev}
                  {!wired && (
                    <span
                      className="ml-1"
                      style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                    >
                      (soon)
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-1.5" style={{ color: C.textMuted, fontSize: sz.stat }}>
            <span style={{ color: C.accent }}>server.start</span> and{" "}
            <span style={{ color: C.accent }}>server.stop</span> fire on every lifecycle action. Other events are
            queued for upcoming releases.
          </div>
        </label>

        <div className="flex justify-end gap-2 mt-2">
          <Btn v="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn onClick={save} disabled={!canSave || busy}>{existing ? "Save" : "Create"}</Btn>
        </div>
      </div>
    </Modal>
  )
}
