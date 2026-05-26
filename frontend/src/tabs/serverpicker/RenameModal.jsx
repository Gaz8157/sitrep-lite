import { useState, useEffect } from "react"
import { apiPatch, APIError } from "../../api/index.js"
import { useT } from "../../ctx.jsx"
import { Btn, Modal, Input } from "../../components/index.js"

const MAX_LEN = 64

export function RenameModal({ instance, onClose, onSaved, toast }) {
  const { C, sz } = useT()
  const initial = instance?.display_name || instance?.name || ""
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setValue(instance?.display_name || instance?.name || "")
    setError(null)
  }, [instance?.id, instance?.instance_id])

  if (!instance) return null

  const id = instance.id ?? instance.instance_id
  const trimmed = value.trim()
  const tooLong = trimmed.length > MAX_LEN
  const unchanged = trimmed === (instance.display_name || instance.name || "").trim()
  const disabled = saving || trimmed.length === 0 || tooLong || unchanged

  const submit = async () => {
    if (disabled) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiPatch(`/api/servers/${id}`, { display_name: trimmed })
      onSaved?.(updated)
      toast?.(`Renamed to "${updated.display_name}"`, "success")
      onClose?.()
    } catch (e) {
      const msg = e instanceof APIError ? (e.detail?.message || e.message) : String(e)
      setError(msg || "Rename failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!instance} onClose={saving ? () => {} : onClose}
           title={`Rename instance #${id}`}>
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div style={{ color: C.text, fontSize: sz.base, lineHeight: 1.5, marginBottom: 12 }}>
          Change the label shown in the panel sidebar, dashboard header, and
          breadcrumbs. The in-game server-browser name is edited in the
          Config tab.
        </div>
        <Input
          label="Display name"
          value={value}
          onChange={setValue}
          placeholder="e.g. Test Main"
        />
        <div style={{ color: tooLong ? C.red : C.textMuted, fontSize: sz.stat - 1, marginTop: -4, marginBottom: 8 }}>
          {trimmed.length}/{MAX_LEN}
        </div>
        {error && (
          <div style={{ color: C.red, fontSize: sz.stat, marginBottom: 8 }}>
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Btn small v="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn onClick={submit} disabled={disabled}>
            {saving ? "Saving…" : "Save"}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}
