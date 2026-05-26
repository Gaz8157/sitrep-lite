import { useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"

function asErr(e) {
  return e instanceof APIError ? e.message : String(e)
}

export default function ImportPreviewModal({
  open,
  importMods,
  installedMods,
  instanceId,
  onClose,
  onApplied,
  toast,
}) {
  const { C, sz } = useT()
  const [mode, setMode] = useState("merge")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)

  const existingSet = useMemo(
    () => new Set(installedMods.map(m => m.mod_guid)),
    [installedMods],
  )
  const newOnes = useMemo(
    () => importMods.filter(m => !existingSet.has(m.mod_guid)),
    [importMods, existingSet],
  )
  const dupes = useMemo(
    () => importMods.filter(m => existingSet.has(m.mod_guid)),
    [importMods, existingSet],
  )

  if (!open) return null

  const apply = async () => {
    if (busy || instanceId == null) return
    setBusy(true)
    setProgress({ phase: "write", i: 0, total: 1 })
    try {
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      if (!next.game) next.game = {}
      const current = Array.isArray(next.game.mods) ? next.game.mods : []
      const normalize = (m) => ({
        modId: m.modId || m.mod_guid,
        name: m.name || m.modId || m.mod_guid,
        version: m.version || "",
      })
      if (mode === "replace") {
        next.game.mods = importMods.map(normalize)
      } else {
        const have = new Set(current.map(m => m.modId || m.mod_guid))
        const adds = importMods
          .filter(m => !have.has(m.modId || m.mod_guid))
          .map(normalize)
        next.game.mods = [...current.map(normalize), ...adds]
      }
      await apiPut(`/api/servers/${instanceId}/config`, next)
      toast?.(
        mode === "replace"
          ? `Replaced with ${importMods.length} mod${importMods.length !== 1 ? "s" : ""}`
          : `Added ${newOnes.length} new mod${newOnes.length !== 1 ? "s" : ""}`,
      )
      onApplied?.()
      onClose?.()
    } catch (e) {
      toast?.(`Apply failed: ${asErr(e)}`, "danger")
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div
      onClick={busy ? undefined : onClose}
      className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-2xl shadow-2xl flex flex-col"
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          width: "min(580px, 95vw)",
          maxHeight: "85vh",
        }}
      >
        <div
          className="px-6 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div
            className="font-black mb-1"
            style={{ color: C.textBright, fontSize: sz.base + 3 }}
          >
            Import Mod List
          </div>
          <div style={{ color: C.textMuted, fontSize: sz.stat }}>
            {importMods.length} mod{importMods.length !== 1 ? "s" : ""} in file
          </div>
        </div>

        <div className="px-6 py-4 flex-1 overflow-auto">
          <div
            className="flex rounded-lg overflow-hidden mb-4"
            style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
          >
            {[
              ["merge", "Merge (keep existing)"],
              ["replace", "Replace all"],
            ].map(([m, l]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={busy}
                className="flex-1 px-4 py-2 font-bold cursor-pointer"
                style={{
                  background: mode === m ? C.accentBg : "transparent",
                  color: mode === m ? C.accent : C.textDim,
                  fontSize: sz.stat,
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {mode === "merge" && (
            <div
              className="mb-3 rounded-lg px-4 py-3"
              style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
            >
              <div style={{ color: C.accent, fontSize: sz.stat, fontWeight: 700 }}>
                {newOnes.length} new mod{newOnes.length !== 1 ? "s" : ""} will be added
              </div>
              {dupes.length > 0 && (
                <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 2 }}>
                  {dupes.length} already installed, skipped
                </div>
              )}
            </div>
          )}

          {mode === "replace" && (
            <div
              className="mb-3 rounded-lg px-4 py-3"
              style={{ background: C.redBg, border: `1px solid ${C.redBorder}` }}
            >
              <div style={{ color: C.red, fontSize: sz.stat, fontWeight: 700 }}>
                Current {installedMods.length} mod{installedMods.length !== 1 ? "s" : ""} will be removed
                and replaced with {importMods.length} from this file.
              </div>
            </div>
          )}

          <div className="space-y-1.5 max-h-56 overflow-auto">
            {importMods.map((m, i) => {
              const isNew = !existingSet.has(m.mod_guid)
              return (
                <div
                  key={`${m.mod_guid}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: C.bg, border: `1px solid ${C.border}` }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold truncate"
                      style={{ color: C.text, fontSize: sz.stat }}
                    >
                      {m.name || m.mod_guid}
                    </div>
                    <div
                      className="font-mono truncate"
                      style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                    >
                      {m.mod_guid}{m.version ? ` · v${m.version}` : ""}
                    </div>
                  </div>
                  {mode === "merge" && (
                    <span
                      className="px-2 py-0.5 rounded font-bold shrink-0"
                      style={{
                        background: isNew ? C.accentBg : C.bgInput,
                        color: isNew ? C.accent : C.textMuted,
                        border: `1px solid ${isNew ? C.accent + "30" : C.border}`,
                        fontSize: sz.stat - 2,
                      }}
                    >
                      {isNew ? "NEW" : "SKIP"}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {progress && (
            <div
              className="mt-3 rounded-lg px-4 py-3 animate-pulse"
              style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
            >
              <div style={{ color: C.textDim, fontSize: sz.stat }}>
                {progress.phase === "add" ? "Subscribing" : "Removing"} {progress.i} / {progress.total}...
              </div>
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 flex gap-3 justify-end"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <Btn v="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn
            v={mode === "replace" ? "danger" : "default"}
            onClick={apply}
            disabled={busy}
          >
            {busy ? "Working..." : mode === "replace" ? "Replace Mods" : "Add Mods"}
          </Btn>
        </div>
      </div>
    </div>
  )
}
