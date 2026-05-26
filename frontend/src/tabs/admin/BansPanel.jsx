import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiDelete, APIError } from "../../api/index.js"
import { Btn, Badge, Card, Empty, Modal, Input } from "../../components/index.js"

// Bans panel — ported from v1 Admin.jsx lines 272-306.
// Reforger has no banlist file in DSConfigSchema; the panel stores its own
// ban list per instance and best-effort issues #ban via RCON on add.

export default function BansPanel({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const iid = instance?.id
  const isAdmin = ["owner", "head_admin", "admin", "moderator"].includes(authUser?.role)

  const [bans, setBans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [newBan, setNewBan] = useState({ identity: "", reason: "" })

  const load = useCallback(async () => {
    if (iid == null) return
    setLoading(true)
    try {
      const d = await apiGet(`/api/servers/${iid}/bans`)
      setBans(d.bans || [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [iid, toast])

  useEffect(() => { load() }, [load])

  const submitAdd = async () => {
    if (!newBan.identity.trim()) {
      toast?.("Identity required", "danger"); return
    }
    try {
      await apiPost(`/api/servers/${iid}/bans`, {
        identity: newBan.identity.trim(),
        reason: newBan.reason || "Banned",
      })
      toast?.(`Banned ${newBan.identity}`, "danger")
      setShowAdd(false); setNewBan({ identity: "", reason: "" })
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const unban = async (ident) => {
    try {
      await apiDelete(`/api/servers/${iid}/bans/${encodeURIComponent(ident)}`)
      toast?.(`Unbanned ${ident}`, "warning")
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const copyId = (ident) => {
    navigator.clipboard.writeText(ident)
      .then(() => toast?.("ID copied", "info"))
      .catch(() => toast?.("Copy failed", "danger"))
  }

  const fmtTs = (t) => t ? new Date(t * 1000).toLocaleString() : "—"

  const filtered = search
    ? bans.filter(b => b.identity.toLowerCase().includes(search.toLowerCase())
                       || (b.reason || "").toLowerCase().includes(search.toLowerCase()))
    : bans

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-black uppercase tracking-widest"
            style={{ color: C.textBright, fontSize: sz.base + 1, margin: 0 }}>
          Bans
          <span className="ml-3 px-2 py-0.5 rounded font-bold"
                style={{ background: C.bgInput, color: C.textDim,
                         fontSize: sz.label, border: `1px solid ${C.border}` }}>
            {bans.length}
          </span>
        </h2>
        <div className="flex-1" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="rounded-lg px-3 py-1.5 outline-none placeholder:opacity-30 w-44"
          style={{ background: C.bgInput, border: `1px solid ${C.border}`,
                   color: C.text, fontSize: sz.input }}
        />
        {isAdmin && <Btn v="danger" onClick={() => setShowAdd(true)}>+ Ban</Btn>}
        <Btn small v="ghost" onClick={load}>Refresh</Btn>
      </div>

      {loading ? (
        <Empty title="Loading..." />
      ) : filtered.length === 0 ? (
        <Empty title="No bans"
               sub="Use the Ban button on a live player or add a ban here" />
      ) : (
        <div className="space-y-2">
          {filtered.map((b, i) => (
            <Card key={`${b.identity}-${i}`} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold"
                        style={{ color: C.text, fontSize: sz.base }}>
                    {b.identity.length > 28 ? b.identity.slice(0, 26) + "..." : b.identity}
                  </span>
                  <Badge text="BANNED" v="danger" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono truncate"
                        style={{ color: C.textMuted, fontSize: sz.label }}>
                    {b.identity}
                  </span>
                  <button onClick={() => copyId(b.identity)}
                          className="cursor-pointer px-1 py-0.5 rounded"
                          style={{ background: C.bgInput, color: C.textMuted,
                                   border: `1px solid ${C.border}`,
                                   fontSize: sz.label }}>
                    cp
                  </button>
                </div>
                {b.reason && (
                  <div style={{ color: C.red, fontSize: sz.label }}>
                    Reason: {b.reason}
                  </div>
                )}
                {b.added_at ? (
                  <div style={{ color: C.textMuted, fontSize: sz.label }}>
                    Banned: {fmtTs(b.added_at)}
                  </div>
                ) : null}
              </div>
              {isAdmin && (
                <Btn small onClick={() => unban(b.identity)}>Unban</Btn>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)}
             title="Ban by Identity">
        <div className="mb-3 p-3 rounded-lg"
             style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30` }}>
          <span style={{ color: C.orange, fontSize: sz.label }}>
            Identity is the player's GUID (UUID format) or 17-digit SteamID.
            A best-effort RCON #ban is issued so the player is dropped now.
          </span>
        </div>
        <Input label="Identity" mono
               value={newBan.identity}
               onChange={v => setNewBan(p => ({ ...p, identity: v }))}
               placeholder="GUID or 17-digit Steam ID" />
        <Input label="Reason" value={newBan.reason}
               onChange={v => setNewBan(p => ({ ...p, reason: v }))}
               placeholder="Reason for ban" />
        <div className="flex gap-2 justify-end mt-2">
          <Btn v="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn v="danger" onClick={submitAdd}>Ban</Btn>
        </div>
      </Modal>
    </div>
  )
}
