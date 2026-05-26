import { useState, useEffect, useRef } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, APIError } from "../../api/index.js"
import { Badge, Btn, Card, Input, Modal, Toggle } from "../../components/index.js"
import { DISCORD_BLURPLE } from "../../constants.js"
import EditUserModal from "../users/EditUserModal.jsx"

// SMTP provider presets — host/port/auth pattern for common mail services.
// Picking a provider auto-fills the technical fields so users only need to
// enter the credential-level info (usually their login + an API key or
// app password). `fromMatchesUser` means the From Address must equal the
// username (Gmail, Fastmail) and gets auto-linked to avoid a rejected send.
const SMTP_PROVIDERS = {
  gmail: {
    name: "Gmail", host: "smtp.gmail.com", port: 587, use_tls: true,
    userLabel: "Your Gmail address", userPlaceholder: "yourname@gmail.com",
    passLabel: "App Password", passPlaceholder: "16 characters (spaces OK)",
    fromMatchesUser: true,
    warning: "Don't use your regular Gmail password — it won't work. You need an App Password (see steps below).",
    steps: [
      "Enable 2-Step Verification on your Google account (required before App Passwords unlock)",
      'Open the Google App Passwords page and create one named "SITREP Panel"',
      "Copy the 16-character code Google shows (spaces are fine, Gmail strips them)",
      "Paste it into the App Password field below and hit Save",
    ],
    helpUrl: "https://myaccount.google.com/apppasswords", helpLabel: "Open Gmail App Passwords",
    helpUrl2: "https://myaccount.google.com/signinoptions/two-step-verification", helpLabel2: "Enable 2-Step Verification",
  },
  sendgrid: {
    name: "SendGrid", host: "smtp.sendgrid.net", port: 587, use_tls: true,
    userLabel: "Username", userPlaceholder: "apikey", userFixed: "apikey",
    passLabel: "API Key", passPlaceholder: "SG.xxxxxxxxxxxxxxxx",
    fromMatchesUser: false,
    warning: "SendGrid requires a verified sender address. You cannot send from a random email.",
    steps: [
      "Sign up at sendgrid.com (free tier: 100 emails/day forever)",
      'Settings → API Keys → Create API Key → grant "Mail Send" permission → copy the key',
      "Settings → Sender Authentication → verify the email address you want in the From field",
      "Paste the API key below and put the verified email in From Address (under Advanced)",
    ],
    helpUrl: "https://app.sendgrid.com/settings/api_keys", helpLabel: "Open SendGrid API Keys",
  },
  mailgun: {
    name: "Mailgun", host: "smtp.mailgun.org", port: 587, use_tls: true,
    userLabel: "SMTP Login", userPlaceholder: "postmaster@yourdomain.com",
    passLabel: "SMTP Password", passPlaceholder: "from Mailgun domain settings",
    fromMatchesUser: false,
    warning: "Mailgun needs a verified domain (or their sandbox) before it will deliver.",
    steps: [
      "Sign up at mailgun.com (free tier: 100 emails/day on the sandbox domain)",
      "Sending → Domain settings → SMTP credentials",
      "Copy the SMTP Login (looks like postmaster@...) and password",
      "Paste both below — From Address must be on the Mailgun domain too",
    ],
    helpUrl: "https://app.mailgun.com/app/sending/domains", helpLabel: "Open Mailgun Domains",
  },
  resend: {
    name: "Resend", host: "smtp.resend.com", port: 587, use_tls: true,
    userLabel: "Username", userPlaceholder: "resend", userFixed: "resend",
    passLabel: "API Key", passPlaceholder: "re_xxxxxxxxxxxxxxxx",
    fromMatchesUser: false,
    warning: 'Username is always the literal word "resend". Use your API key as the password.',
    steps: [
      "Sign up at resend.com (free tier: 3000 emails/month, 100/day)",
      'API Keys → Create API Key → give it "Sending access" → copy the re_... key',
      "Verify a domain you own, OR use onboarding@resend.dev as From for testing",
      "Paste the API key as the password below",
    ],
    helpUrl: "https://resend.com/api-keys", helpLabel: "Open Resend API Keys",
  },
  postmark: {
    name: "Postmark", host: "smtp.postmarkapp.com", port: 587, use_tls: true,
    userLabel: "Server Token", userPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx",
    passLabel: "Server Token (same)", passPlaceholder: "same as username above",
    fromMatchesUser: false,
    warning: "Postmark uses the same Server Token for BOTH username AND password.",
    steps: [
      "Sign up at postmarkapp.com (free tier: 100 emails/month)",
      "Create a Server → API Tokens tab → copy the Server API Token",
      "Sender Signatures → verify the email you want to send from",
      "Paste the same token into BOTH fields below",
    ],
    helpUrl: "https://account.postmarkapp.com", helpLabel: "Open Postmark",
  },
  fastmail: {
    name: "Fastmail", host: "smtp.fastmail.com", port: 587, use_tls: true,
    userLabel: "Your Fastmail address", userPlaceholder: "yourname@fastmail.com",
    passLabel: "App Password", passPlaceholder: "16-character app password",
    fromMatchesUser: true,
    warning: "Use an App Password, not your regular Fastmail login password.",
    steps: [
      "Log in to Fastmail → Settings → Privacy & Security → App Passwords",
      'Create one with "Mail (SMTP)" access',
      "Copy the generated password and paste below",
    ],
    helpUrl: "https://www.fastmail.com/settings/security/devicekeys", helpLabel: "Open Fastmail App Passwords",
  },
  custom: {
    name: "Custom / Other SMTP", host: "", port: 587, use_tls: true,
    userLabel: "SMTP Username", userPlaceholder: "login",
    passLabel: "SMTP Password", passPlaceholder: "password or API key",
    fromMatchesUser: false,
    warning: "Enter the host, port, and credentials from your provider. Default port 587 with STARTTLS.",
    steps: [],
  },
}

const MASK = "********"

// Reverse-lookup: guess which provider a stored SMTP_HOST belongs to.
const detectProvider = (host) => {
  const h = (host || "").toLowerCase().trim()
  if (!h) return "gmail"
  for (const [key, cfg] of Object.entries(SMTP_PROVIDERS)) {
    if (cfg.host && h === cfg.host) return key
  }
  return "custom"
}

function DiscordIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 71 55" fill={DISCORD_BLURPLE}>
      <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.8a.2.2 0 0 0-.2.1 40.7 40.7 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.4 37.4 0 0 0-1.8-3.7.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.9 4.9a.2.2 0 0 0-.1.1C1.6 18.2-.9 31.1.3 43.8a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 9 .2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.7.6 1.1.9a.2.2 0 0 1 0 .4 36.2 36.2 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 17.8-9 .2.2 0 0 0 .1-.2c1.5-15.1-2.5-28-10.5-39.5a.2.2 0 0 0-.1-.1zM23.7 36.1c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.9 7.2-6.4 7.2z" />
    </svg>
  )
}

const SectionHeader = ({ title, sub, open, onToggle, action, C, sz }) => (
  <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={onToggle}>
    <div>
      <div className="font-black flex items-center gap-2" style={{ color: C.textBright, fontSize: sz.base + 2 }}>
        <span style={{ color: C.textMuted, fontSize: sz.base }}>{open ? "▾" : "▸"}</span>
        {title}
      </div>
      {sub && <div style={{ color: C.textMuted, fontSize: sz.stat }}>{sub}</div>}
    </div>
    {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
  </div>
)

const errMsg = (e) => e instanceof APIError ? (e.body?.detail?.message || e.body?.detail || e.message) : String(e)

export default function PermissionsPanel({ toast, authUser }) {
  const { C, sz } = useT()
  const isOwner = authUser?.role === "owner"
  const canManage = isOwner

  // Users
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Settings (integrations)
  const [serverSettings, setServerSettings] = useState({})
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [discordEnabledServer, setDiscordEnabledServer] = useState(false)
  const [smtpEnabledServer, setSmtpEnabledServer] = useState(false)

  // Add-user modal
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" })

  // Edit-user modal (full edit incl. per-server access matrix)
  const [editUser, setEditUser] = useState(null)

  // Discord local edits (only changed fields are sent)
  const [discordEdits, setDiscordEdits] = useState({})
  const [discordSaving, setDiscordSaving] = useState(false)

  // Per-user discord link modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkTargetUser, setLinkTargetUser] = useState(null) // {id, username}
  const [linkDiscordId, setLinkDiscordId] = useState("")
  const [linkDiscordName, setLinkDiscordName] = useState("")

  // SMTP local edits + provider picker
  const [smtpEdits, setSmtpEdits] = useState({})
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpProvider, setSmtpProvider] = useState("gmail")
  const [smtpShowAdvanced, setSmtpShowAdvanced] = useState(false)
  const [smtpTestTo, setSmtpTestTo] = useState("")
  const smtpDetectedRef = useRef(false)

  // Section open/closed
  const [showDiscordSection, setShowDiscordSection] = useState(true)
  const [showSmtpSection, setShowSmtpSection] = useState(false)
  const [showUsersSection, setShowUsersSection] = useState(true)
  const [showPermsSection, setShowPermsSection] = useState(false)

  const reloadUsers = async () => {
    setUsersLoading(true)
    try {
      const d = await apiGet("/api/users")
      setUsers(d.users || [])
    } catch (e) {
      toast?.(errMsg(e), "danger")
    } finally { setUsersLoading(false) }
  }

  const reloadSettings = async () => {
    setSettingsLoading(true)
    try {
      const d = await apiGet("/api/settings/integrations")
      setServerSettings(d.values || {})
      setDiscordEnabledServer(!!d.discord_enabled)
      setSmtpEnabledServer(!!d.smtp_enabled)
      setDiscordEdits({})
      setSmtpEdits({})
      if (!smtpDetectedRef.current) {
        setSmtpProvider(detectProvider((d.values || {}).SMTP_HOST))
        smtpDetectedRef.current = true
      }
    } catch (e) {
      toast?.(errMsg(e), "danger")
    } finally { setSettingsLoading(false) }
  }

  useEffect(() => { reloadUsers() }, [])
  useEffect(() => { reloadSettings() }, [])

  // ── Discord values (merged: server + local edits) ─────────────────────────
  const dGet = (key) => discordEdits[key] !== undefined ? discordEdits[key] : (serverSettings[key] || "")
  const dGetSecret = (key) => {
    if (discordEdits[key] !== undefined) return discordEdits[key]
    if (serverSettings[key] === MASK) return ""
    return serverSettings[key] || ""
  }
  const dEdit = (key, v) => setDiscordEdits(e => ({ ...e, [key]: v }))
  const discordDirty = Object.keys(discordEdits).length > 0

  const discordClientId = dGet("DISCORD_CLIENT_ID")
  const discordRedirectUri = dGet("DISCORD_REDIRECT_URI")
  const defaultRedirectUri = `${window.location.origin}/api/auth/discord/callback`
  // Show the default redirect URI in the input when nothing is stored yet — copies easily.
  const discordRedirectDisplay = discordRedirectUri || defaultRedirectUri

  const saveDiscord = async () => {
    setDiscordSaving(true)
    try {
      // Only send changed fields; the secret stays put if user didn't re-type.
      const payload = { ...discordEdits }
      await apiPut("/api/settings/integrations", payload)
      toast?.("Discord settings saved", "info")
      await reloadSettings()
    } catch (e) { toast?.(errMsg(e), "danger") }
    finally { setDiscordSaving(false) }
  }

  // ── SMTP values ────────────────────────────────────────────────────────────
  const sGet = (key) => smtpEdits[key] !== undefined ? smtpEdits[key] : (serverSettings[key] || "")
  const sGetSecret = (key) => {
    if (smtpEdits[key] !== undefined) return smtpEdits[key]
    if (serverSettings[key] === MASK) return ""
    return serverSettings[key] || ""
  }
  const sEdit = (key, v) => setSmtpEdits(e => ({ ...e, [key]: v }))
  const smtpDirty = Object.keys(smtpEdits).length > 0

  const pickSmtpProvider = (key) => {
    const p = SMTP_PROVIDERS[key]
    if (!p) return
    setSmtpProvider(key)
    setSmtpEdits(prev => {
      const next = { ...prev }
      if (p.host) next.SMTP_HOST = p.host
      if (p.port) next.SMTP_PORT = String(p.port)
      // Force the literal username for providers that require it (SendGrid, Resend)
      if (p.userFixed !== undefined) next.SMTP_USER = p.userFixed
      // Re-link From when switching to a provider that requires from==user
      if (p.fromMatchesUser) {
        const u = next.SMTP_USER !== undefined ? next.SMTP_USER : (serverSettings.SMTP_USER || "")
        next.SMTP_FROM = u
      }
      return next
    })
  }
  const updateSmtpUser = (val) => {
    const p = SMTP_PROVIDERS[smtpProvider] || SMTP_PROVIDERS.custom
    setSmtpEdits(prev => {
      const next = { ...prev, SMTP_USER: val }
      if (p.fromMatchesUser) next.SMTP_FROM = val
      return next
    })
  }
  const saveSmtp = async () => {
    setSmtpSaving(true)
    try {
      const payload = { ...smtpEdits }
      // Normalize the port to a string the backend will accept.
      if (payload.SMTP_PORT !== undefined && payload.SMTP_PORT !== "") {
        const n = parseInt(payload.SMTP_PORT, 10)
        if (!Number.isFinite(n)) {
          toast?.("SMTP port must be a number", "danger")
          setSmtpSaving(false)
          return
        }
        payload.SMTP_PORT = String(n)
      }
      await apiPut("/api/settings/integrations", payload)
      toast?.("SMTP settings saved", "info")
      await reloadSettings()
    } catch (e) { toast?.(errMsg(e), "danger") }
    finally { setSmtpSaving(false) }
  }

  // ── Users actions ─────────────────────────────────────────────────────────
  const roles = ["owner", "head_admin", "admin", "moderator", "viewer", "demo"]
  const addUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast?.("Username and password required", "danger"); return
    }
    try {
      await apiPost("/api/users", {
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
      })
      toast?.("User added", "info")
      setShowAdd(false)
      setNewUser({ username: "", password: "", role: "viewer" })
      await reloadUsers()
    } catch (e) { toast?.(errMsg(e), "danger") }
  }
  const removeUser = async (u) => {
    if (!confirm(`Remove user "${u.username}"?`)) return
    try {
      await apiDelete(`/api/users/${u.id}`)
      toast?.("User disabled", "warning")
      await reloadUsers()
    } catch (e) { toast?.(errMsg(e), "danger") }
  }
  const changeRole = async (u, role) => {
    try {
      await apiPatch(`/api/users/${u.id}`, { role })
      toast?.("Role updated", "info")
      await reloadUsers()
    } catch (e) { toast?.(errMsg(e), "danger") }
  }
  const unlinkDiscord = async (u) => {
    try {
      await apiDelete(`/api/users/${u.id}/discord`)
      toast?.(`Unlinked Discord from ${u.username}`, "warning")
      await reloadUsers()
    } catch (e) { toast?.(errMsg(e), "danger") }
  }
  const openLinkModal = (u) => {
    setLinkTargetUser(u)
    setLinkDiscordId("")
    setLinkDiscordName("")
    setShowLinkModal(true)
  }
  const doLinkDiscord = async () => {
    const id = linkDiscordId.trim()
    if (!id) { toast?.("Discord ID required", "danger"); return }
    if (!/^\d{15,22}$/.test(id)) {
      toast?.("Discord ID must be 15-22 digits", "danger"); return
    }
    try {
      await apiPut(`/api/users/${linkTargetUser.id}/discord`, {
        discord_id: id, discord_username: linkDiscordName.trim() || undefined,
      })
      toast?.(`Linked Discord to ${linkTargetUser.username}`, "info")
      setShowLinkModal(false)
      await reloadUsers()
    } catch (e) { toast?.(errMsg(e), "danger") }
  }

  const discordEnabled = discordEnabledServer || !!discordClientId
  const smtpEnabled = smtpEnabledServer || !!sGet("SMTP_HOST")

  if (usersLoading || settingsLoading) {
    return <div className="animate-pulse" style={{ color: C.textDim, fontSize: sz.base }}>Loading...</div>
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── DISCORD OAUTH ── */}
      <div>
        <SectionHeader
          C={C} sz={sz}
          title={<><DiscordIcon size={16} /> Discord OAuth</>}
          sub="Single sign-on via Discord account"
          open={showDiscordSection}
          onToggle={() => setShowDiscordSection(p => !p)}
          action={
            <div className="flex items-center gap-2">
              {discordEnabled ? <Badge text="ACTIVE" v="default" pulse /> : <Badge text="NOT CONFIGURED" v="dim" />}
              {discordDirty && isOwner && (
                <Btn small onClick={saveDiscord} disabled={discordSaving}>
                  {discordSaving ? "Saving..." : "Save"}
                </Btn>
              )}
            </div>
          }
        />
        {showDiscordSection && (
          <div className="space-y-3">
            <div className="rounded-xl p-5 space-y-4" style={{ background: DISCORD_BLURPLE + "0a", border: `1.5px solid ${DISCORD_BLURPLE}30` }}>
              <div className="flex items-start gap-3">
                <DiscordIcon size={32} />
                <div>
                  <div className="font-black" style={{ color: C.textBright, fontSize: sz.base + 1 }}>Discord Application</div>
                  <div style={{ color: C.textMuted, fontSize: sz.stat }}>Players can sign in with their Discord account instead of creating a panel login.</div>
                </div>
              </div>

              {/* Status strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Client ID", discordClientId, !!discordClientId],
                  ["Client Secret",
                    // For the secret, treat MASK on server (or any local edit) as "set"
                    (serverSettings.DISCORD_CLIENT_SECRET === MASK) || !!discordEdits.DISCORD_CLIENT_SECRET,
                    (serverSettings.DISCORD_CLIENT_SECRET === MASK) || !!discordEdits.DISCORD_CLIENT_SECRET,
                  ],
                  ["Redirect URI", discordRedirectUri, !!discordRedirectUri],
                ].map(([label, _val, ok]) => (
                  <div key={label} className="rounded-lg p-2.5 text-center"
                       style={{ background: ok ? C.accentBg : C.redBg, border: `1px solid ${ok ? C.accent + "30" : C.redBorder}` }}>
                    <div className="font-bold" style={{ color: ok ? C.accent : C.red, fontSize: sz.stat }}>{label}</div>
                    <div style={{ color: ok ? C.textDim : C.red, fontSize: sz.stat - 1 }}>{ok ? "✓ Set" : "✗ Missing"}</div>
                  </div>
                ))}
              </div>

              {isOwner && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>Application ID (Client ID)</label>
                    <input
                      value={discordClientId}
                      onChange={e => dEdit("DISCORD_CLIENT_ID", e.target.value)}
                      placeholder="e.g. 1234567890123456789"
                      className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                      style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                      Client Secret
                      {serverSettings.DISCORD_CLIENT_SECRET === MASK && discordEdits.DISCORD_CLIENT_SECRET === undefined && (
                        <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: 8 }}>stored — leave blank to keep</span>
                      )}
                    </label>
                    <Input
                      label=""
                      value={dGetSecret("DISCORD_CLIENT_SECRET")}
                      onChange={v => dEdit("DISCORD_CLIENT_SECRET", v)}
                      type="password"
                      placeholder="From OAuth2 → Client Secret in Discord Dev Portal"
                      mono
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                      Redirect URI <span style={{ color: C.textMuted, fontWeight: 400 }}>(add this in Discord Dev Portal → OAuth2 → Redirects)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={discordRedirectDisplay}
                        onChange={e => dEdit("DISCORD_REDIRECT_URI", e.target.value)}
                        className="flex-1 rounded-lg px-3 py-2.5 outline-none font-mono"
                        style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                      />
                      <Btn small v="ghost" onClick={() => navigator.clipboard.writeText(discordRedirectDisplay).then(() => toast?.("Copied", "info"))}>Copy</Btn>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                      Panel URL <span style={{ color: C.textMuted, fontWeight: 400 }}>(where Discord redirects users after login — set in /etc/sitrep/env)</span>
                    </label>
                    <input
                      value={window.location.origin}
                      readOnly
                      className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textDim, fontSize: sz.input }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Btn onClick={saveDiscord} disabled={discordSaving || !discordDirty}>
                      {discordSaving ? "Saving..." : "Save Discord Settings"}
                    </Btn>
                    {discordEnabled && (
                      <a href="/api/auth/discord/login" target="_blank" rel="noreferrer"
                         className="px-4 py-2 rounded-xl font-black flex items-center gap-2 no-underline"
                         style={{ background: DISCORD_BLURPLE + "18", color: DISCORD_BLURPLE, border: `1.5px solid ${DISCORD_BLURPLE}40`, fontSize: sz.base, textDecoration: "none" }}>
                        <DiscordIcon size={14} />Test Login
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Setup guide */}
              <div className="rounded-lg p-3 space-y-1" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
                <div className="font-bold" style={{ color: C.textDim, fontSize: sz.stat }}>Setup checklist</div>
                {[
                  "Go to discord.com/developers → Your App → OAuth2",
                  `Add redirect: ${discordRedirectDisplay}`,
                  "Copy the Client Secret from that page",
                  "Link Discord IDs to panel users below",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2" style={{ color: C.textMuted, fontSize: sz.stat }}>
                    <span className="font-black shrink-0" style={{ color: C.accent }}>{i + 1}.</span><span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-user Discord linking */}
            <Card className="overflow-hidden">
              <div className="px-5 py-3 font-black uppercase tracking-wide" style={{ borderBottom: `1px solid ${C.border}`, color: C.textDim, fontSize: sz.label, background: C.bgInput }}>
                Discord Account Links
              </div>
              {users.map(u => (
                <div key={u.id} className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black shrink-0"
                       style={{ background: u.discord_id ? DISCORD_BLURPLE + "18" : C.bgInput, color: u.discord_id ? DISCORD_BLURPLE : C.textMuted, border: `1px solid ${u.discord_id ? DISCORD_BLURPLE + "40" : C.border}` }}>
                    {u.discord_id ? <DiscordIcon size={14} /> : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>{u.username}</span>
                      <Badge text={u.role} v="dim" />
                    </div>
                    {u.discord_id
                      ? <div className="font-mono flex items-center gap-2 mt-0.5" style={{ color: DISCORD_BLURPLE, fontSize: sz.stat }}>
                          {u.discord_username && <span className="font-bold">@{u.discord_username}</span>}
                          <span style={{ color: C.textMuted }}>ID: {u.discord_id}</span>
                        </div>
                      : <div style={{ color: C.textMuted, fontSize: sz.stat }}>No Discord account linked</div>}
                  </div>
                  {canManage && (
                    <div className="flex gap-2 shrink-0">
                      {u.discord_id
                        ? <Btn small v="danger" onClick={() => unlinkDiscord(u)}>Unlink</Btn>
                        : <Btn small onClick={() => openLinkModal(u)}>Link Discord</Btn>}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* ── EMAIL / SMTP ── */}
      <div>
        <SectionHeader
          C={C} sz={sz}
          title="Email / SMTP"
          sub="Password reset emails — pick a provider and fill in 2 fields"
          open={showSmtpSection}
          onToggle={() => setShowSmtpSection(p => !p)}
          action={
            <div className="flex items-center gap-2">
              {smtpEnabled ? <Badge text="ACTIVE" v="default" pulse /> : <Badge text="NOT CONFIGURED" v="dim" />}
              {smtpDirty && isOwner && (
                <Btn small onClick={saveSmtp} disabled={smtpSaving}>
                  {smtpSaving ? "Saving..." : "Save"}
                </Btn>
              )}
            </div>
          }
        />
        {showSmtpSection && (() => {
          const P = SMTP_PROVIDERS[smtpProvider] || SMTP_PROVIDERS.custom
          return (
            <div className="space-y-3">
              <div className="rounded-xl p-5 space-y-4" style={{ background: C.bgInput, border: `1.5px solid ${C.border}` }}>
                <div>
                  <div className="font-black" style={{ color: C.textBright, fontSize: sz.base + 1 }}>Outgoing Mail Server</div>
                  <div style={{ color: C.textMuted, fontSize: sz.stat }}>The panel needs to borrow a mail server to send password reset emails. Pick a provider below and we'll auto-fill the technical settings — you only need to enter your login + password/API key.</div>
                </div>

                {/* Provider picker */}
                <div>
                  <label className="block font-bold uppercase tracking-wide mb-2" style={{ color: C.textDim, fontSize: sz.label }}>1. Choose your email provider</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(SMTP_PROVIDERS).map(([key, cfg]) => {
                      const selected = smtpProvider === key
                      return (
                        <button key={key} onClick={() => isOwner && pickSmtpProvider(key)} disabled={!isOwner}
                                className="rounded-lg px-3 py-2.5 font-bold text-left cursor-pointer"
                                style={{ background: selected ? C.accentBg : C.bg, border: `1.5px solid ${selected ? C.accent : C.border}`, color: selected ? C.accent : C.text, fontSize: sz.stat, opacity: isOwner ? 1 : 0.6, cursor: isOwner ? "pointer" : "not-allowed" }}>
                          {cfg.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Provider-specific warning */}
                {P.warning && (
                  <div className="rounded-lg p-3" style={{ background: C.orangeBg, border: `1px solid ${C.orange}40` }}>
                    <div className="flex items-start gap-2">
                      <span style={{ fontSize: sz.base }}>⚠️</span>
                      <div style={{ color: C.text, fontSize: sz.stat, lineHeight: 1.5 }}>{P.warning}</div>
                    </div>
                  </div>
                )}

                {P.steps.length > 0 && (
                  <div className="rounded-lg p-4 space-y-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <div className="font-black uppercase tracking-wide" style={{ color: C.accent, fontSize: sz.label }}>Setup steps for {P.name}</div>
                    <ol className="space-y-1.5" style={{ color: C.text, fontSize: sz.stat, lineHeight: 1.5 }}>
                      {P.steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-black shrink-0" style={{ color: C.accent }}>{i + 1}.</span><span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex gap-2 flex-wrap pt-1">
                      {P.helpUrl && (
                        <a href={P.helpUrl} target="_blank" rel="noreferrer"
                           className="px-3 py-1.5 rounded-lg font-bold no-underline"
                           style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}40`, fontSize: sz.stat, textDecoration: "none" }}>
                          🔗 {P.helpLabel}
                        </a>
                      )}
                      {P.helpUrl2 && (
                        <a href={P.helpUrl2} target="_blank" rel="noreferrer"
                           className="px-3 py-1.5 rounded-lg font-bold no-underline"
                           style={{ background: C.bgInput, color: C.text, border: `1px solid ${C.border}`, fontSize: sz.stat, textDecoration: "none" }}>
                          🔗 {P.helpLabel2}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Credential fields */}
                {isOwner && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>2. {P.userLabel}</label>
                      <input
                        value={sGet("SMTP_USER")}
                        onChange={e => updateSmtpUser(e.target.value)}
                        placeholder={P.userPlaceholder}
                        readOnly={!!P.userFixed}
                        className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                        style={{ background: P.userFixed ? C.bg : C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                      />
                      {P.userFixed && <div style={{ color: C.textMuted, fontSize: sz.stat - 1, marginTop: 4 }}>Fixed by provider — cannot be changed.</div>}
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                        3. {P.passLabel}
                        {serverSettings.SMTP_PASS === MASK && smtpEdits.SMTP_PASS === undefined && (
                          <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: 8 }}>stored — leave blank to keep</span>
                        )}
                      </label>
                      <Input
                        label=""
                        value={sGetSecret("SMTP_PASS")}
                        onChange={v => sEdit("SMTP_PASS", v)}
                        type="password"
                        placeholder={P.passPlaceholder}
                        mono
                      />
                    </div>

                    {/* From Address — only shown inline for providers that need it explicitly */}
                    {!P.fromMatchesUser && (
                      <div>
                        <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                          4. From Address <span style={{ color: C.textMuted, fontWeight: 400 }}>(the sender address recipients see)</span>
                        </label>
                        <input
                          value={sGet("SMTP_FROM")}
                          onChange={e => sEdit("SMTP_FROM", e.target.value)}
                          placeholder="no-reply@yourdomain.com"
                          className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                          style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                        />
                      </div>
                    )}
                    {P.fromMatchesUser && sGet("SMTP_USER") && (
                      <div style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
                        From Address will auto-match your {P.name} username: <span className="font-mono" style={{ color: C.textDim }}>{sGet("SMTP_FROM") || sGet("SMTP_USER")}</span>
                      </div>
                    )}

                    {/* Advanced toggle */}
                    <div>
                      <button
                        onClick={() => setSmtpShowAdvanced(p => !p)}
                        className="font-bold cursor-pointer"
                        style={{ color: C.textMuted, fontSize: sz.stat, background: "transparent", border: "none", padding: 0 }}
                      >
                        {smtpShowAdvanced ? "▾" : "▸"} Advanced settings (host, port, From Name)
                      </button>
                    </div>
                    {smtpShowAdvanced && (
                      <div className="space-y-3 rounded-lg p-3" style={{ background: C.bg, border: `1px dashed ${C.border}` }}>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>SMTP Host</label>
                            <input
                              value={sGet("SMTP_HOST")}
                              onChange={e => sEdit("SMTP_HOST", e.target.value)}
                              placeholder="e.g. smtp.gmail.com"
                              className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                              style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                            />
                          </div>
                          <div>
                            <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>Port</label>
                            <input
                              type="number"
                              value={sGet("SMTP_PORT") || "587"}
                              onChange={e => sEdit("SMTP_PORT", e.target.value)}
                              placeholder="587"
                              className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                              style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                            From Name <span style={{ color: C.textMuted, fontWeight: 400 }}>(shown in recipient's inbox)</span>
                          </label>
                          <input
                            value={sGet("SMTP_FROM_NAME") || "SITREP Panel"}
                            onChange={e => sEdit("SMTP_FROM_NAME", e.target.value)}
                            placeholder="SITREP Panel"
                            className="w-full rounded-lg px-3 py-2.5 outline-none"
                            style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                          />
                        </div>
                        {P.fromMatchesUser && (
                          <div>
                            <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>
                              From Address <span style={{ color: C.textMuted, fontWeight: 400 }}>(auto-linked to username for {P.name})</span>
                            </label>
                            <input
                              value={sGet("SMTP_FROM")}
                              onChange={e => sEdit("SMTP_FROM", e.target.value)}
                              placeholder={sGet("SMTP_USER") || "you@example.com"}
                              className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                              style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save */}
                    <div>
                      <Btn onClick={saveSmtp} disabled={smtpSaving || !smtpDirty}>
                        {smtpSaving ? "Saving..." : smtpDirty ? "Save Settings" : "✓ Saved"}
                      </Btn>
                    </div>

                    {/* Test email card — backend endpoint not implemented in v2, disabled */}
                    <div className="rounded-lg p-4 space-y-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                      <div className="font-black uppercase tracking-wide" style={{ color: C.textDim, fontSize: sz.label }}>4. Send yourself a test email</div>
                      <div style={{ color: C.textMuted, fontSize: sz.stat }}>SMTP test send is not yet exposed in v2 — save the credentials and trigger a real password reset to verify delivery.</div>
                      <div className="flex gap-2 items-end flex-wrap pt-1">
                        <div className="flex-1 min-w-[200px]">
                          <input
                            value={smtpTestTo}
                            onChange={e => setSmtpTestTo(e.target.value)}
                            placeholder="you@example.com"
                            disabled
                            className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
                            style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.textDim, fontSize: sz.input, opacity: 0.6 }}
                          />
                        </div>
                        <span title="SMTP test not implemented yet">
                          <Btn disabled>Send Test Email</Btn>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── PANEL USERS ── */}
      <div>
        <SectionHeader
          C={C} sz={sz}
          title="Panel Users"
          sub="Manage who can access this panel"
          open={showUsersSection}
          onToggle={() => setShowUsersSection(p => !p)}
          action={canManage && <Btn small onClick={() => setShowAdd(true)}>+ Add User</Btn>}
        />
        {showUsersSection && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 flex items-center gap-3 font-bold uppercase tracking-wide"
                 style={{ borderBottom: `1px solid ${C.border}`, color: C.textDim, fontSize: sz.stat }}>
              <span className="flex-1">User</span>
              <span className="w-16 text-center">Discord</span>
              <span className="w-28">Role</span>
              <span className="w-28 text-right">Actions</span>
            </div>
            {users.map(u => {
              const isOwnerAccount = u.role === "owner"
              const isSelf = u.id === authUser?.id || u.username === authUser?.username
              const canEdit = canManage && !isSelf && (!isOwnerAccount || isOwner)
              return (
                <div key={u.id} className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>{u.username}</span>
                      {isSelf && <Badge text="YOU" v="dim" />}
                      {isOwnerAccount && <Badge text="Owner" v="default" />}
                      {u.discord_username && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded font-bold"
                              style={{ background: DISCORD_BLURPLE + "15", color: DISCORD_BLURPLE, border: `1px solid ${DISCORD_BLURPLE}30`, fontSize: sz.stat - 1 }}>
                          <DiscordIcon size={10} />@{u.discord_username}
                        </span>
                      )}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: sz.stat }}>
                      Joined {u.created_at ? new Date(u.created_at * 1000).toLocaleDateString() : "-"}
                    </div>
                  </div>
                  <div className="w-16 flex justify-center">
                    <div className="w-5 h-5 flex items-center justify-center rounded-full"
                         style={{ background: u.discord_id ? DISCORD_BLURPLE + "18" : C.bgInput, border: `1px solid ${u.discord_id ? DISCORD_BLURPLE + "40" : C.border}` }}>
                      {u.discord_id && <DiscordIcon size={10} />}
                    </div>
                  </div>
                  <div className="w-28">
                    <select value={u.role} onChange={e => canEdit && changeRole(u, e.target.value)} disabled={!canEdit}
                            className="w-full rounded-lg px-2 py-1.5 outline-none font-bold"
                            style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.accent, fontSize: sz.input }}>
                      {roles.filter(r => isOwner || r !== "owner").map(r => (
                        <option key={r} value={r}>{r.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28 flex justify-end gap-2">
                    {canEdit && <Btn small v="ghost" onClick={() => setEditUser(u)}>Edit</Btn>}
                    {canEdit && <Btn small v="danger" onClick={() => removeUser(u)}>X</Btn>}
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      {/* ── ACCESS CONTROL (granular permissions) ── */}
      <div>
        <SectionHeader
          C={C} sz={sz}
          title="Access Control"
          sub="Minimum role required per action — coming soon in v2"
          open={showPermsSection}
          onToggle={() => setShowPermsSection(p => !p)}
        />
        {showPermsSection && (
          <Card className="p-5">
            <div style={{ color: C.textMuted, fontSize: sz.stat, lineHeight: 1.5 }}>
              The granular permissions matrix (per-key role assignment) isn't wired up in v2 yet. For now, role-based gates apply: <span className="font-bold" style={{ color: C.text }}>owner</span> &gt; <span className="font-bold" style={{ color: C.text }}>head_admin</span> &gt; <span className="font-bold" style={{ color: C.text }}>admin</span> &gt; <span className="font-bold" style={{ color: C.text }}>moderator</span> &gt; <span className="font-bold" style={{ color: C.text }}>viewer</span> &gt; <span className="font-bold" style={{ color: C.text }}>demo</span>.
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Panel User">
        <Input label="Username" value={newUser.username} onChange={v => setNewUser(p => ({ ...p, username: v }))} placeholder="username" />
        <Input label="Password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} type="password" placeholder="password" />
        <div className="mb-3">
          <label className="block font-bold uppercase tracking-wide mb-1.5" style={{ color: C.textDim, fontSize: sz.label }}>Role</label>
          <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 outline-none"
                  style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}>
            {["demo", "viewer", "moderator", "admin", "head_admin"].map(r => (
              <option key={r} value={r}>{r.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end mt-3">
          <Btn v="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={addUser}>Create User</Btn>
        </div>
      </Modal>

      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)} title={`Link Discord → ${linkTargetUser?.username || ""}`}>
        <div className="mb-4 p-3 rounded-lg" style={{ background: DISCORD_BLURPLE + "10", border: `1px solid ${DISCORD_BLURPLE}30` }}>
          <div style={{ color: DISCORD_BLURPLE, fontSize: sz.stat }}>
            Find the Discord User ID by right-clicking a user in Discord → Copy User ID (requires Developer Mode in Discord settings).
          </div>
        </div>
        <Input label="Discord User ID" value={linkDiscordId} onChange={setLinkDiscordId} placeholder="e.g. 123456789012345678" mono />
        <Input label="Discord Username (optional)" value={linkDiscordName} onChange={setLinkDiscordName} placeholder="e.g. PlayerName" />
        <div className="flex gap-2 justify-end mt-3">
          <Btn v="ghost" onClick={() => setShowLinkModal(false)}>Cancel</Btn>
          <Btn onClick={doLinkDiscord}>Link Account</Btn>
        </div>
      </Modal>

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); reloadUsers() }}
          toast={toast}
        />
      )}
    </div>
  )
}
