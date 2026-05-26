import { useEffect, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn, Badge } from "../../components/index.js"

const WORKSHOP_BASE = "https://reforger.armaplatform.com/workshop/"

function fmtMB(s) {
  if (!s || s <= 0) return ""
  return `${(s / 1048576).toFixed(0)} MB`
}

function fmtKB(s) {
  if (!s || s <= 0) return ""
  return `${(s / 1024).toFixed(0)} KB`
}

function asErr(e) {
  return e instanceof APIError ? e.message : String(e)
}

export default function ModDetailModal({
  instanceId,
  mod,
  installedMap,
  onClose,
  onMutate,
  onSwitchMod,
  toast,
}) {
  const { C, sz } = useT()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const acRef = useRef(null)

  useEffect(() => {
    if (!mod?.id) return
    setDetail(null)
    setLoading(true)
    let aborted = false
    acRef.current = { abort: () => { aborted = true } }
    ;(async () => {
      try {
        const d = await apiGet(`/api/workshop/mod/${mod.id}`)
        if (!aborted && d && !d.error) setDetail(d)
      } catch {
        // Silent — selected mod will fall back to placeholder fields.
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [mod?.id])

  if (!mod) return null

  const eff = detail && detail.id ? detail : mod
  const installedEntry = installedMap.get(mod.id) || null
  const isInstalled = !!installedEntry
  const currentPin = installedEntry?.version || ""
  const latestVersion = (detail?.versions && detail.versions[0]?.version) || eff?.version || ""

  const readConfig = async () => {
    const cfg = await apiGet(`/api/servers/${instanceId}/config`)
    return JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
  }

  const writeConfig = (next) => apiPut(`/api/servers/${instanceId}/config`, next)

  const upsertMod = async (version) => {
    const next = await readConfig()
    if (!next.game) next.game = {}
    if (!Array.isArray(next.game.mods)) next.game.mods = []
    const idx = next.game.mods.findIndex(m => (m?.modId || m?.mod_guid) === mod.id)
    const entry = {
      modId: mod.id,
      name: mod.name || detail?.name || mod.id,
      version: version || "",
    }
    if (idx >= 0) next.game.mods[idx] = entry
    else next.game.mods.push(entry)
    await writeConfig(next)
  }

  const addLatest = async () => {
    if (busy || instanceId == null) return
    setBusy(true)
    try {
      await upsertMod("")
      toast?.(`Added ${mod.name || mod.id}`, "info")
      onMutate?.()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const addPinned = async (version) => {
    if (busy || instanceId == null) return
    setBusy(true)
    try {
      await upsertMod(version)
      toast?.(`Added ${mod.name || mod.id} v${version}`, "info")
      onMutate?.()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const removeMods = async (ids, label) => {
    if (busy || instanceId == null) return
    setBusy(true)
    try {
      const next = await readConfig()
      const removeSet = new Set(ids.map(x => String(x).toUpperCase()))
      if (Array.isArray(next?.game?.mods)) {
        next.game.mods = next.game.mods.filter(m => {
          const g = String(m?.modId || m?.mod_guid || "").toUpperCase()
          return !removeSet.has(g)
        })
      }
      await writeConfig(next)
      toast?.(label, "warning")
      onMutate?.()
      onClose?.()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const removeFromServer = () =>
    removeMods([mod.id], `Removed ${mod.name || mod.id}`)

  const installedDeps = (detail?.dependencies || []).filter(d =>
    d?.id && installedMap.has(d.id),
  )

  const openRemoveWithDeps = () => {
    if (busy || instanceId == null) return
    if (!installedDeps.length) {
      removeFromServer()
      return
    }
    setConfirmRemove({
      deps: installedDeps,
      checked: new Set(installedDeps.map(d => d.id)),
    })
  }

  const toggleDepChecked = (id) => {
    setConfirmRemove(prev => {
      if (!prev) return prev
      const next = new Set(prev.checked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, checked: next }
    })
  }

  const confirmRemoveWithDeps = async () => {
    if (!confirmRemove) return
    const depIds = [...confirmRemove.checked]
    const ids = [mod.id, ...depIds]
    const n = depIds.length
    setConfirmRemove(null)
    await removeMods(
      ids,
      n > 0
        ? `Removed ${mod.name || mod.id} + ${n} dependenc${n === 1 ? "y" : "ies"}`
        : `Removed ${mod.name || mod.id}`,
    )
  }

  const switchVersion = async (version) => {
    if (busy || instanceId == null) return
    setBusy(true)
    try {
      await upsertMod(version || "")
      toast?.(version ? `Switched to v${version}` : "Set to latest")
      onMutate?.()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const useScenario = async (scenarioId) => {
    if (busy || instanceId == null) return
    setBusy(true)
    try {
      const cfg = await apiGet(`/api/servers/${instanceId}/config`)
      const next = JSON.parse(JSON.stringify(cfg?.config || cfg || {}))
      if (!next.game) next.game = {}
      next.game.scenarioId = scenarioId
      await apiPut(`/api/servers/${instanceId}/config`, next)
      toast?.("Scenario set", "info")
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const stats = []
  if (eff.subscribers > 0) stats.push({ k: "downloads", v: `${(eff.subscribers / 1000).toFixed(1)}k` })
  if (eff.rating > 0) stats.push({
    k: `${(eff.ratingCount || 0).toLocaleString()} ratings`,
    v: `${eff.rating}/5`,
    color: C.orange,
  })
  const tags = (eff.tags || []).slice(0, 6)

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          width: "min(720px, 95vw)",
          maxHeight: "90vh",
        }}
      >
        <div
          className="relative shrink-0"
          style={{ paddingTop: "38%", background: C.bgInput }}
        >
          {detail?.image || mod.image ? (
            <img
              src={detail?.image || mod.image}
              alt={mod.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : mod.id ? (
            <img
              src={`/api/workshop/thumb/${mod.id}`}
              alt={mod.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = "none" }}
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer font-bold"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: sz.base }}
          >
            X
          </button>
          {isInstalled && (
            <div
              className="absolute top-3 left-3 px-2 py-1 rounded-md font-black"
              style={{ background: C.accent, color: "#000", fontSize: sz.stat }}
            >
              ON SERVER
            </div>
          )}
          <div className="absolute bottom-3 left-4 right-4">
            <div
              className="font-black"
              style={{
                color: "#fff",
                fontSize: sz.base + 6,
                textShadow: "0 2px 8px rgba(0,0,0,0.8)",
              }}
            >
              {mod.name || mod.id}
            </div>
            {(mod.author || detail?.author) && (
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: sz.base }}>
                by {mod.author || detail?.author}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 overflow-auto flex-1">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {stats.map(s => (
              <div
                key={s.k}
                className="text-center px-4 py-2 rounded-lg"
                style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
              >
                <div
                  className="font-black"
                  style={{ color: s.color || C.textBright, fontSize: sz.base + 2 }}
                >
                  {s.v}
                </div>
                <div style={{ color: C.textMuted, fontSize: sz.stat }}>{s.k}</div>
              </div>
            ))}
            {tags.map(t => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-lg font-bold"
                style={{
                  background: C.bgInput,
                  color: C.textDim,
                  border: `1px solid ${C.border}`,
                  fontSize: sz.stat,
                }}
              >
                {t}
              </span>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {!isInstalled ? (
              <>
                <Btn onClick={addLatest} disabled={busy || !mod.id}>+ Add Latest</Btn>
                {latestVersion && mod.version && latestVersion !== mod.version && (
                  <Btn v="ghost" onClick={() => addPinned(mod.version)} disabled={busy}>
                    + Add v{mod.version}
                  </Btn>
                )}
              </>
            ) : (
              <>
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold"
                  style={{
                    background: C.accentBg,
                    color: C.accent,
                    border: `1px solid ${C.accent}30`,
                    fontSize: sz.base,
                  }}
                >
                  On Server
                  <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat, fontWeight: 400 }}>
                    · {currentPin ? `pinned v${currentPin}` : "latest"}
                  </span>
                </div>
                {currentPin && (
                  <Btn v="info" onClick={() => switchVersion("")} disabled={busy}>
                    Set to Latest
                  </Btn>
                )}
                <Btn v="danger" onClick={removeFromServer} disabled={busy}>
                  Remove from Server
                </Btn>
                {installedDeps.length > 0 && (
                  <Btn v="danger" onClick={openRemoveWithDeps} disabled={busy}>
                    Remove + {installedDeps.length} Dep{installedDeps.length !== 1 ? "s" : ""}
                  </Btn>
                )}
              </>
            )}
            {mod.id && (
              <a
                href={WORKSHOP_BASE + mod.id}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg font-bold inline-flex items-center gap-1"
                style={{
                  background: C.bgInput,
                  color: C.accent,
                  border: `1px solid ${C.accent}40`,
                  fontSize: sz.base,
                  textDecoration: "none",
                }}
              >
                ↗ Workshop
              </a>
            )}
          </div>

          {detail && !loading && detail.dependencies?.length > 0 && (
            <div className="mb-4">
              <div
                className="font-black uppercase tracking-wide mb-2"
                style={{ color: C.textDim, fontSize: sz.label }}
              >
                Dependencies ({detail.dependencies.length})
              </div>
              <div className="space-y-1">
                {detail.dependencies.map((dep, i) => {
                  const on = installedMap.has(dep.id)
                  return (
                    <div
                      key={dep.id || i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                      style={{
                        background: C.bgInput,
                        border: `1px solid ${on ? C.accent + "35" : C.border}`,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: on ? C.accent : C.textMuted + "60" }}
                      />
                      <div className="flex-1 min-w-0">
                        <span
                          className="font-bold block truncate"
                          style={{ color: on ? C.accent : C.text, fontSize: sz.base }}
                        >
                          {dep.name || dep.id}
                        </span>
                        <span
                          className="font-mono block truncate"
                          style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                        >
                          {dep.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {dep.version && (
                          <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
                            v{dep.version}
                          </span>
                        )}
                        {dep.size > 0 && (
                          <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
                            {fmtMB(dep.size)}
                          </span>
                        )}
                        {on && <Badge text="On Server" v="default" />}
                        <Btn
                          small
                          v="ghost"
                          onClick={() =>
                            onSwitchMod?.({
                              id: dep.id,
                              name: dep.name,
                              version: dep.version || "",
                              image: null,
                              author: "",
                              rating: 0,
                              ratingCount: 0,
                              subscribers: 0,
                              tags: [],
                              summary: "",
                            })
                          }
                        >
                          View
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {detail && !loading && detail.scenarios?.length > 0 && (
            <div className="mb-4">
              <div
                className="font-black uppercase tracking-wide mb-2"
                style={{ color: C.textDim, fontSize: sz.label }}
              >
                Scenarios in this mod
              </div>
              <div className="space-y-2">
                {detail.scenarios.map((s, i) => (
                  <div
                    key={s.id || i}
                    className="rounded-xl overflow-hidden"
                    style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
                  >
                    {s.image && (
                      <img
                        src={s.image}
                        alt={s.name}
                        className="w-full object-cover"
                        style={{ maxHeight: 120 }}
                      />
                    )}
                    <div className="p-3">
                      <div
                        className="font-bold mb-1"
                        style={{ color: C.text, fontSize: sz.base + 1 }}
                      >
                        {s.name}
                      </div>
                      {s.description && (
                        <div
                          className="mb-1.5 leading-relaxed"
                          style={{ color: C.textDim, fontSize: sz.stat }}
                        >
                          {s.description}
                        </div>
                      )}
                      <div
                        className="flex items-center gap-3 flex-wrap mb-2"
                        style={{ fontSize: sz.stat }}
                      >
                        {s.gameMode && (
                          <span
                            className="font-mono px-2 py-0.5 rounded"
                            style={{ background: C.accentBg, color: C.accent }}
                          >
                            {s.gameMode.replace("#AR-Scenario_GameMode_", "")}
                          </span>
                        )}
                        {s.playerCount > 0 && (
                          <span style={{ color: C.textMuted }}>{s.playerCount} players</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code
                          className="flex-1 px-2 py-1 rounded text-xs font-mono truncate"
                          style={{ background: C.consoleBg, color: C.textDim }}
                        >
                          {s.id}
                        </code>
                        <Btn small onClick={() => useScenario(s.id)} disabled={busy}>
                          Use
                        </Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail?.versions && detail.versions.length > 1 && (
            <div className="mb-4">
              <div
                className="font-black uppercase tracking-wide mb-2"
                style={{ color: C.textDim, fontSize: sz.label }}
              >
                Version History
              </div>
              <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                {detail.versions.map((v, i) => {
                  const isCurrent = isInstalled
                    ? (currentPin ? currentPin === v.version : i === 0)
                    : false
                  return (
                    <div
                      key={`${v.version}-${i}`}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
                      style={{
                        background: isCurrent ? C.accentBg : C.bgInput,
                        border: `1px solid ${
                          isCurrent ? C.accent + "50" : i === 0 ? C.accent + "30" : C.border
                        }`,
                      }}
                    >
                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        <span
                          className="font-mono font-bold"
                          style={{
                            color: isCurrent ? C.accent : i === 0 ? C.accent : C.text,
                            fontSize: sz.base,
                          }}
                        >
                          v{v.version}
                        </span>
                        {i === 0 && <Badge text="Latest" v="default" />}
                        {isCurrent && <Badge text={currentPin ? "Pinned" : "In Use"} v="info" />}
                        {v.gameVersion && (
                          <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                            game {v.gameVersion}
                          </span>
                        )}
                        {v.size > 0 && (
                          <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                            {fmtKB(v.size)}
                          </span>
                        )}
                      </div>
                      <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                        {v.date ? new Date(v.date).toLocaleDateString() : ""}
                      </span>
                      {isInstalled
                        ? !isCurrent && (
                            <Btn
                              small
                              v="ghost"
                              onClick={() => switchVersion(i === 0 ? "" : v.version)}
                              disabled={busy}
                            >
                              {i === 0 ? "Switch to Latest" : `Switch to v${v.version}`}
                            </Btn>
                          )
                        : i > 0 && (
                            <Btn
                              small
                              v="ghost"
                              onClick={() => addPinned(v.version)}
                              disabled={busy}
                            >
                              + Pin v{v.version}
                            </Btn>
                          )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loading && (
            <div
              className="animate-pulse mb-4"
              style={{ color: C.textDim, fontSize: sz.base }}
            >
              Loading details...
            </div>
          )}

          {(() => {
            const desc = detail?.description || mod.summary || ""
            const name = detail?.name || mod.name || ""
            const useful = desc && desc.trim() !== name.trim() && desc.length > name.length
            return useful ? (
              <div
                className="mb-4 leading-relaxed"
                style={{ color: C.textDim, fontSize: sz.base }}
              >
                {desc}
              </div>
            ) : null
          })()}
        </div>
      </div>

      {confirmRemove && (
        <div
          onClick={busy ? undefined : () => setConfirmRemove(null)}
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl shadow-2xl flex flex-col"
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              width: "min(520px, 95vw)",
              maxHeight: "80vh",
            }}
          >
            <div
              className="px-6 pt-5 pb-3"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div
                className="font-black mb-1"
                style={{ color: C.textBright, fontSize: sz.base + 2 }}
              >
                Remove {mod.name || mod.id} + Dependencies
              </div>
              <div style={{ color: C.textMuted, fontSize: sz.stat }}>
                Uncheck any dependency you want to keep (e.g. shared with other mods).
              </div>
            </div>
            <div className="px-6 py-4 overflow-auto space-y-1.5">
              {confirmRemove.deps.map(dep => {
                const checked = confirmRemove.checked.has(dep.id)
                return (
                  <label
                    key={dep.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
                    style={{
                      background: C.bgInput,
                      border: `1px solid ${checked ? C.red + "55" : C.border}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDepChecked(dep.id)}
                      disabled={busy}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-bold truncate"
                        style={{ color: C.text, fontSize: sz.stat }}
                      >
                        {dep.name || dep.id}
                      </div>
                      <div
                        className="font-mono truncate"
                        style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                      >
                        {dep.id}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
            <div
              className="px-6 py-4 flex gap-3 justify-end"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <Btn v="ghost" onClick={() => setConfirmRemove(null)} disabled={busy}>
                Cancel
              </Btn>
              <Btn v="danger" onClick={confirmRemoveWithDeps} disabled={busy}>
                {busy ? "Removing..." : `Remove ${1 + confirmRemove.checked.size} Mod${1 + confirmRemove.checked.size !== 1 ? "s" : ""}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
