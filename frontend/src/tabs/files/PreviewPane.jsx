import { useEffect, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn } from "../../components/index.js"
import { apiPut, APIError } from "../../api/index.js"

export default function PreviewPane({ file, instanceId, onClose, onSaved, toast }) {
  const { C, sz } = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const taRef = useRef(null)

  // Reset edit state whenever the previewed file changes.
  useEffect(() => {
    setEditing(false)
    setDraft(file?.content ?? "")
  }, [file?.rel_path])

  if (!file) {
    return (
      <div
        className="rounded-xl flex items-center justify-center"
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          color: C.textMuted,
          fontSize: sz.base,
          minHeight: 200,
        }}
      >
        Select a text file to preview.
      </div>
    )
  }

  const dirty = editing && draft !== (file.content ?? "")
  const editable = !file.binary && typeof file.content === "string"

  const startEdit = () => {
    setDraft(file.content ?? "")
    setEditing(true)
    requestAnimationFrame(() => taRef.current?.focus())
  }

  const cancelEdit = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return
    setEditing(false)
    setDraft(file.content ?? "")
  }

  const save = async () => {
    if (instanceId == null) return
    setSaving(true)
    try {
      await apiPut(
        `/api/servers/${instanceId}/files?path=${encodeURIComponent(file.rel_path)}`,
        { content: draft },
      )
      toast?.("Saved", "success")
      setEditing(false)
      onSaved?.({ ...file, content: draft, bytes: new Blob([draft]).size })
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setSaving(false)
    }
  }

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault()
      if (dirty && !saving) save()
    }
    if (e.key === "Escape" && editing) {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div
      className="rounded-xl flex flex-col overflow-hidden"
      style={{ background: C.bgCard, border: `1px solid ${C.border}`, minHeight: 0 }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.bgInput }}
      >
        <span className="font-bold font-mono truncate" style={{ color: C.text, fontSize: sz.base }}>
          {file.rel_path}
        </span>
        <span className="font-mono shrink-0" style={{ color: C.textMuted, fontSize: sz.stat }}>
          {file.bytes} bytes
        </span>
        {dirty && (
          <span
            className="font-bold shrink-0 px-1.5 py-0.5 rounded"
            style={{
              color: C.orange,
              background: C.orange + "18",
              border: `1px solid ${C.orange}40`,
              fontSize: sz.stat - 1,
            }}
          >
            UNSAVED
          </span>
        )}
        <div className="flex-1" />
        {editable && !editing && (
          <Btn small v="ghost" onClick={startEdit}>Edit</Btn>
        )}
        {editing && (
          <>
            <Btn small v="default" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving..." : "Save"}
            </Btn>
            <Btn small v="ghost" onClick={cancelEdit} disabled={saving}>Cancel</Btn>
          </>
        )}
        <Btn small v="ghost" onClick={onClose} disabled={saving}>Close</Btn>
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          className="flex-1 overflow-auto m-0 p-3 font-mono outline-none resize-none"
          style={{
            color: C.text,
            fontSize: sz.code,
            background: C.consoleBg,
            border: "none",
            minHeight: 280,
            maxHeight: "60vh",
            lineHeight: 1.55,
            tabSize: 2,
          }}
        />
      ) : (
        <pre
          className="flex-1 overflow-auto m-0 p-3 font-mono whitespace-pre-wrap"
          style={{
            color: C.text,
            fontSize: sz.code,
            background: C.consoleBg,
            minHeight: 0,
            maxHeight: "60vh",
            lineHeight: 1.55,
          }}
        >
          {file.content}
        </pre>
      )}
    </div>
  )
}
