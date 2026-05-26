import { useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiPost, APIError } from "../../api/index.js"
import { Btn, Modal } from "../../components/index.js"

const ROLES = ["head_admin", "admin", "moderator", "viewer", "demo"]

export default function AddUserModal({ onClose, onCreated, toast }) {
  const { C, sz } = useT()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("moderator")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState("direct")  // 'direct' | 'invite'
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!username) return
    if (mode === "invite" && !email) {
      toast?.("Email is required for the invite flow", "danger")
      return
    }
    if (mode === "direct" && password.length < 4) {
      toast?.("Password must be at least 4 characters", "danger")
      return
    }
    setBusy(true)
    try {
      const body = { username, role }
      if (email) body.email = email
      if (mode === "direct") body.password = password
      await apiPost("/api/users", body)
      toast?.(
        mode === "direct"
          ? `Created ${username} — they can log in now`
          : `Invited ${username} — reset link emailed`,
        "info",
      )
      onCreated()
    } catch (e) {
      toast?.(e instanceof APIError ? (e.detail || e.message) : String(e), "danger")
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Add User">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
          style={inp(C, sz)}
        />
        <input
          placeholder={mode === "invite" ? "Email (required for invite)" : "Email (optional)"}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inp(C, sz)}
        />
        <select value={role} onChange={e => setRole(e.target.value)} style={inp(C, sz)}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="flex rounded-lg overflow-hidden"
          style={{ background: C.bgInput, border: `1px solid ${C.border}`, marginTop: 4 }}>
          {[
            ["direct", "Set password now"],
            ["invite", "Email a reset link"],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="flex-1 px-3 py-2 font-bold cursor-pointer"
              style={{
                background: mode === m ? C.accentBg : "transparent",
                color: mode === m ? C.accent : C.textDim,
                fontSize: sz.stat, border: "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "direct" && (
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inp(C, sz)}
          />
        )}

        <div style={{ color: C.textMuted, fontSize: sz.label, lineHeight: 1.5 }}>
          {mode === "direct"
            ? "User can sign in immediately. They change their password in Profile → Password and link Discord in Profile → Linked Accounts."
            : "A reset link is emailed to the user (24h validity); requires SMTP configured in Admin → Settings."}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn small v="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn
          onClick={submit}
          disabled={
            busy
            || !username
            || (mode === "direct" && password.length < 4)
            || (mode === "invite" && !email)
          }
        >
          {busy ? "Creating…" : (mode === "direct" ? "Create user" : "Send invite")}
        </Btn>
      </div>
    </Modal>
  )
}

const inp = (C, sz) => ({
  background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
  padding: "9px 12px", borderRadius: 8, fontSize: sz.input, outline: "none",
})
