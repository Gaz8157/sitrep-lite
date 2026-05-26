import { useEffect, useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, APIError } from "../../api/index.js"
import { Btn, Modal, Badge } from "../../components/index.js"

const AUTOLOAD_HINTS = ["force-autoload-gm", "force_autoload_gm", "forceautoloadgm"]

function fmtBytes(n) {
  if (!n || n < 0) return "0 B"
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

function fmtAgo(ts) {
  if (!ts) return "Never"
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtDate(ts) {
  return ts ? new Date(ts * 1000).toLocaleString() : "—"
}

function shortGuid(g) {
  if (!g || typeof g !== "string") return "—"
  return g.length > 12 ? `${g.slice(0, 8)}…${g.slice(-4)}` : g
}

function pickLatest(saves) {
  if (!Array.isArray(saves) || !saves.length) return null
  let best = null
  for (const s of saves) {
    if (!s) continue
    if (!best || (s.mtime || 0) > (best.mtime || 0)) best = s
  }
  return best
}

function detectAutoload(mods) {
  if (!Array.isArray(mods)) return null
  for (const m of mods) {
    const name = (m?.name || "").toLowerCase()
    if (!name) continue
    for (const h of AUTOLOAD_HINTS) {
      if (name.includes(h)) return m
    }
  }
  return null
}

export function RestartModal({ open, onClose, onConfirm, instanceId, instanceName }) {
  const { C, sz } = useT()
  const [loading, setLoading] = useState(true)
  const [savesError, setSavesError] = useState(null)
  const [saves, setSaves] = useState([])
  const [mods, setMods] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open || instanceId == null) return
    let cancelled = false
    setLoading(true)
    setSavesError(null)
    setConfirming(false)
    ;(async () => {
      const savesP = apiGet(`/api/servers/${instanceId}/saves`)
        .then(r => ({ ok: true, saves: Array.isArray(r?.saves) ? r.saves : [] }))
        .catch(e => ({ ok: false, err: e instanceof APIError ? (e.detail?.message || e.message) : String(e) }))
      const modsP = apiGet(`/api/servers/${instanceId}/mods`)
        .then(r => Array.isArray(r?.mods) ? r.mods : [])
        .catch(() => [])
      const [sRes, mRes] = await Promise.all([savesP, modsP])
      if (cancelled) return
      if (sRes.ok) {
        setSaves(sRes.saves)
      } else {
        setSaves([])
        setSavesError(sRes.err)
      }
      setMods(mRes)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, instanceId])

  const latest = useMemo(() => pickLatest(saves), [saves])
  const autoloadMod = useMemo(() => detectAutoload(mods), [mods])
  const totalSaves = saves.length

  const handleConfirm = async () => {
    if (confirming) return
    setConfirming(true)
    try {
      await onConfirm?.()
    } finally {
      setConfirming(false)
      onClose?.()
    }
  }

  const close = () => { if (!confirming) onClose?.() }

  return (
    <Modal open={open} onClose={close} title={`Restart ${instanceName || `Instance ${instanceId}`}`}>
      <div style={{ color: C.textDim, fontSize: sz.base, lineHeight: 1.5, marginBottom: 14 }}>
        Server will stop cleanly (the engine fires a <span style={{ color: C.textBright, fontFamily: "monospace" }}>SHUTDOWN</span> save), then start back up.
      </div>

      <div
        className="rounded-lg p-4 mb-3"
        style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
      >
        <div
          className="font-black uppercase tracking-widest mb-2"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          Will load on next start
        </div>

        {loading ? (
          <div style={{ color: C.textMuted, fontSize: sz.base }}>Reading <span style={{ fontFamily: "monospace" }}>.save/</span>…</div>
        ) : savesError ? (
          <div style={{ color: C.red, fontSize: sz.stat, fontFamily: "monospace" }}>
            {savesError}
          </div>
        ) : !latest ? (
          <div style={{ color: C.orange, fontSize: sz.base }}>
            No save found in <span style={{ fontFamily: "monospace" }}>.save/</span> — server will start fresh.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
                {latest.savepoint || "savepoint"} · {latest.playthrough || "playthrough"}
              </span>
              <Badge text="SHUTDOWN" v="default" />
              {totalSaves > 1 && (
                <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                  ({totalSaves} total savepoints)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap" style={{ color: C.textMuted, fontSize: sz.stat }}>
              <span>{fmtAgo(latest.mtime)}</span>
              <span style={{ color: C.border }}>·</span>
              <span>{fmtDate(latest.mtime)}</span>
              <span style={{ color: C.border }}>·</span>
              <span>{fmtBytes(latest.size)}</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: C.textMuted, fontSize: sz.stat - 1, fontFamily: "monospace" }}>
              <span>scenario</span>
              <span style={{ color: C.textDim }}>{shortGuid(latest.scenario)}</span>
              {latest.payload_name && (
                <>
                  <span style={{ color: C.border }}>·</span>
                  <span>{latest.payload_name}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {!loading && (
        <div className="mb-4" style={{ fontSize: sz.stat }}>
          {autoloadMod ? (
            <div style={{ color: C.accent }}>
              ✓ Force-Autoload-GM detected
              {autoloadMod.name && (
                <span style={{ color: C.textMuted }}> — {autoloadMod.name}</span>
              )}
            </div>
          ) : mods && mods.length === 0 ? (
            <div style={{ color: C.textMuted }}>
              No mods installed. Vanilla GM ignores existing saves on start (broken in 1.6).
            </div>
          ) : (
            <div style={{ color: C.orange }}>
              ⚠ Force-Autoload-GM not detected. Vanilla 1.6 won't auto-load the save in GM scenarios.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Btn v="ghost" onClick={close} disabled={confirming}>Cancel</Btn>
        <Btn v="warning" onClick={handleConfirm} disabled={confirming || loading}>
          {confirming ? "Restarting…" : "Restart →"}
        </Btn>
      </div>
    </Modal>
  )
}
