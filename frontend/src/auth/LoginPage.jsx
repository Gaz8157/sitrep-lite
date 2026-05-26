import { useEffect, useState } from "react"
import { useAuth } from "./useAuth.jsx"

const colors = {
  bg: "#0e1116", card: "#161a22", input: "#1c2230", border: "#2a3142",
  text: "#e6e9ef", muted: "#8b95a8", dim: "#5f6a82", accent: "#6cd5ff",
  red: "#ff6b6b", redBg: "rgba(255,107,107,0.10)", redBorder: "rgba(255,107,107,0.35)",
  discord: "#5865F2",
}

export default function LoginPage() {
  const { login, verify2fa } = useAuth()
  const [view, setView] = useState("login")
  const [discordEnabled, setDiscordEnabled] = useState(false)

  useEffect(() => {
    fetch("/api/auth/public-config")
      .then(r => r.json())
      .then(d => setDiscordEnabled(!!d.discord_enabled))
      .catch(() => {})
    const u = new URLSearchParams(window.location.search)
    if (u.get("reset_token")) setView("reset")
  }, [])

  return (
    <div style={{
      minHeight: "100vh", background: colors.bg, color: colors.text,
      fontFamily: "'JetBrains Mono','SF Mono',Consolas,monospace",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 380, padding: 28, background: colors.card,
        border: `1px solid ${colors.border}`, borderRadius: 14,
        boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
      }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 2, color: colors.text }}>SITREP</div>
          <div style={{ fontSize: 11, color: colors.dim, marginTop: 2 }}>Arma Reforger server panel</div>
        </div>
        {view === "login" && (
          <LoginForm
            onTotp={(t) => setView({ kind: "totp", token: t })}
            onForgot={() => setView("forgot")}
            discordEnabled={discordEnabled}
            login={login}
          />
        )}
        {view?.kind === "totp" && (
          <TotpForm token={view.token} onBack={() => setView("login")} verify={verify2fa} />
        )}
        {view === "forgot" && <ForgotForm onBack={() => setView("login")} />}
        {view === "reset" && <ResetForm onDone={() => setView("login")} />}
      </div>
    </div>
  )
}

function LoginForm({ onTotp, onForgot, discordEnabled, login }) {
  const [u, setU] = useState("")
  const [p, setP] = useState("")
  const [remember, setRemember] = useState(false)
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const dErr = params.get("discord_error")
    if (dErr) setErr(`Discord login failed: ${dErr.replace(/_/g, " ")}`)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr(""); setLoading(true)
    try {
      const r = await login(u, p, remember)
      if (r.requires_2fa) onTotp(r.pending_token)
    } catch {
      setErr("Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Input placeholder="Username" value={u} onChange={setU} autoFocus />
      <Input placeholder="Password" type="password" value={p} onChange={setP} />
      <label style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 14, color: colors.muted, fontSize: 13,
      }}>
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
        Remember me for 30 days
      </label>
      {err && <ErrorBox>{err}</ErrorBox>}
      <button type="submit" disabled={loading || !u || !p} style={primaryBtn}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
      <button type="button" onClick={onForgot} style={ghostBtn}>Forgot password?</button>
      {discordEnabled && (
        <a href="/api/auth/discord" style={{
          ...primaryBtn, background: colors.discord, color: "#fff",
          marginTop: 10, textDecoration: "none", display: "block", textAlign: "center",
        }}>
          Continue with Discord
        </a>
      )}
    </form>
  )
}

function TotpForm({ token, onBack, verify }) {
  const [code, setCode] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(""); setLoading(true)
    try { await verify(token, code) }
    catch { setErr("Invalid code") }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 14, color: colors.muted, fontSize: 13 }}>
        Enter the 6-digit code from your authenticator app.
      </div>
      <Input
        placeholder="000000" value={code} onChange={setCode} autoFocus
        inputMode="numeric" autoComplete="one-time-code"
        style={{ textAlign: "center", letterSpacing: "0.3em", fontFamily: "monospace", fontSize: 18 }}
      />
      {err && <ErrorBox>{err}</ErrorBox>}
      <button type="submit" disabled={loading || code.length < 6} style={primaryBtn}>
        {loading ? "Verifying..." : "Verify"}
      </button>
      <button type="button" onClick={onBack} style={ghostBtn}>Back to sign in</button>
    </form>
  )
}

function ForgotForm({ onBack }) {
  const [email, setEmail] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setDone(true)
    } finally { setLoading(false) }
  }

  if (done) return (
    <div>
      <div style={{ color: colors.muted, fontSize: 14, marginBottom: 18 }}>
        If that email exists, a reset link is on the way.
      </div>
      <button onClick={onBack} style={primaryBtn}>Back to sign in</button>
    </div>
  )

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 14, color: colors.muted, fontSize: 13 }}>
        Enter the email on your account.
      </div>
      <Input placeholder="Email" type="email" value={email} onChange={setEmail} autoFocus />
      <button type="submit" disabled={loading || !email} style={primaryBtn}>
        {loading ? "Sending..." : "Send reset link"}
      </button>
      <button type="button" onClick={onBack} style={ghostBtn}>Back to sign in</button>
    </form>
  )
}

function ResetForm({ onDone }) {
  const [p, setP] = useState("")
  const [p2, setP2] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)
  const token = new URLSearchParams(window.location.search).get("reset_token") || ""

  const submit = async (e) => {
    e.preventDefault()
    setErr("")
    if (p !== p2) { setErr("Passwords don't match"); return }
    if (p.length < 8) { setErr("Password must be 8+ characters"); return }
    setLoading(true)
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: p }),
      })
      if (!r.ok) { setErr("Reset link invalid or expired"); return }
      window.history.replaceState({}, "", "/")
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 14, color: colors.muted, fontSize: 13 }}>Choose a new password.</div>
      <Input placeholder="New password" type="password" value={p} onChange={setP} autoFocus />
      <Input placeholder="Confirm new password" type="password" value={p2} onChange={setP2} />
      {err && <ErrorBox>{err}</ErrorBox>}
      <button type="submit" disabled={loading} style={primaryBtn}>
        {loading ? "Setting..." : "Set password"}
      </button>
    </form>
  )
}

function Input({ placeholder, type = "text", value, onChange, autoFocus, inputMode, autoComplete, style }) {
  return (
    <input
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoFocus={autoFocus}
      inputMode={inputMode}
      autoComplete={autoComplete}
      style={{
        width: "100%", boxSizing: "border-box", padding: "12px 14px",
        background: colors.input, border: `1px solid ${colors.border}`,
        borderRadius: 8, color: colors.text, fontFamily: "inherit", fontSize: 14,
        outline: "none", marginBottom: 12, ...style,
      }}
    />
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      padding: "10px 12px", background: colors.redBg,
      border: `1px solid ${colors.redBorder}`, color: colors.red,
      fontSize: 13, borderRadius: 8, marginBottom: 12,
    }}>{children}</div>
  )
}

const primaryBtn = {
  width: "100%", padding: "12px 14px", background: colors.accent, color: "#000",
  border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer",
  fontFamily: "inherit",
}
const ghostBtn = {
  width: "100%", padding: "10px 14px", background: "transparent", color: colors.muted,
  border: "none", fontSize: 13, cursor: "pointer", marginTop: 8, fontFamily: "inherit",
}
