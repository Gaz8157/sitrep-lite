import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPut, APIError } from "../../api/index.js"
import { Btn } from "../../components/index.js"

const DISCORD_FIELDS = [
  { key: "DISCORD_CLIENT_ID",     label: "Client ID",     placeholder: "10-19 digit Discord application ID" },
  { key: "DISCORD_CLIENT_SECRET", label: "Client Secret", placeholder: "From Discord developer portal — keep secret", secret: true },
  { key: "DISCORD_REDIRECT_URI",  label: "Redirect URI",  placeholder: "https://sitreppanel.com/api/auth/discord/callback" },
]

const SMTP_FIELDS = [
  { key: "SMTP_HOST",      label: "Host",     placeholder: "smtp.gmail.com" },
  { key: "SMTP_PORT",      label: "Port",     placeholder: "587" },
  { key: "SMTP_USER",      label: "Username", placeholder: "noreply@example.com" },
  { key: "SMTP_PASS",      label: "Password", placeholder: "app password", secret: true },
  { key: "SMTP_FROM",      label: "From address", placeholder: "noreply@example.com" },
  { key: "SMTP_FROM_NAME", label: "From name",    placeholder: "SITREP" },
]

const MASK = "********"

export default function SettingsPanel({ toast }) {
  const { C, sz } = useT()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [server, setServer] = useState({})
  const [edits, setEdits] = useState({})
  const [discordEnabled, setDiscordEnabled] = useState(false)
  const [smtpEnabled, setSmtpEnabled] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await apiGet("/api/settings/integrations")
      setServer(d.values || {})
      setDiscordEnabled(!!d.discord_enabled)
      setSmtpEnabled(!!d.smtp_enabled)
      setEdits({})
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onChange = (key, value) => {
    setEdits(e => ({ ...e, [key]: value }))
  }
  const getDisplay = (key, isSecret) => {
    if (edits[key] !== undefined) return edits[key]
    if (isSecret && server[key] === MASK) return ""
    return server[key] || ""
  }
  const isDirty = Object.keys(edits).length > 0

  const save = async () => {
    if (!isDirty) return
    setSaving(true)
    try {
      const payload = {}
      for (const [k, v] of Object.entries(edits)) {
        payload[k] = v
      }
      await apiPut("/api/settings/integrations", payload)
      toast?.("Integration settings saved", "info")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? (e.detail || e.message) : String(e), "danger")
    } finally { setSaving(false) }
  }

  const clearOne = (key) => {
    setEdits(e => ({ ...e, [key]: "" }))
  }

  if (loading) return <div style={{ color: C.textMuted, padding: 16 }}>Loading…</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <Section
        title="Discord OAuth"
        enabledLabel={discordEnabled ? "Enabled" : "Disabled"}
        enabled={discordEnabled}
        helper={
          <>
            Create a Discord app at{" "}
            <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
              discord.com/developers/applications
            </a>
            . Add this redirect URL in the OAuth2 settings before saving:
            <br />
            <code style={{ background: C.bgInput, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: sz.label }}>
              {window.location.origin}/api/auth/discord/callback
            </code>
          </>
        }
      >
        {DISCORD_FIELDS.map(f => (
          <Field
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            secret={f.secret}
            value={getDisplay(f.key, f.secret)}
            stored={server[f.key]}
            dirty={edits[f.key] !== undefined}
            onChange={v => onChange(f.key, v)}
            onClear={() => clearOne(f.key)}
            C={C} sz={sz}
          />
        ))}
      </Section>

      <Section
        title="SMTP (password reset emails)"
        enabledLabel={smtpEnabled ? "Enabled" : "Disabled"}
        enabled={smtpEnabled}
        helper="Used to send password-reset links. Most providers accept TLS on port 587. Gmail requires an App Password (not your account password)."
      >
        {SMTP_FIELDS.map(f => (
          <Field
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            secret={f.secret}
            value={getDisplay(f.key, f.secret)}
            stored={server[f.key]}
            dirty={edits[f.key] !== undefined}
            onChange={v => onChange(f.key, v)}
            onClear={() => clearOne(f.key)}
            C={C} sz={sz}
          />
        ))}
      </Section>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn onClick={save} disabled={!isDirty || saving}>
          {saving ? "Saving…" : isDirty ? "Save changes" : "Saved"}
        </Btn>
        {isDirty && (
          <Btn small v="ghost" onClick={() => setEdits({})} disabled={saving}>
            Discard
          </Btn>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ color: C.textMuted, fontSize: sz.label }}>
          Empty a field to fall back to the value in /etc/sitrep/env.
        </div>
      </div>
    </div>
  )
}

function Section({ title, enabled, enabledLabel, helper, children }) {
  const { C, sz } = useT()
  return (
    <section style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h3 style={{ color: C.textBright, fontSize: sz.base + 1, margin: 0, fontWeight: 800 }}>{title}</h3>
        <span style={{
          padding: "2px 8px", borderRadius: 6, fontSize: sz.label, fontWeight: 800,
          background: enabled ? C.accentBg : C.bgInput,
          color: enabled ? C.accent : C.textMuted,
          border: `1px solid ${enabled ? C.accent + "40" : C.border}`,
        }}>
          {enabledLabel}
        </span>
      </div>
      {helper && (
        <div style={{ color: C.textMuted, fontSize: sz.label, marginBottom: 14, lineHeight: 1.5 }}>
          {helper}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  )
}

function Field({ label, placeholder, secret, value, stored, dirty, onChange, onClear, C, sz }) {
  const hasStored = !!stored && stored !== ""
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <label style={{ color: C.textDim, fontWeight: 700, fontSize: sz.label, textTransform: "uppercase", letterSpacing: "0.6px" }}>
          {label}
        </label>
        <div style={{ flex: 1 }} />
        {dirty && (
          <span style={{ color: C.accent, fontSize: sz.label - 1, fontWeight: 700 }}>
            modified
          </span>
        )}
        {!dirty && hasStored && secret && (
          <span style={{ color: C.textMuted, fontSize: sz.label - 1 }}>
            stored — leave blank to keep
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          type={secret ? "password" : "text"}
          style={{
            flex: 1, background: C.bgInput, border: `1px solid ${dirty ? C.accent + "60" : C.border}`,
            color: C.text, padding: "9px 12px", borderRadius: 8, fontSize: sz.input, outline: "none",
            fontFamily: "inherit",
          }}
        />
        {hasStored && !dirty && (
          <button
            onClick={onClear}
            title="Clear stored override; fall back to /etc/sitrep/env value"
            style={{
              padding: "0 12px", background: "transparent", border: `1px solid ${C.border}`,
              color: C.textDim, borderRadius: 8, cursor: "pointer", fontSize: sz.label, fontWeight: 700,
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
