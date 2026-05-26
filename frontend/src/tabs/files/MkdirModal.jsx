import { useState } from "react"
import { useT } from "../../ctx.jsx"
import { Modal, Btn } from "../../components/index.js"

export default function MkdirModal({ open, onClose, onSubmit, currentPath }) {
  const { C, sz } = useT()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onSubmit(trimmed)
      setName("")
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New folder">
      <div className="flex flex-col gap-3">
        <div style={{ color: C.textDim, fontSize: sz.stat }}>
          Will create inside:{" "}
          <span className="font-mono" style={{ color: C.text }}>
            {currentPath || "/"}
          </span>
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit() }}
          autoFocus
          placeholder="folder-name"
          className="rounded-lg px-3 py-2 outline-none font-mono"
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        />
        <div className="flex justify-end gap-2">
          <Btn v="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Creating..." : "Create"}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
