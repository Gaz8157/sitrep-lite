import { useEffect, useState } from "react"
import { useT } from "../ctx.jsx"
import { useAuth } from "./useAuth.jsx"

export default function UserChip({ authUser, onProfile }) {
  const { C, sz } = useT()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const h = () => setOpen(false)
    window.addEventListener("click", h)
    return () => window.removeEventListener("click", h)
  }, [open])

  return (
    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
          background: C.bgInput, border: `1px solid ${C.border}`, color: C.text,
          borderRadius: 8, cursor: "pointer", fontSize: sz.stat, fontWeight: 700,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.accent }} />
        {authUser.username}
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "100%", marginTop: 6,
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8,
          minWidth: 180, boxShadow: "0 6px 24px rgba(0,0,0,0.4)", zIndex: 100,
        }}>
          <div style={{ padding: "8px 12px", color: C.textMuted, fontSize: sz.label, borderBottom: `1px solid ${C.border}` }}>
            {authUser.role}
          </div>
          {onProfile && (
            <DropItem onClick={() => { setOpen(false); onProfile() }}>Profile</DropItem>
          )}
          <DropItem
            danger
            onClick={async () => {
              setOpen(false)
              await logout()
              window.location.assign("/login")
            }}
          >
            Log out
          </DropItem>
        </div>
      )}
    </div>
  )
}

function DropItem({ children, onClick, danger }) {
  const { C, sz } = useT()
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", padding: "10px 14px", textAlign: "left",
      background: "transparent", border: "none", color: danger ? C.red : C.text,
      cursor: "pointer", fontSize: sz.stat, fontWeight: 700,
    }}>{children}</button>
  )
}
