import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"
import StartupParamsPanel from "./StartupParamsPanel.jsx"
import DiagnosticsPanel from "./DiagnosticsPanel.jsx"
import PersistencePanel from "./PersistencePanel.jsx"
import CpuAffinitySection from "./CpuAffinitySection.jsx"
import MemorySection from "./MemorySection.jsx"

const ALL_SUB_TABS = [
  { id: "params",      label: "Startup Params" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "saves",       label: "Save Management" },
  { id: "cpu",         label: "CPU", ownerOnly: true },
  { id: "memory",      label: "Memory", ownerOnly: true },
]

export default function Startup({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const isDemo = authUser?.role === "demo"
  const isOwner = authUser?.role === "owner"
  const SUB_TABS = ALL_SUB_TABS.filter(t => !t.ownerOnly || isOwner)

  const [sub, setSub] = useState(() => {
    try {
      const saved = localStorage.getItem("sitrep-startup-sub")
      if (saved && SUB_TABS.find(t => t.id === saved)) return saved
    } catch {}
    return "params"
  })
  const switchSub = (id) => {
    setSub(id)
    try { localStorage.setItem("sitrep-startup-sub", id) } catch {}
  }

  // Params edits lifted here so the Save & Apply button can live in the
  // header pill row alongside the sub-tab switcher (v1 line 419).
  const [edits, setEdits] = useState({})
  const [customLaunchParams, setCustomLaunchParams] = useState("")
  // Track last-loaded customLaunchParams to detect dirtiness on the
  // free-form input (it bypasses the edits map).
  const [loadedCustom, setLoadedCustom] = useState(null)
  const [saving, setSaving] = useState(false)
  const setEdit = (key, value) => setEdits(e => ({ ...e, [key]: value }))
  const dirty =
    Object.keys(edits).length > 0
    || (loadedCustom !== null && loadedCustom !== customLaunchParams)

  // Reset edits when switching instance.
  useEffect(() => { setEdits({}); setLoadedCustom(null) }, [id])

  // Diagnostics ⚠ indicator: poll every 30s so the badge updates live.
  const [diagQuick, setDiagQuick] = useState(null)
  useEffect(() => {
    if (id == null) return
    let cancelled = false
    const load = async () => {
      try {
        const r = await apiGet(`/api/servers/${id}/diagnostics`)
        if (!cancelled) setDiagQuick(r)
      } catch {
        // Silent — the badge just won't show until we get data.
      }
    }
    load()
    const iv = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [id])
  const hasDiagWarning = !!(diagQuick?.summary && (diagQuick.summary.error > 0 || diagQuick.summary.warn > 0))

  const save = async () => {
    if (id == null || saving) return
    setSaving(true)
    try {
      const r = await apiPut(`/api/servers/${id}/startup-params`, {
        params: edits,
        customLaunchParams: customLaunchParams.trim(),
      })
      toast?.("Startup params saved. Restart server to apply.", "info")
      setEdits({})
      // Reload after save so badges update (ACTIVE reflects the new
      // effective args).
      try {
        const fresh = await apiGet(`/api/servers/${id}/startup-params`)
        if (fresh?.customLaunchParams != null) {
          setCustomLaunchParams(fresh.customLaunchParams)
          setLoadedCustom(fresh.customLaunchParams)
        }
        // Hint StartupParamsPanel to remount with fresh data by setting
        // a key would be heavier — for now the badges refresh by the
        // panel's own load triggers on instance change. The edits map
        // is cleared so MODIFIED badges disappear immediately.
        window.dispatchEvent(new CustomEvent("sitrep-startup-params-reload"))
      } catch {}
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setEdits({})
    if (loadedCustom !== null) setCustomLaunchParams(loadedCustom)
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: "100%", minHeight: 0 }}>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <h2
          className="font-black uppercase tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
        >
          Startup
        </h2>
        <div className="flex-1" />
        <div
          className="flex gap-1 rounded-lg overflow-hidden"
          style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
        >
          {SUB_TABS.map(t => {
            const isActive = sub === t.id
            const isDiag = t.id === "diagnostics"
            const showWarn = isDiag && hasDiagWarning
            const label = showWarn ? `${t.label} ⚠` : t.label
            return (
              <button
                key={t.id}
                onClick={() => switchSub(t.id)}
                className="px-3 py-1.5 font-bold cursor-pointer"
                style={{
                  background: isActive ? C.accentBg : "transparent",
                  color: isActive
                    ? (showWarn ? C.red : C.accent)
                    : (showWarn ? C.orange : C.textDim),
                  fontSize: sz.nav,
                  border: "none",
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {sub === "params" && (
          <div className="flex gap-2 items-center">
            {!isDemo && dirty && (
              <Btn v="ghost" onClick={discard}>Discard</Btn>
            )}
            {!isDemo && (
              <Btn onClick={save} disabled={saving || !dirty}>
                {saving ? "Saving..." : "Save & Apply"}
              </Btn>
            )}
            {isDemo && (
              <span
                className="font-bold px-2"
                style={{ color: C.textMuted, fontSize: sz.stat }}
              >
                View only
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {sub === "params" && (
          <StartupParamsPanel
            instance={instance}
            toast={toast}
            edits={edits}
            setEdit={setEdit}
            customLaunchParams={customLaunchParams}
            setCustomLaunchParams={(v) => {
              setCustomLaunchParams(v)
              if (loadedCustom === null) setLoadedCustom(v)
            }}
            onLoaded={(d) => setLoadedCustom(d?.customLaunchParams ?? "")}
            isDemo={isDemo}
          />
        )}
        {sub === "diagnostics" && <DiagnosticsPanel instance={instance} toast={toast} />}
        {sub === "saves" && <PersistencePanel instance={instance} toast={toast} authUser={authUser} />}
        {sub === "cpu" && isOwner && <CpuAffinitySection instance={instance} toast={toast} />}
        {sub === "memory" && isOwner && <MemorySection instance={instance} toast={toast} authUser={authUser} />}
      </div>
    </div>
  )
}
