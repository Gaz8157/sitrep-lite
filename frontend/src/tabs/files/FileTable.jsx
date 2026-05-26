import { useT } from "../../ctx.jsx"

function fmtSize(s) {
  if (s == null) return ""
  if (s >= 1073741824) return `${(s / 1073741824).toFixed(1)} GB`
  if (s >= 1048576) return `${(s / 1048576).toFixed(1)} MB`
  if (s >= 1024) return `${(s / 1024).toFixed(1)} KB`
  return `${s} B`
}

function fmtTime(ts) {
  if (!ts) return ""
  const d = new Date(ts * 1000)
  const diff = Date.now() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function typeMeta(name, isDir) {
  if (isDir) return { label: "DIR", color: "" }
  const d = name.lastIndexOf(".")
  const ext = d > 0 ? name.slice(d + 1).toLowerCase() : ""
  const map = {
    json: "JSON", conf: "CONF", log: "LOG", txt: "TXT",
    cfg: "CFG", c: "C", py: "PY", sh: "SH", xml: "XML",
    save: "SAVE", bin: "BIN", pbo: "PBO",
  }
  return { label: map[ext] || (ext ? ext.slice(0, 4).toUpperCase() : "FILE"), color: "" }
}

const TEXTUAL_EXTS = new Set([
  "json", "conf", "log", "txt", "cfg", "c", "h", "py", "js", "jsx",
  "sh", "xml", "md", "ini", "yaml", "yml", "env",
])

function isPreviewable(entry) {
  if (entry.type !== "file") return false
  if (entry.size != null && entry.size > 1024 * 1024) return false
  const d = entry.name.lastIndexOf(".")
  const ext = d > 0 ? entry.name.slice(d + 1).toLowerCase() : ""
  if (TEXTUAL_EXTS.has(ext)) return true
  if (!ext && entry.size != null && entry.size < 64 * 1024) return true
  return false
}

export default function FileTable({
  entries, currentPath, selectedName, onOpenDir, onOpenFile, onDelete,
}) {
  const { C, sz } = useT()

  // Sort: .save first within dirs, then dirs alpha, then files alpha. Backend
  // already sorts dirs-before-files alpha; we surface .save as the very first dir.
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1
    if (a.type === "dir") {
      if (a.name === ".save") return -1
      if (b.name === ".save") return 1
    }
    return a.name.localeCompare(b.name)
  })

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 rounded-xl"
        style={{ background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMuted, fontSize: sz.base }}
      >
        Empty folder
      </div>
    )
  }

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.bgInput }}
      >
        <span className="shrink-0" style={{ minWidth: 56, fontSize: sz.label, color: C.textMuted, fontWeight: 900, letterSpacing: 1 }}>TYPE</span>
        <span className="flex-1" style={{ fontSize: sz.label, color: C.textMuted, fontWeight: 900, letterSpacing: 1 }}>NAME</span>
        <span style={{ width: 80, fontSize: sz.label, color: C.textMuted, fontWeight: 900, letterSpacing: 1, textAlign: "right" }}>SIZE</span>
        <span style={{ width: 90, fontSize: sz.label, color: C.textMuted, fontWeight: 900, letterSpacing: 1, textAlign: "right" }}>MTIME</span>
        <span style={{ width: 60, textAlign: "right" }} />
      </div>

      <div className="flex-1 overflow-auto">
        {sorted.map((e, i) => {
          const isDir = e.type === "dir"
          const meta = typeMeta(e.name, isDir)
          const fp = currentPath ? `${currentPath}/${e.name}` : e.name
          const selected = selectedName === e.name
          const labelColor = isDir
            ? C.accent
            : e.name.startsWith(".") ? C.textDim : C.text
          const previewable = isPreviewable(e)
          return (
            <div
              key={`${e.name}-${i}`}
              onClick={() => isDir ? onOpenDir(fp) : (previewable && onOpenFile(fp))}
              className="flex items-center gap-3 px-3 cursor-pointer select-none"
              style={{
                height: 36,
                borderBottom: `1px solid ${C.border}40`,
                background: selected ? C.accentBg : (i % 2 === 0 ? "transparent" : C.bgInput + "30"),
                cursor: isDir || previewable ? "pointer" : "default",
              }}
              onMouseEnter={ev => { if (!selected) ev.currentTarget.style.background = C.bgHover }}
              onMouseLeave={ev => { ev.currentTarget.style.background = selected ? C.accentBg : (i % 2 === 0 ? "transparent" : C.bgInput + "30") }}
            >
              <span
                className="shrink-0 font-bold rounded px-1.5 text-center"
                style={{
                  minWidth: 56,
                  fontSize: Math.max(8, sz.stat - 1),
                  letterSpacing: 0.4,
                  background: isDir ? C.accent + "18" : C.bgInput,
                  color: isDir ? C.accent : C.textDim,
                  border: `1px solid ${isDir ? C.accent + "30" : C.border}`,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                {meta.label}
              </span>
              <span
                className="flex-1 font-mono truncate"
                style={{ color: labelColor, fontSize: sz.base, fontWeight: isDir ? 700 : 400 }}
              >
                {e.name}
              </span>
              <span style={{ width: 80, fontSize: sz.stat, color: C.textMuted, textAlign: "right", fontFamily: "monospace" }}>
                {isDir ? "—" : fmtSize(e.size)}
              </span>
              <span style={{ width: 90, fontSize: sz.stat, color: C.textMuted, textAlign: "right", fontFamily: "monospace" }}>
                {fmtTime(e.mtime)}
              </span>
              <button
                onClick={ev => { ev.stopPropagation(); onDelete(fp, e.name) }}
                className="cursor-pointer font-bold rounded px-2 py-0.5"
                style={{
                  width: 60,
                  fontSize: sz.label,
                  background: C.redBg,
                  color: C.red,
                  border: `1px solid ${C.redBorder}`,
                }}
              >
                Del
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
