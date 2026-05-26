import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiDelete, APIError } from "../../api/index.js"
import { Btn, Badge } from "../../components/index.js"
import AddUserModal from "./AddUserModal.jsx"
import EditUserModal from "./EditUserModal.jsx"

export default function Users({ toast, authUser }) {
  const { C, sz } = useT()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiGet("/api/users")
      setUsers(d.users || [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const remove = async (u) => {
    if (!confirm(`Delete ${u.username}? This permanently removes the account, sessions, and server access.`)) return
    try {
      await apiDelete(`/api/users/${u.id}`)
      toast?.(`Deleted ${u.username}`, "warning")
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const fmtTs = (t) => t ? new Date(t * 1000).toLocaleString() : "—"
  const canEdit = authUser?.role === "owner"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-black uppercase tracking-widest" style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}>
          Users
          <span className="ml-3 px-2 py-0.5 rounded font-bold" style={{ background: C.bgInput, color: C.textDim, fontSize: sz.label, border: `1px solid ${C.border}` }}>{users.length}</span>
        </h2>
        {canEdit && <Btn onClick={() => setAddOpen(true)}>+ Add User</Btn>}
      </div>
      {loading ? (
        <div style={{ color: C.textMuted, padding: 16 }}>Loading…</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: sz.stat }}>
            <thead>
              <tr style={{ background: C.bgInput, color: C.textDim, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", fontSize: sz.label }}>
                <td style={{ padding: "10px 12px" }}>Username</td>
                <td>Email</td>
                <td>Role</td>
                <td>Status</td>
                <td>Last login</td>
                <td></td>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ background: C.bgCard, borderTop: `1px solid ${C.border}`, color: C.text }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{u.username}</td>
                  <td style={{ color: C.textMuted }}>{u.email}</td>
                  <td><Badge text={u.role} v="default" /></td>
                  <td>{u.disabled ? <Badge text="disabled" v="warning" /> : <Badge text="active" v="info" />}</td>
                  <td style={{ color: C.textMuted, fontFamily: "monospace" }}>{fmtTs(u.last_login_at)}</td>
                  <td style={{ textAlign: "right", padding: "8px 12px" }}>
                    {canEdit && (
                      <>
                        <Btn small v="ghost" onClick={() => setEditUser(u)}>Edit</Btn>
                        {u.role !== "owner" && u.id !== authUser?.id && (
                          <Btn small v="danger" onClick={() => remove(u)}>Delete</Btn>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onCreated={() => { load(); setAddOpen(false) }} toast={toast} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { load(); setEditUser(null) }} toast={toast} />}
    </div>
  )
}
