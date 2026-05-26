import { useState } from "react"
import { useT } from "../../ctx.jsx"
import PermissionsPanel from "./PermissionsPanel.jsx"
import PlaceholderPanel from "./PlaceholderPanel.jsx"
import LivePanel from "./LivePanel.jsx"
import BansPanel from "./BansPanel.jsx"
import AdminsPanel from "./AdminsPanel.jsx"
import AuditPanel from "./AuditPanel.jsx"
import StoragePanel from "./StoragePanel.jsx"

const SUB_TABS = [
  { id: "permissions", label: "Permissions",      ownerOnly: true },
  { id: "live",        label: "Live Players",     perServer: true },
  { id: "bans",        label: "Bans",             perServer: true },
  { id: "admins",      label: "Server Admins",    perServer: true },
  { id: "storage",     label: "Storage",          perServer: true },
  { id: "history",     label: "Session History",  placeholder: true },
  { id: "alerts",      label: "Alerts",           placeholder: true },
  { id: "audit",       label: "Audit Log",        ownerOnly: true },
]

export default function Admin({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const isOwner = authUser?.role === "owner"
  const visible = SUB_TABS.filter(t => {
    if (t.ownerOnly) return isOwner
    if (t.perServer) return !!instance
    return true
  })
  const [sub, setSub] = useState(() => {
    try {
      const saved = localStorage.getItem("sitrep-admin-sub")
      if (saved && visible.find(t => t.id === saved)) return saved
    } catch {}
    return visible[0]?.id || "permissions"
  })

  const switchSub = (id) => {
    setSub(id)
    try { localStorage.setItem("sitrep-admin-sub", id) } catch {}
  }

  const current = SUB_TABS.find(t => t.id === sub)

  return (
    <div className="flex flex-col gap-3" style={{ height: "100%", minHeight: 0 }}>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <h2 className="font-black uppercase tracking-widest" style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}>
          Admin
        </h2>
        <div className="flex-1" />
        <div className="flex gap-1 rounded-lg overflow-hidden" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
          {visible.map(t => (
            <button
              key={t.id}
              onClick={() => switchSub(t.id)}
              className="px-3 py-1.5 font-bold cursor-pointer"
              style={{
                background: sub === t.id ? C.accentBg : "transparent",
                color: sub === t.id ? C.accent : C.textDim,
                fontSize: sz.nav,
                border: "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {current?.id === "permissions" && isOwner && <PermissionsPanel toast={toast} authUser={authUser} />}
        {current?.id === "live" && instance && <LivePanel instance={instance} toast={toast} authUser={authUser} />}
        {current?.id === "bans" && instance && <BansPanel instance={instance} toast={toast} authUser={authUser} />}
        {current?.id === "admins" && instance && <AdminsPanel instance={instance} toast={toast} authUser={authUser} />}
        {current?.id === "storage" && instance && <StoragePanel instance={instance} toast={toast} authUser={authUser} />}
        {current?.id === "audit" && isOwner && <AuditPanel toast={toast} />}
        {current?.placeholder && <PlaceholderPanel name={current.label} />}
      </div>
    </div>
  )
}
