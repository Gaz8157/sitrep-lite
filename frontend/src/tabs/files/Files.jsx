import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiDelete, apiPost, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"
import Breadcrumb from "./Breadcrumb.jsx"
import FileTable from "./FileTable.jsx"
import PreviewPane from "./PreviewPane.jsx"
import MkdirModal from "./MkdirModal.jsx"

export default function Files({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id

  const [path, setPath] = useState("")
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("")
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [mkdirOpen, setMkdirOpen] = useState(false)

  const load = useCallback(async (p = path) => {
    if (id == null) return
    setLoading(true)
    setError(null)
    try {
      const r = await apiGet(`/api/servers/${id}/files?path=${encodeURIComponent(p)}`)
      setEntries(Array.isArray(r.entries) ? r.entries : [])
    } catch (e) {
      const msg = e instanceof APIError ? e.message : String(e)
      setError(msg)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [id, path])

  useEffect(() => {
    load(path)
    setPreview(null)
  }, [path, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const onOpenDir = (newPath) => setPath(newPath)
  const onOpenFile = async (rel) => {
    setPreviewLoading(true)
    try {
      const r = await apiGet(`/api/servers/${id}/files/content?path=${encodeURIComponent(rel)}`)
      setPreview(r)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setPreviewLoading(false)
    }
  }
  const onClosePreview = () => setPreview(null)

  const onDelete = async (rel, name) => {
    if (!window.confirm(`Permanently delete ${name}?`)) return
    try {
      await apiDelete(`/api/servers/${id}/files?path=${encodeURIComponent(rel)}`)
      toast?.("Deleted", "warning")
      if (preview?.rel_path === rel) setPreview(null)
      load(path)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const onMkdir = async (name) => {
    const rel = path ? `${path}/${name}` : name
    try {
      await apiPost(`/api/servers/${id}/files/mkdir`, { rel_path: rel })
      toast?.("Folder created")
      load(path)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
      throw e
    }
  }

  if (id == null) {
    return (
      <div style={{ padding: 24, color: C.textDim, fontSize: sz.base }}>
        No instance selected.
      </div>
    )
  }

  const visible = filter
    ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries

  return (
    <div className="flex flex-col gap-3" style={{ height: "100%", minHeight: 0 }}>
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <h2
          className="font-black uppercase tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
        >
          Files
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter..."
            className="rounded-lg px-3 py-1.5 outline-none"
            style={{
              background: C.bgInput,
              border: `1px solid ${filter ? C.accent + "60" : C.border}`,
              color: C.text,
              fontSize: sz.stat,
              width: 160,
            }}
          />
          <Btn small v="ghost" onClick={() => setMkdirOpen(true)}>+ Folder</Btn>
          <Btn small v="ghost" onClick={() => load(path)}>Refresh</Btn>
        </div>
      </div>

      <Breadcrumb instance={instance} path={path} onNavigate={setPath} />

      {error && (
        <div
          className="rounded-lg px-3 py-2 shrink-0"
          style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: sz.base }}
        >
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {loading ? (
          <div style={{ color: C.textMuted, padding: 16, fontSize: sz.base }}>Loading...</div>
        ) : (
          <FileTable
            entries={visible}
            currentPath={path}
            selectedName={preview ? preview.rel_path.split("/").pop() : null}
            onOpenDir={onOpenDir}
            onOpenFile={onOpenFile}
            onDelete={onDelete}
          />
        )}

        {(preview || previewLoading) && (
          <div className="shrink-0">
            {previewLoading ? (
              <div
                className="rounded-xl flex items-center justify-center py-8"
                style={{ background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMuted, fontSize: sz.base }}
              >
                Loading file...
              </div>
            ) : (
              <PreviewPane
                file={preview}
                instanceId={id}
                onClose={onClosePreview}
                onSaved={(updated) => { setPreview(updated); load(path) }}
                toast={toast}
              />
            )}
          </div>
        )}

        <div className="shrink-0" style={{ fontSize: sz.stat, color: C.textMuted, padding: "4px 4px 0" }}>
          {visible.filter(e => e.type === "dir").length} folders, {visible.filter(e => e.type === "file").length} files
          {filter && <span style={{ color: C.orange }}> · filtered</span>}
        </div>
      </div>

      <MkdirModal
        open={mkdirOpen}
        onClose={() => setMkdirOpen(false)}
        onSubmit={onMkdir}
        currentPath={path}
      />
    </div>
  )
}
