import { useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPatch, apiDelete, APIError } from "../../api/index.js"
import { Btn, Card, StatBox, Modal, Badge } from "../../components/index.js"

// Reforger schema-confirmed paths (defaults/reforger-config-schema.json):
//   game.gameProperties.persistence.autoSaveInterval  (minutes, 0-60)
//   operating.playerSaveTime                          (seconds)

function fmtBytes(n) {
  if (!n) return "0 B"
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

function fmtAgo(ts) {
  if (!ts) return "Never"
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts * 1000).toLocaleDateString()
}

function fmtDate(ts) {
  return ts ? new Date(ts * 1000).toLocaleString() : "—"
}

export default function PersistencePanel({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const state = instance?.state || instance?.status?.state
  const running = state === "active" || state === "running"
  const role = authUser?.role
  const canEdit = ["owner", "head_admin", "admin"].includes(role)

  const [savesData, setSavesData] = useState(null)
  const [savesLoading, setSavesLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [autoSave, setAutoSave] = useState("")
  const [playerSave, setPlayerSave] = useState("")
  const [saving, setSaving] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [backups, setBackups] = useState([])
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [busyFile, setBusyFile] = useState(null)
  const [restoreConfirm, setRestoreConfirm] = useState(null)

  const loadSaves = async () => {
    if (id == null) return
    try {
      const r = await apiGet(`/api/servers/${id}/saves`)
      setSavesData(r)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const loadConfig = async () => {
    if (id == null) return
    try {
      const r = await apiGet(`/api/servers/${id}/config`)
      setConfig(r)
      const ai = r?.game?.gameProperties?.persistence?.autoSaveInterval
      const ps = r?.operating?.playerSaveTime
      setAutoSave(ai == null ? "" : String(ai))
      setPlayerSave(ps == null ? "" : String(ps))
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const loadBackups = async () => {
    if (id == null) return
    try {
      const r = await apiGet(`/api/servers/${id}/backups`)
      setBackups(r?.backups || [])
    } catch (e) {
      // empty list is fine if dir is missing; surface real errors quietly
      if (e instanceof APIError && e.status !== 404) {
        // 400 from agent (e.g. instance not provisioned) → empty list
        setBackups([])
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    setSavesLoading(true)
    setConfigLoading(true)
    loadSaves().finally(() => { if (!cancelled) setSavesLoading(false) })
    loadConfig().finally(() => { if (!cancelled) setConfigLoading(false) })
    loadBackups()
    return () => { cancelled = true }
  }, [id])

  const saves = savesData?.saves || []
  const stats = useMemo(() => {
    if (!saves.length) return { count: 0, total: 0, latest: 0 }
    let total = 0
    let latest = 0
    for (const s of saves) {
      total += s.size || 0
      if (s.mtime && s.mtime > latest) latest = s.mtime
    }
    return { count: saves.length, total, latest }
  }, [saves])

  const currentAi = config?.game?.gameProperties?.persistence?.autoSaveInterval
  const currentPs = config?.operating?.playerSaveTime
  const aiNum = autoSave === "" ? null : Number(autoSave)
  const psNum = playerSave === "" ? null : Number(playerSave)
  const aiDirty = (currentAi ?? null) !== (aiNum ?? null) && autoSave !== ""
  const psDirty = (currentPs ?? null) !== (psNum ?? null) && playerSave !== ""
  const dirty = aiDirty || psDirty

  // When autoSaveInterval is absent from config, Reforger uses its built-in
  // default (~10 min, confirmed empirically). Show that truthfully — don't
  // imply "OFF" when the engine will save anyway.
  const REFORGER_DEFAULT_AUTOSAVE_MIN = 10
  const aiSet = currentAi != null
  const aiExplicitlyOff = aiSet && Number(currentAi) === 0
  const aiEffective = aiSet ? Number(currentAi) : REFORGER_DEFAULT_AUTOSAVE_MIN
  const autoSaveBadgeText = aiExplicitlyOff
    ? "AUTO-SAVE OFF"
    : aiSet
      ? `AUTO-SAVE ${aiEffective}min`
      : `AUTO-SAVE ${aiEffective}min · default`
  const autoSaveBadgeVariant = aiExplicitlyOff ? "danger" : "default"

  const saveSettings = async () => {
    if (!dirty || saving || id == null) return
    const patch = {}
    if (aiDirty) {
      patch.game = { gameProperties: { persistence: { autoSaveInterval: aiNum } } }
    }
    if (psDirty) {
      patch.operating = { ...(patch.operating || {}), playerSaveTime: psNum }
    }
    setSaving(true)
    try {
      await apiPatch(`/api/servers/${id}/config`, patch)
      toast?.("Persistence settings saved — restart server to apply", "info")
      await loadConfig()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setSaving(false)
    }
  }

  const createBackup = async () => {
    if (id == null || creatingBackup) return
    setCreatingBackup(true)
    try {
      await apiPost(`/api/servers/${id}/backups`)
      toast?.("Backup created", "info")
      loadBackups()
    } catch (e) {
      const msg = e instanceof APIError ? (e.detail?.message || e.message) : String(e)
      toast?.(msg, "danger")
    } finally {
      setCreatingBackup(false)
    }
  }

  const deleteBackup = async (filename) => {
    if (!filename) return
    if (!window.confirm(`Delete ${filename}?`)) return
    setBusyFile(filename)
    try {
      await apiDelete(`/api/servers/${id}/backups/${encodeURIComponent(filename)}`)
      toast?.("Backup deleted", "warning")
      loadBackups()
    } catch (e) {
      const msg = e instanceof APIError ? (e.detail?.message || e.message) : String(e)
      toast?.(msg, "danger")
    } finally {
      setBusyFile(null)
    }
  }

  const restoreBackup = async (filename) => {
    if (!filename) return
    setBusyFile(filename)
    try {
      await apiPost(`/api/servers/${id}/backups/${encodeURIComponent(filename)}/restore`)
      toast?.("Backup restored — server is using these saves now", "info")
      setRestoreConfirm(null)
      loadBackups()
      loadSaves()
    } catch (e) {
      const msg = e instanceof APIError ? (e.detail?.message || e.message) : String(e)
      toast?.(msg, "danger")
    } finally {
      setBusyFile(null)
    }
  }

  const wipeSaves = async () => {
    if (running) {
      toast?.("Stop the server before wiping saves", "danger")
      return
    }
    setWiping(true)
    try {
      await apiDelete(`/api/servers/${id}/saves`)
      toast?.("Save data wiped", "warning")
      setWipeOpen(false)
      await loadSaves()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setWiping(false)
    }
  }

  if (savesLoading && configLoading) {
    return (
      <div className="py-12 text-center" style={{ color: C.textMuted, fontSize: sz.base }}>
        Loading persistence state...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-black" style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}>
          Save Management
        </h2>
        <Badge text={autoSaveBadgeText} v={autoSaveBadgeVariant} />
        <div className="flex-1" />
        <Btn small v="ghost" onClick={() => { loadSaves(); loadConfig() }}>
          Refresh
        </Btn>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatBox
          label="Save Files"
          value={stats.count}
          sub={stats.total ? fmtBytes(stats.total) : null}
        />
        <StatBox
          label="Last Save"
          value={stats.latest ? fmtAgo(stats.latest) : "—"}
          sub={stats.latest ? fmtDate(stats.latest) : null}
        />
        <StatBox
          label="Player Saves"
          value="—"
          sub="no player save endpoint"
        />
        <StatBox
          label="Backups"
          value={backups.length}
          sub={backups.length ? "stored locally" : "none yet"}
        />
      </div>

      <Card className="p-5">
        <div
          className="font-black uppercase tracking-widest mb-3"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          Persistence Settings
        </div>
        <div className="mb-4 leading-relaxed" style={{ color: C.textMuted, fontSize: sz.stat }}>
          <strong style={{ color: C.textDim }}>Auto-Save Interval</strong> — how often world state
          is committed to disk (minutes). Set to 0 to disable.<br />
          <strong style={{ color: C.textDim }}>Player Save Time</strong> — how often individual
          player data (inventory, position) is written (seconds). Both require a server restart.
        </div>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label
              className="block font-bold uppercase tracking-wide mb-1.5"
              style={{ color: C.textDim, fontSize: sz.label }}
            >
              Auto-Save Interval (min) · 0 = off
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={autoSave}
              placeholder={!aiSet ? `${REFORGER_DEFAULT_AUTOSAVE_MIN} (engine default)` : undefined}
              disabled={!canEdit}
              onChange={e => setAutoSave(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
              style={{
                background: C.bgInput,
                border: `1px solid ${aiDirty ? C.accent + "60" : C.border}`,
                color: C.text,
                fontSize: sz.input,
                opacity: canEdit ? 1 : 0.5,
              }}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label
              className="block font-bold uppercase tracking-wide mb-1.5"
              style={{ color: C.textDim, fontSize: sz.label }}
            >
              Player Save Time (sec) · default 120
            </label>
            <input
              type="number"
              min="1"
              value={playerSave}
              disabled={!canEdit}
              onChange={e => setPlayerSave(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
              style={{
                background: C.bgInput,
                border: `1px solid ${psDirty ? C.accent + "60" : C.border}`,
                color: C.text,
                fontSize: sz.input,
                opacity: canEdit ? 1 : 0.5,
              }}
            />
          </div>
          <Btn onClick={saveSettings} disabled={!canEdit || !dirty || saving}>
            {saving ? "Saving..." : "Save Config"}
          </Btn>
        </div>
        {running && dirty && (
          <div className="mt-3" style={{ color: C.orange, fontSize: sz.stat }}>
            Server is running — restart it after saving for the new values to take effect.
          </div>
        )}
        {!canEdit && (
          <div className="mt-3" style={{ color: C.textMuted, fontSize: sz.stat }}>
            Admin role required to change persistence settings.
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div
            className="font-black uppercase tracking-widest"
            style={{ color: C.textDim, fontSize: sz.label }}
          >
            Backups{" "}
            <span className="font-normal normal-case" style={{ color: C.textMuted }}>
              ({backups.length})
            </span>
          </div>
          <Btn
            small
            onClick={createBackup}
            disabled={!canEdit || creatingBackup || stats.count === 0}
            title={stats.count === 0 ? "Nothing to back up yet" : ""}
          >
            {creatingBackup ? "Creating..." : "+ Create Backup"}
          </Btn>
        </div>
        {backups.length === 0 ? (
          <div
            className="py-6 text-center"
            style={{ color: C.textMuted, fontSize: sz.base }}
          >
            No backups yet — create one before making changes
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {backups.map(b => (
              <div
                key={b.filename}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="font-mono font-bold truncate"
                    style={{ color: C.textBright, fontSize: sz.base }}
                  >
                    {b.filename}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                      {fmtBytes(b.size)}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                      {fmtDate(b.created_at)}
                    </span>
                  </div>
                </div>
                <Btn
                  small
                  v="ghost"
                  onClick={() => setRestoreConfirm(b.filename)}
                  disabled={!canEdit || !!busyFile || running}
                  title={running ? "Stop the server first" : ""}
                >
                  {busyFile === b.filename && restoreConfirm == null
                    ? "Restoring..."
                    : "Restore"}
                </Btn>
                <Btn
                  small
                  v="danger"
                  onClick={() => deleteBackup(b.filename)}
                  disabled={!canEdit || !!busyFile}
                >
                  {busyFile === b.filename ? "..." : "Del"}
                </Btn>
              </div>
            ))}
          </div>
        )}
        <div
          className="mt-3 leading-relaxed"
          style={{ color: C.textMuted, fontSize: sz.stat }}
        >
          Restore requires the server to be stopped first. Backups stored in{" "}
          <span className="font-mono">profile/saves_backup/</span>.
        </div>
      </Card>

      <Card className="p-5" style={{ border: `1px solid ${C.redBorder}` }}>
        <div
          className="font-black uppercase tracking-widest mb-3"
          style={{ color: C.red, fontSize: sz.label }}
        >
          Danger Zone
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div style={{ color: C.textDim, fontSize: sz.base }}>
            Permanently delete all save data — player inventories, world state, placed objects.
            {stats.count > 0 && (
              <span style={{ color: C.textMuted }}>
                {" "}({stats.count} savepoint{stats.count === 1 ? "" : "s"}, {fmtBytes(stats.total)})
              </span>
            )}
          </div>
          <Btn
            v="danger"
            onClick={() => setWipeOpen(true)}
            disabled={!canEdit || running || stats.count === 0}
          >
            Wipe All Saves
          </Btn>
        </div>
        {running && (
          <div className="mt-3" style={{ color: C.orange, fontSize: sz.stat }}>
            Stop the server before wiping saves.
          </div>
        )}
      </Card>

      <Modal
        open={restoreConfirm != null}
        onClose={() => !busyFile && setRestoreConfirm(null)}
        title="Restore this backup?"
      >
        <div className="flex flex-col gap-4">
          <div style={{ color: C.textDim, fontSize: sz.base, lineHeight: 1.5 }}>
            Restoring{" "}
            <span className="font-mono" style={{ color: C.textBright }}>
              {restoreConfirm}
            </span>{" "}
            will overwrite the current save data. The current saves are moved to{" "}
            <span className="font-mono">.save.pre-restore</span> as a safety net.
          </div>
          {running && (
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: C.redBg,
                border: `1px solid ${C.redBorder}`,
                color: C.red,
                fontSize: sz.stat,
              }}
            >
              Server is currently running — stop it before restoring.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Btn v="ghost" onClick={() => setRestoreConfirm(null)} disabled={!!busyFile}>
              Cancel
            </Btn>
            <Btn
              v="danger"
              onClick={() => restoreBackup(restoreConfirm)}
              disabled={!!busyFile || running}
            >
              {busyFile ? "Restoring..." : "Confirm Restore"}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={wipeOpen} onClose={() => !wiping && setWipeOpen(false)} title="Wipe all saves?">
        <div className="flex flex-col gap-4">
          <div style={{ color: C.textDim, fontSize: sz.base, lineHeight: 1.5 }}>
            This permanently deletes every savepoint under{" "}
            <span className="font-mono">profile/.save/game/</span>. The action cannot be undone.
          </div>
          {stats.count > 0 && (
            <div
              className="rounded-lg px-3 py-2 font-mono"
              style={{
                background: C.redBg,
                border: `1px solid ${C.redBorder}`,
                color: C.red,
                fontSize: sz.stat,
              }}
            >
              {stats.count} savepoint{stats.count === 1 ? "" : "s"} · {fmtBytes(stats.total)}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Btn v="ghost" onClick={() => setWipeOpen(false)} disabled={wiping}>
              Cancel
            </Btn>
            <Btn v="danger" onClick={wipeSaves} disabled={wiping}>
              {wiping ? "Wiping..." : "Confirm Wipe"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
