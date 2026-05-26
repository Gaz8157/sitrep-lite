import { useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiPatch, apiPut, apiDelete, APIError } from "../../api/index.js"
import { Btn, Modal } from "../../components/index.js"
import ServerAccessMatrix from "./ServerAccessMatrix.jsx"

const ROLES = ["head_admin", "admin", "moderator", "viewer", "demo"]

export default function EditUserModal({ user, onClose, onSaved, toast }) {
  const { C, sz } = useT()
  const [role, setRole] = useState(user.role)
  const [disabled, setDisabled] = useState(!!user.disabled)
  const [busy, setBusy] = useState(false)
  const [discordId, setDiscordId] = useState(user.discord_id || "")
  const [discordName, setDiscordName] = useState(user.discord_username || "")
  const [discordSaved, setDiscordSaved] = useState({ id: user.discord_id || "", name: user.discord_username || "" })
  const [discordBusy, setDiscordBusy] = useState(false)
  const ownerLocked = user.role === "owner"
  const discordDirty = discordId.trim() !== discordSaved.id || discordName.trim() !== discordSaved.name

  const save = async () => {
    setBusy(true)
    try {
      await apiPatch(`/api/users/${user.id}`, { role, disabled })
      toast?.(`Updated ${user.username}`, "info")
      onSaved()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setBusy(false) }
  }

  const saveDiscord = async () => {
    if (discordBusy) return
    const did = discordId.trim()
    if (!did) { toast?.("Discord ID required", "danger"); return }
    if (!/^\d{15,22}$/.test(did)) {
      toast?.("Discord ID should be 15-22 digits (the snowflake)", "danger")
      return
    }
    setDiscordBusy(true)
    try {
      const r = await apiPut(`/api/users/${user.id}/discord`, {
        discord_id: did,
        discord_username: discordName.trim() || null,
      })
      toast?.(`Linked Discord to ${user.username}`, "info")
      setDiscordSaved({
        id: r.user?.discord_id || did,
        name: r.user?.discord_username || discordName.trim(),
      })
      setDiscordId(r.user?.discord_id || did)
      setDiscordName(r.user?.discord_username || discordName.trim())
    } catch (e) {
      toast?.(e instanceof APIError ? (e.detail || e.message) : String(e), "danger")
    } finally { setDiscordBusy(false) }
  }

  const unlinkDiscord = async () => {
    if (discordBusy) return
    if (!confirm(`Unlink Discord from ${user.username}?`)) return
    setDiscordBusy(true)
    try {
      await apiDelete(`/api/users/${user.id}/discord`)
      toast?.(`Unlinked Discord from ${user.username}`, "warning")
      setDiscordSaved({ id: "", name: "" })
      setDiscordId("")
      setDiscordName("")
    } catch (e) {
      toast?.(e instanceof APIError ? (e.detail || e.message) : String(e), "danger")
    } finally { setDiscordBusy(false) }
  }

  const forceLogout = async () => {
    setBusy(true)
    try {
      await apiPatch(`/api/users/${user.id}`, { disabled: true })
      await apiPatch(`/api/users/${user.id}`, { disabled: false })
      toast?.("All sessions cleared", "info")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${user.username}`} size="wide">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Row label="Email">
          <div style={{ color: C.text, fontFamily: "monospace", fontSize: sz.stat }}>{user.email}</div>
        </Row>
        <Row label="Role">
          <select value={role} onChange={e => setRole(e.target.value)} disabled={ownerLocked} style={inp(C, sz)}>
            {ownerLocked && <option value="owner">owner</option>}
            {!ownerLocked && ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Row>
        <Row label="Status">
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.text }}>
            <input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} disabled={ownerLocked} />
            Disabled (cannot log in)
          </label>
        </Row>
        <Row label="Discord">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                placeholder="Discord ID (snowflake) e.g. 123456789012345678"
                value={discordId}
                onChange={e => setDiscordId(e.target.value)}
                style={{ ...inp(C, sz), flex: 1, fontFamily: "monospace" }}
              />
              <input
                placeholder="Username (optional)"
                value={discordName}
                onChange={e => setDiscordName(e.target.value)}
                style={{ ...inp(C, sz), width: 180 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Btn small onClick={saveDiscord} disabled={discordBusy || !discordDirty}>
                {discordBusy ? "Saving…" : (discordSaved.id ? "Update link" : "Link Discord")}
              </Btn>
              {discordSaved.id && (
                <Btn small v="danger" onClick={unlinkDiscord} disabled={discordBusy}>Unlink</Btn>
              )}
              <span style={{ color: C.textMuted, fontSize: sz.label }}>
                {discordSaved.id
                  ? `linked → ${discordSaved.name ? "@" + discordSaved.name + " " : ""}${discordSaved.id}`
                  : "not linked — paste their Discord snowflake to enable Discord login"}
              </span>
            </div>
          </div>
        </Row>
        {!ownerLocked && (
          <Row label="Per-server access">
            <ServerAccessMatrix userId={user.id} userRole={role} />
          </Row>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18 }}>
        <Btn small v="ghost" onClick={forceLogout} disabled={busy || ownerLocked}>Force log out</Btn>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small v="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, children }) {
  const { C, sz } = useT()
  return (
    <div>
      <div style={{ color: C.textDim, fontWeight: 800, fontSize: sz.label, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const inp = (C, sz) => ({
  background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
  padding: "9px 12px", borderRadius: 8, fontSize: sz.input, outline: "none",
})
