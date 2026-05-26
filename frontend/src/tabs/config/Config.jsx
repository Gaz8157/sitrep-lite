import { useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPatch, apiPost, APIError } from "../../api/index.js"
import { Btn, Card, Toggle } from "../../components/index.js"
import PasswordField from "./PasswordField.jsx"
import ScenarioPicker from "./ScenarioPicker.jsx"
import ValidationList from "./ValidationList.jsx"

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2) } catch { return "" }
}

// Read a dot-path value out of a nested object. Returns undefined when any
// segment is missing — the F() helper uses this to decide whether to render
// a field at all (matching v1's "skip if undefined" behaviour).
function getPath(obj, path) {
  const parts = path.split(".")
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

// Deep-set a dot-path on a *cloned* object, returning the new object.
// Creates intermediate objects as needed.
function setPath(obj, path, value) {
  const parts = path.split(".")
  const next = obj == null ? {} : structuredClone(obj)
  let cur = next
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
      cur[parts[i]] = {}
    }
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
  return next
}

// Engine defaults for keys that are off-by-absence in config.json but matter
// to operators (BattlEye is enabled when the key is missing). Applied to
// BOTH canonical and draft on load so the toggle always renders AND a
// no-op (default-shaped) load doesn't show as dirty.
const CONFIG_DEFAULTS = [
  ["game.gameProperties.battlEye", true],
]

function applyConfigDefaults(cfg) {
  let next = cfg
  for (const [path, def] of CONFIG_DEFAULTS) {
    if (getPath(next, path) === undefined) next = setPath(next, path, def)
  }
  return next
}

// Build a minimal patch object containing only the dot-paths whose draft
// value differs from the canonical (loaded) value. The backend PATCH
// endpoint deep-merges, so unchanged keys are simply omitted.
function buildPatch(canonical, draft, paths) {
  let patch = {}
  for (const p of paths) {
    const a = getPath(canonical, p)
    const b = getPath(draft, p)
    if (a === b) continue
    // Also skip if both are undefined (path not present in either).
    if (a === undefined && b === undefined) continue
    patch = setPath(patch, p, b)
  }
  return patch
}

// All dot-paths we surface in the Visual mode. Used both for rendering
// AND to scope the dirty-diff that becomes the PATCH body — fields the
// raw JSON might touch outside this list are not collected here, which
// is fine because the Raw mode takes a different save path (full PUT).
const VISUAL_PATHS = [
  "game.name",
  "bindPort",
  "publicAddress",
  "publicPort",
  "game.maxPlayers",
  "game.password",
  "game.passwordAdmin",
  "game.scenarioId",
  "game.visible",
  "game.crossPlatform",
  "game.gameProperties.battlEye",
  "game.gameProperties.disableThirdPerson",
  "game.gameProperties.serverMaxViewDistance",
  "game.gameProperties.networkViewDistance",
  "rcon.port",
  "rcon.password",
  "rcon.permission",
  "rcon.maxClients",
  "operating.aiLimit",
  "operating.disableAI",
  "operating.playerSaveTime",
  "operating.lobbyPlayerSynchronise",
  "game.gameProperties.persistence.autoSaveInterval",
  "game.gameProperties.persistence.hiveId",
  "game.gameProperties.persistence.loadSessionSave",
  "game.gameProperties.persistence.keepSessionSave",
  "game.gameProperties.persistence.saveRetention",
]

export default function Config({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const state = instance?.state || instance?.status?.state
  const running = state === "active" || state === "running"

  // Canonical config as loaded from the server. Visual edits diff against
  // this; Raw mode also re-syncs against this on reset/reload.
  const [canonical, setCanonical] = useState(null)
  // Draft object for Visual mode — deep-cloned from canonical on load and
  // mutated through updateField().
  const [draft, setDraft] = useState(null)
  // Raw JSON text (independent of draft so the user can paste freely).
  const [rawText, setRawText] = useState("")
  const [rawOriginal, setRawOriginal] = useState("")

  const [mode, setMode] = useState("visual")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [errors, setErrors] = useState([])

  const load = async () => {
    if (id == null) return
    setLoading(true)
    setErrors([])
    try {
      const r = await apiGet(`/api/servers/${id}/config`)
      const cfg = applyConfigDefaults(r.config || {})
      setCanonical(cfg)
      setDraft(structuredClone(cfg))
      const p = pretty(cfg)
      setRawText(p)
      setRawOriginal(p)
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [id])

  // Visual-mode dirtiness — true if any path in VISUAL_PATHS differs.
  const visualDirty = useMemo(() => {
    if (!canonical || !draft) return false
    return VISUAL_PATHS.some(p => getPath(canonical, p) !== getPath(draft, p))
  }, [canonical, draft])

  const rawParsed = useMemo(() => {
    if (!rawText.trim()) return { value: null, error: "Empty document" }
    try { return { value: JSON.parse(rawText), error: null } }
    catch (e) { return { value: null, error: String(e.message || e) } }
  }, [rawText])

  const rawDirty = rawText !== rawOriginal
  const dirty = mode === "raw" ? rawDirty : visualDirty

  // Unsaved-changes guard — fires for either mode.
  useEffect(() => {
    if (!dirty) return
    const h = (e) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  // Visual field updater — deep-sets the path on the draft.
  const updateField = (path, value) => {
    setDraft(d => setPath(d, path, value))
  }

  const saveVisual = async () => {
    if (!visualDirty || saving) return
    const patch = buildPatch(canonical, draft, VISUAL_PATHS)
    if (Object.keys(patch).length === 0) {
      toast?.("No changes to save", "info")
      return
    }
    setSaving(true)
    setErrors([])
    try {
      await apiPatch(`/api/servers/${id}/config`, patch)
      await load()
      toast?.("Config saved", "info")
    } catch (e) {
      const msg = e instanceof APIError ? e.message : String(e)
      toast?.(msg, "danger")
      // Backend surfaces schema-validation as 400 with the first error;
      // run validate to populate the full list inline.
      try {
        const r = await apiPost(`/api/servers/${id}/config/validate`, draft)
        setErrors(r.errors || [])
      } catch { /* swallow */ }
    } finally {
      setSaving(false)
    }
  }

  const saveRaw = async () => {
    if (saving) {
      toast?.("Already saving — wait a moment", "warning")
      return
    }
    if (!rawParsed.value) {
      toast?.(`JSON syntax error: ${rawParsed.error}`, "danger")
      return
    }
    if (!rawDirty) {
      toast?.("No changes to save", "info")
      return
    }
    setSaving(true)
    setErrors([])
    try {
      // Raw replaces the whole document → diff against canonical and PATCH
      // every changed top-level key. We use a top-level deep-merge approach
      // by sending the full parsed object as patch (backend deep-merges).
      await apiPatch(`/api/servers/${id}/config`, rawParsed.value)
      await load()
      toast?.("Config saved", "info")
    } catch (e) {
      const msg = e instanceof APIError ? e.message : String(e)
      toast?.(msg, "danger")
      try {
        const r = await apiPost(`/api/servers/${id}/config/validate`, rawParsed.value)
        setErrors(r.errors || [])
      } catch { /* swallow */ }
    } finally {
      setSaving(false)
    }
  }

  const save = () => (mode === "raw" ? saveRaw() : saveVisual())

  const validate = async () => {
    const body = mode === "raw" ? rawParsed.value : draft
    if (!body || validating) return
    setValidating(true)
    setErrors([])
    try {
      const r = await apiPost(`/api/servers/${id}/config/validate`, body)
      setErrors(r.errors || [])
      if (r.valid) toast?.("Schema OK", "info")
      else toast?.(`${r.errors.length} schema error${r.errors.length === 1 ? "" : "s"}`, "danger")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setValidating(false)
    }
  }

  const reset = () => {
    if (mode === "raw") {
      setRawText(rawOriginal)
    } else {
      setDraft(structuredClone(canonical || {}))
    }
    setErrors([])
  }

  const prettifyClicked = () => {
    if (!rawParsed.value) return
    setRawText(pretty(rawParsed.value))
  }

  // The v1 field renderer — F(label, path, type). Returns null when the
  // value is undefined (matches v1 behaviour: a field absent from the
  // loaded config simply doesn't render).
  const F = (label, path, type = "text") => {
    const val = getPath(draft, path)
    if (val === undefined) return null
    if (type === "toggle") {
      return (
        <Toggle
          key={path}
          label={label}
          value={!!val}
          onChange={() => updateField(path, !val)}
        />
      )
    }
    if (type === "password") {
      return (
        <div key={path} className="mb-3">
          <PasswordField
            label={label}
            value={val ?? ""}
            onChange={v => updateField(path, v)}
          />
        </div>
      )
    }
    const isNum = type === "number"
    return (
      <div key={path} className="mb-3">
        <label
          className="block font-bold uppercase tracking-wide mb-1.5"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          {label}
        </label>
        <input
          type={isNum ? "number" : "text"}
          value={val ?? ""}
          onChange={e => updateField(path, isNum ? Number(e.target.value) : e.target.value)}
          className={`w-full rounded-lg px-3 py-2.5 outline-none ${isNum ? "font-mono" : ""}`}
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ color: C.textMuted, padding: 16, fontSize: sz.base }}>
        Loading config.json...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: 0 }}>
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2
            className="font-black uppercase tracking-widest"
            style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
          >
            Config
          </h2>
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
          >
            {["visual", "raw"].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-3 py-1.5 font-bold cursor-pointer"
                style={{
                  background: mode === m ? C.accentBg : "transparent",
                  color: mode === m ? C.accent : C.textDim,
                  fontSize: sz.nav,
                }}
              >
                {m === "raw" ? "Raw JSON" : "Visual"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span
              className="px-2 py-0.5 rounded font-bold uppercase tracking-wide"
              style={{
                background: C.orangeBg,
                color: C.orange,
                border: `1px solid ${C.orange}40`,
                fontSize: sz.label,
              }}
            >
              Unsaved
            </span>
          )}
          {mode === "raw" && rawParsed.error && (
            <span
              className="px-2 py-0.5 rounded font-bold uppercase tracking-wide"
              style={{
                background: C.redBg,
                color: C.red,
                border: `1px solid ${C.redBorder}`,
                fontSize: sz.label,
              }}
            >
              Syntax err
            </span>
          )}
        </div>
      </div>

      {running && dirty && (
        <div
          className="rounded-lg px-3 py-2 shrink-0"
          style={{
            background: C.orangeBg,
            border: `1px solid ${C.orange}40`,
            color: C.orange,
            fontSize: sz.base,
          }}
        >
          <span style={{ fontWeight: 700 }}>!</span>{" "}
          Restart the server after saving so changes load into the engine.
        </div>
      )}

      {mode === "visual" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-5">
            <h3
              className="font-black uppercase tracking-wide mb-4"
              style={{ color: C.text, fontSize: sz.base }}
            >
              Server
            </h3>
            {F("Name", "game.name")}
            {F("Bind Port", "bindPort", "number")}
            {F("Public Address", "publicAddress")}
            {F("Public Port", "publicPort", "number")}
            {F("Max Players", "game.maxPlayers", "number")}
            {F("Password", "game.password", "password")}
            {F("Admin Password", "game.passwordAdmin", "password")}
            {getPath(draft, "game.scenarioId") !== undefined && (
              <div className="mb-3">
                <ScenarioPicker
                  value={getPath(draft, "game.scenarioId") || ""}
                  onChange={v => updateField("game.scenarioId", v)}
                />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3
              className="font-black uppercase tracking-wide mb-4"
              style={{ color: C.text, fontSize: sz.base }}
            >
              Game
            </h3>
            {F("Visible", "game.visible", "toggle")}
            {F("CrossPlay", "game.crossPlatform", "toggle")}
            {F("BattlEye", "game.gameProperties.battlEye", "toggle")}
            {F("No 3rd Person", "game.gameProperties.disableThirdPerson", "toggle")}
            {F("View Dist", "game.gameProperties.serverMaxViewDistance", "number")}
            {F("Net View Dist", "game.gameProperties.networkViewDistance", "number")}
          </Card>

          <Card className="p-5">
            <h3
              className="font-black uppercase tracking-wide mb-4"
              style={{ color: C.text, fontSize: sz.base }}
            >
              RCON
            </h3>
            {F("Port", "rcon.port", "number")}
            {F("Password", "rcon.password", "password")}
            {F("Permission", "rcon.permission")}
            {F("Max Clients", "rcon.maxClients", "number")}
          </Card>

          <Card className="p-5">
            <h3
              className="font-black uppercase tracking-wide mb-4"
              style={{ color: C.text, fontSize: sz.base }}
            >
              Operating
            </h3>
            {F("AI Limit", "operating.aiLimit", "number")}
            {F("Disable AI", "operating.disableAI", "toggle")}
            {F("Player Save Time (s)", "operating.playerSaveTime", "number")}
            {F("Lobby Sync", "operating.lobbyPlayerSynchronise", "toggle")}
          </Card>

          <Card className="p-5">
            <h3
              className="font-black uppercase tracking-wide mb-4"
              style={{ color: C.text, fontSize: sz.base }}
            >
              Persistence
            </h3>
            <div
              className="text-xs mb-3 leading-relaxed"
              style={{ color: C.textMuted }}
            >
              Auto-save interval controls how often the world state (vehicles, bases, placed objects) is saved. Player Save Time controls how often individual player data (inventory, position) is written. Both require a server restart to take effect.
            </div>
            {F("Auto-Save Interval (min)", "game.gameProperties.persistence.autoSaveInterval", "number")}
            {F("Save Retention (count)", "game.gameProperties.persistence.saveRetention", "number")}
            {F("Hive ID", "game.gameProperties.persistence.hiveId", "number")}
            {F("Load Session Save", "game.gameProperties.persistence.loadSessionSave", "toggle")}
            {F("Keep Session Save", "game.gameProperties.persistence.keepSessionSave", "toggle")}
          </Card>
        </div>
      ) : (
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          spellCheck={false}
          className="w-full rounded-xl px-4 py-3 outline-none font-mono flex-1 min-h-0"
          style={{
            background: C.consoleBg,
            border: `1px solid ${rawParsed.error ? C.redBorder : C.border}`,
            color: C.text,
            fontSize: sz.code,
            resize: "vertical",
            minHeight: "70vh",
            tabSize: 2,
          }}
        />
      )}

      <ValidationList errors={errors} parseError={mode === "raw" ? rawParsed.error : null} />

      <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex gap-2">
          <Btn small v="ghost" onClick={reset} disabled={!dirty}>
            Reset
          </Btn>
          {mode === "raw" && (
            <Btn small v="ghost" onClick={prettifyClicked} disabled={!rawParsed.value}>
              Reformat
            </Btn>
          )}
          <Btn
            small
            v="info"
            onClick={validate}
            disabled={validating || (mode === "raw" ? !rawParsed.value : !draft)}
          >
            {validating ? "Validating..." : "Validate"}
          </Btn>
        </div>
        <Btn
          onClick={save}
          disabled={
            saving ||
            !dirty ||
            (mode === "raw" && !rawParsed.value)
          }
        >
          {saving ? "Saving..." : dirty ? "Save" : "Saved"}
        </Btn>
      </div>
    </div>
  )
}
