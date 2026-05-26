import { useCallback, useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, APIError } from "../../api/index.js"
import { Badge } from "../../components/index.js"
import { useMobile } from "../../hooks/index.js"
import WorkshopBrowser from "./WorkshopBrowser.jsx"
import InstalledGrid from "./InstalledGrid.jsx"
import DeploymentsPanel from "./DeploymentsPanel.jsx"
import ModDetailModal from "./ModDetailModal.jsx"
import ImportPreviewModal from "./ImportPreviewModal.jsx"

const VIEWS = ["workshop", "installed", "deployments"]

function loadView() {
  try {
    const v = localStorage.getItem("mods-view")
    return VIEWS.includes(v) ? v : "workshop"
  } catch { return "workshop" }
}

const GUID_LINE_RE = /[0-9A-Fa-f]{16}/g

function normalizeEntry(raw) {
  if (!raw) return null
  const guid = (raw.mod_guid || raw.modId || raw.id || "").toUpperCase()
  if (!/^[0-9A-F]{16}$/.test(guid)) return null
  return {
    mod_guid: guid,
    name: raw.name || guid,
    version: raw.version || "",
  }
}

function deepFindMods(node, depth = 0) {
  if (!node || depth > 6) return null
  if (Array.isArray(node)) {
    if (node.length && node.every(x => x && (x.modId || x.mod_guid || x.id))) return node
    for (const child of node) {
      const found = deepFindMods(child, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof node === "object") {
    if (Array.isArray(node.mods)) return node.mods
    for (const k of Object.keys(node)) {
      const found = deepFindMods(node[k], depth + 1)
      if (found) return found
    }
  }
  return null
}

function parseModsFromJson(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { return null }
  const list = deepFindMods(parsed)
  if (!Array.isArray(list)) return null
  return list.map(normalizeEntry).filter(Boolean)
}

function dedupe(entries) {
  const seen = new Set()
  const out = []
  for (const e of entries) {
    if (!e || seen.has(e.mod_guid)) continue
    seen.add(e.mod_guid)
    out.push(e)
  }
  return out
}

function parseModsFromJsonFragments(text) {
  const out = []
  const re = /\{[^{}]*?"modId"\s*:\s*"([0-9A-Fa-f]{16})"[^{}]*?\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    const block = m[0]
    const guid = m[1].toUpperCase()
    const nameMatch = block.match(/"name"\s*:\s*"([^"]*)"/)
    const verMatch = block.match(/"version"\s*:\s*"([^"]*)"/)
    out.push({
      mod_guid: guid,
      name: nameMatch ? nameMatch[1] : guid,
      version: verMatch ? verMatch[1] : "",
    })
  }
  return dedupe(out)
}

function parseModsFromLines(text) {
  const out = []
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(GUID_LINE_RE)
    if (!m) continue
    const guid = m[0].toUpperCase()
    const rest = line.replace(m[0], "").replace(/[,;|\t]+/g, " ").trim()
    let name = rest.replace(/^["'\s-]+|["'\s]+$/g, "")
    if (/^["']?modId["']?\s*:?$/i.test(name)) name = ""
    out.push({ mod_guid: guid, name: name || guid, version: "" })
  }
  return dedupe(out)
}

function parseModsFromText(text) {
  const fragments = parseModsFromJsonFragments(text)
  if (fragments.length) return fragments
  return parseModsFromLines(text)
}

export default function Mods({ instance, toast }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  const id = instance?.id ?? instance?.instance_id
  const state = instance?.state || instance?.status?.state
  const running = state === "active" || state === "running"

  const [view, setView] = useState(loadView)
  const [mods, setMods] = useState([])
  const [loading, setLoading] = useState(true)
  const [depCount, setDepCount] = useState(0)
  const [selected, setSelected] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importList, setImportList] = useState([])

  useEffect(() => {
    try { localStorage.setItem("mods-view", view) } catch {}
  }, [view])

  const loadMods = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const r = await apiGet(`/api/servers/${id}/mods`)
      setMods(Array.isArray(r?.mods) ? r.mods : [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  const loadDepCount = useCallback(async () => {
    try {
      const r = await apiGet(`/api/packages`)
      const list = r?.packages || r?.items || (Array.isArray(r) ? r : [])
      setDepCount(Array.isArray(list) ? list.length : 0)
    } catch {
      // Silent — Packages count is informational.
    }
  }, [])

  useEffect(() => { loadMods() }, [loadMods])
  useEffect(() => { loadDepCount() }, [loadDepCount])

  const installedMap = useMemo(() => {
    const m = new Map()
    for (const x of mods) m.set(x.mod_guid, x)
    return m
  }, [mods])

  const openMod = useCallback((mod) => {
    if (!mod?.id) { toast?.("Mod ID missing", "danger"); return }
    setSelected(mod)
  }, [toast])

  const closeMod = useCallback(() => setSelected(null), [])

  const onMutate = useCallback(() => {
    loadMods()
    loadDepCount()
  }, [loadMods, loadDepCount])

  const exportMods = () => {
    if (!mods.length) { toast?.("No mods to export", "warning"); return }
    const payload = mods.map(m => ({
      mod_guid: m.mod_guid,
      name: m.name || m.mod_guid,
      version: m.version || "",
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mods-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast?.(`Exported ${mods.length} mods`)
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target.result
      let list = parseModsFromJson(text)
      if (!list) list = parseModsFromText(text)
      if (!list || !list.length) {
        toast?.("No valid mod entries found in file", "danger")
        return
      }
      setImportList(list)
      setImportOpen(true)
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 mb-3 flex-wrap shrink-0">
        <h2
          className="font-black uppercase tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
        >
          Mods
        </h2>
        <Badge text={`${mods.length} on server`} v="default" />
        <div className="flex-1" />
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
        >
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 font-bold capitalize cursor-pointer"
              style={{
                paddingTop: mobile ? 10 : 6,
                paddingBottom: mobile ? 10 : 6,
                background: view === v ? C.accentBg : "transparent",
                color: view === v ? C.accent : C.textDim,
                fontSize: sz.nav,
              }}
            >
              {v === "installed"
                ? `Installed (${mods.length})`
                : v === "deployments"
                ? `Packages (${depCount})`
                : "Workshop"}
            </button>
          ))}
        </div>
      </div>

      {running && (
        <div
          className="rounded-lg px-3 py-2 mb-3 shrink-0"
          style={{
            background: C.blueBg,
            border: `1px solid ${C.blue}40`,
            color: C.blue,
            fontSize: sz.label,
          }}
        >
          Mods only load after a server restart. The server is currently running — restart it when you finish editing.
        </div>
      )}

      {loading && mods.length === 0 && view === "installed" ? (
        <div
          className="animate-pulse"
          style={{ color: C.textDim, fontSize: sz.base, padding: 16 }}
        >
          Loading...
        </div>
      ) : view === "workshop" ? (
        <WorkshopBrowser
          installedMap={installedMap}
          onOpenMod={openMod}
          toast={toast}
        />
      ) : view === "installed" ? (
        <InstalledGrid
          instanceId={id}
          mods={mods}
          installedMap={installedMap}
          onOpenMod={openMod}
          onReload={onMutate}
          onExport={exportMods}
          onImport={handleImportFile}
          toast={toast}
        />
      ) : (
        <DeploymentsPanel
          instanceId={id}
          modCount={mods.length}
          onApplied={onMutate}
          toast={toast}
        />
      )}

      {selected && (
        <ModDetailModal
          instanceId={id}
          mod={selected}
          installedMap={installedMap}
          onClose={closeMod}
          onMutate={onMutate}
          onSwitchMod={mod => {
            setSelected(null)
            setTimeout(() => setSelected(mod), 50)
          }}
          toast={toast}
        />
      )}

      <ImportPreviewModal
        open={importOpen}
        importMods={importList}
        installedMods={mods}
        instanceId={id}
        onClose={() => setImportOpen(false)}
        onApplied={onMutate}
        toast={toast}
      />
    </div>
  )
}
