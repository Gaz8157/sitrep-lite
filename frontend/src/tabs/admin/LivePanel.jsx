import { useEffect, useState, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, APIError } from "../../api/index.js"
import { Btn, Badge, Card, Empty, Modal, Input } from "../../components/index.js"

// Live Players panel — ported from v1 Admin.jsx lines 151-205.
// Reads /api/servers/{id}/players (BattlEye console.log parse) and lets
// admins kick / ban / broadcast via the existing RCON + bans endpoints.

export default function LivePanel({ instance, toast, authUser }) {
  const { C, sz } = useT()
  const iid = instance?.id
  const isAdmin = ["owner", "head_admin", "admin", "moderator"].includes(authUser?.role)

  const [players, setPlayers] = useState([])
  const [bans, setBans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [broadcast, setBroadcast] = useState("")
  const [sending, setSending] = useState(false)
  const [banTarget, setBanTarget] = useState(null)
  const [banReason, setBanReason] = useState("")

  const load = useCallback(async () => {
    if (iid == null) return
    setLoading(true)
    try {
      const [p, b] = await Promise.all([
        apiGet(`/api/servers/${iid}/players`),
        apiGet(`/api/servers/${iid}/bans`).catch(() => ({ bans: [] })),
      ])
      setPlayers(p.players || [])
      setBans(b.bans || [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setLoading(false) }
  }, [iid, toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const sendBroadcast = async () => {
    if (!broadcast.trim() || sending) return
    setSending(true)
    try {
      await apiPost(`/api/servers/${iid}/rcon/say`, { message: broadcast.trim() })
      toast?.("Broadcast sent", "info")
      setBroadcast("")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally { setSending(false) }
  }

  const kick = async (name) => {
    if (!name) return
    try {
      await apiPost(`/api/servers/${iid}/rcon`, { command: `#kick ${name}` })
      toast?.(`Kicked ${name}`, "warning")
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const submitBan = async () => {
    if (!banTarget) return
    const identity = banTarget.steam_id || banTarget.name
    try {
      await apiPost(`/api/servers/${iid}/bans`,
        { identity, reason: banReason || "Banned" })
      toast?.(`Banned ${banTarget.name || identity}`, "danger")
      setBanTarget(null); setBanReason("")
      load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    }
  }

  const copyText = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => toast?.(`${label} copied`, "info"))
      .catch(() => toast?.("Copy failed", "danger"))
  }

  const banned = new Set(bans.map(b => b.identity))
  const shown = search
    ? players.filter(p => (p.name || "").toLowerCase().includes(search.toLowerCase()))
    : players

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-black uppercase tracking-widest"
            style={{ color: C.textBright, fontSize: sz.base + 1, margin: 0 }}>
          Live Players
          <span className="ml-3 px-2 py-0.5 rounded font-bold"
                style={{ background: C.bgInput, color: C.textDim,
                         fontSize: sz.label, border: `1px solid ${C.border}` }}>
            {players.length}
          </span>
        </h2>
        <div className="flex-1" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search player..."
          className="rounded-lg px-3 py-1.5 outline-none placeholder:opacity-30 w-44"
          style={{ background: C.bgInput, border: `1px solid ${C.border}`,
                   color: C.text, fontSize: sz.input }}
        />
        <Btn small v="ghost" onClick={load}>Refresh</Btn>
      </div>

      {isAdmin && (
        <div className="flex gap-2 p-3 rounded-xl items-center"
             style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
          <span className="font-black self-center px-2"
                style={{ color: C.accent, fontSize: sz.base + 2 }}>[BCAST]</span>
          <input
            value={broadcast} onChange={e => setBroadcast(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendBroadcast()}
            placeholder="Broadcast message to all players..."
            className="flex-1 rounded-lg px-3 py-2 outline-none"
            style={{ background: "transparent", color: C.text, fontSize: sz.input }}
          />
          <Btn onClick={sendBroadcast}
               disabled={sending || !broadcast.trim()}>
            {sending ? "Sending..." : "Broadcast"}
          </Btn>
        </div>
      )}

      {loading && players.length === 0 ? (
        <Empty title="Loading..." sub="Reading BattlEye console log" />
      ) : shown.length === 0 ? (
        <Empty title="No players online"
               sub="Players appear here when they join (5s refresh)" />
      ) : (
        <div className="space-y-2">
          {shown.map((p, i) => {
            const ident = p.steam_id || ""
            const isBanned = ident && banned.has(ident)
            return (
              <div key={`${p.slot}-${i}`}
                   className="rounded-xl px-4 py-3 transition-all"
                   style={{ background: C.bgCard,
                            border: `1.5px solid ${isBanned ? C.red + "40" : C.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center font-black"
                       style={{ background: `${C.accent}0a`, color: C.accent,
                                border: `2px solid ${C.accent}20`,
                                fontSize: sz.base + 5 }}>
                    {(p.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-black"
                            style={{ color: C.textBright, fontSize: sz.base + 2 }}>
                        {p.name || "Unknown"}
                      </span>
                      <Badge text="LIVE" v="default" pulse />
                      <Badge text={`SLOT ${p.slot}`} v="dim" />
                      {isBanned && <Badge text="BANNED" v="danger" />}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ident && (
                        <>
                          <span className="font-mono"
                                style={{ color: C.textMuted, fontSize: sz.label }}>
                            {ident.length > 20 ? ident.slice(0, 18) + "..." : ident}
                          </span>
                          <button onClick={() => copyText(ident, "ID")}
                                  className="cursor-pointer px-1.5 py-0.5 rounded"
                                  style={{ background: C.bgInput, color: C.textMuted,
                                           border: `1px solid ${C.border}`,
                                           fontSize: sz.label }}>
                            copy
                          </button>
                        </>
                      )}
                      {p.ip && (
                        <span className="font-mono"
                              style={{ color: C.blue, fontSize: sz.label }}>
                          {p.ip}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-1.5 items-center justify-end shrink-0">
                      <Btn small v="warning" onClick={() => kick(p.name)}>Kick</Btn>
                      {ident && !isBanned && (
                        <Btn small v="danger"
                             onClick={() => { setBanTarget(p); setBanReason("") }}>
                          Ban
                        </Btn>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!banTarget} onClose={() => setBanTarget(null)}
             title={`Ban ${banTarget?.name || ""}`}>
        <div className="mb-3 p-3 rounded-lg"
             style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30` }}>
          <span style={{ color: C.orange, fontSize: sz.label }}>
            Identity: {banTarget?.steam_id || banTarget?.name || "(unknown)"}
            <br />
            The ban is recorded in the panel ban list and an RCON #ban is
            issued so the player is dropped now.
          </span>
        </div>
        <Input label="Reason" value={banReason}
               onChange={setBanReason} placeholder="Reason for ban" />
        <div className="flex gap-2 justify-end mt-2">
          <Btn v="ghost" onClick={() => setBanTarget(null)}>Cancel</Btn>
          <Btn v="danger" onClick={submitBan}>Ban</Btn>
        </div>
      </Modal>
    </div>
  )
}
