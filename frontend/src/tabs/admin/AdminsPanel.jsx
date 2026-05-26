import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiDelete, APIError } from "../../api/index.js"
import { Btn, Badge, Card, Empty, Modal, Input } from "../../components/index.js"

// Server Admins panel — ported from v1 Admin.jsx lines 342-371.
// Reads/writes the `game.admins` array in config.json via the backend
// /api/servers/{id}/admins endpoints (which round-trip through config ops).

export default function AdminsPanel({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const iid = instance?.id
  const canEdit = ["owner", "head_admin", "admin"].includes(authUser?.role)

  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newGuid, setNewGuid] = useState("")

  const load = useCallback(async () => {
    if (iid == null) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/servers/${iid}/admins`)
      setAdmins(d.admins || [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [iid, toast])

  useEffect(() => { load() }, [load])

  const submitAdd = async () => {
    const guid = newGuid.trim()
    if (!guid) { toast?.("GUID required", "danger"); return }
    try {
      await apiPost(`/api/servers/${iid}/admins`, { guid })
      toast?.(`Added admin ${guid}`, "info")
      setShowAdd(false); setNewGuid("")
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const remove = async (guid) => {
    if (!confirm(`Remove admin ${guid}?`)) return
    try {
      await apiDelete(`/api/servers/${iid}/admins/${encodeURIComponent(guid)}`)
      toast?.("Admin removed", "warning")
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const copyGuid = (g) => {
    navigator.clipboard.writeText(g)
      .then(() => toast?.("GUID copied", "info"))
      .catch(() => toast?.("Copy failed", "danger"))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-black uppercase tracking-widest"
            style={{ color: C.textBright, fontSize: sz.base + 1, margin: 0 }}>
          Server Admins
          <span className="ml-3 px-2 py-0.5 rounded font-bold"
                style={{ background: C.bgInput, color: C.textDim,
                         fontSize: sz.label, border: `1px solid ${C.border}` }}>
            {admins.length}
          </span>
        </h2>
        <div className="flex-1" />
        {canEdit && <Btn onClick={() => setShowAdd(true)}>+ Add Admin</Btn>}
        <Btn small v="ghost" onClick={load}>Refresh</Btn>
      </div>

      <div className="rounded-lg p-3"
           style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}30` }}>
        <span style={{ color: C.blue, fontSize: sz.label }}>
          These are stored in the server's config.json under `game.admins`.
          Listed players get in-game admin commands. Identity format: UUID
          (PC players) or 17-digit Steam ID.
        </span>
      </div>

      {loading ? (
        <Empty title="Loading..." />
      ) : admins.length === 0 ? (
        <Empty title="No server admins"
               sub="Add a GUID to grant in-game admin access" />
      ) : (
        <div className="space-y-2">
          {admins.map((id, i) => (
            <Card key={`${id}-${i}`} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black shrink-0"
                   style={{ background: C.accentBg, color: C.accent,
                            border: `1px solid ${C.accent}20`,
                            fontSize: sz.base + 2 }}>
                {id[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold"
                     style={{ color: C.text, fontSize: sz.base }}>
                  Admin
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono truncate"
                        style={{ color: C.textMuted, fontSize: sz.label }}>
                    {id}
                  </span>
                  <button onClick={() => copyGuid(id)}
                          className="cursor-pointer px-1 py-0.5 rounded"
                          style={{ background: C.bgInput, color: C.textMuted,
                                   border: `1px solid ${C.border}`,
                                   fontSize: sz.label }}>
                    cp
                  </button>
                </div>
              </div>
              <Badge text="ADMIN" v="info" />
              {canEdit && (
                <Btn small v="danger" onClick={() => remove(id)}>Remove</Btn>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)}
             title="Add Server Admin">
        <Input label="Player Identity (GUID or SteamID)" mono
               value={newGuid} onChange={setNewGuid}
               placeholder="e.g. 0f3b2c9c-7b2f-4e69-a870-63a61efbb44d" />
        <div className="flex gap-2 justify-end mt-2">
          <Btn v="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={submitAdd}>Add</Btn>
        </div>
      </Modal>
    </div>
  )
}
