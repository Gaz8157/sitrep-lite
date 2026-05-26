import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiDelete, APIError } from "../../api/index.js"
import { Empty } from "../../components/index.js"
import TrackerControls from "./TrackerControls.jsx"
import PlayersTable from "./PlayersTable.jsx"
import PlayersMap from "./PlayersMap.jsx"

const POLL_INTERVAL_MS = 1500
const TRAIL_LENGTH = 30

export default function PlayersPanel({
  instanceId,
  toast,
  persistEnabled,
  onTogglePersist,
  status,
}) {
  const { C, sz } = useT()
  const [snapshots, setSnapshots] = useState([])
  const [bufferSize, setBufferSize] = useState(0)
  const [lastRx, setLastRx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedUid, setSelectedUid] = useState(null)
  const lastTsRef = useRef(0)
  const visibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true)

  const loadFresh = useCallback(async () => {
    if (instanceId == null) return
    try {
      const r = await apiGet(`/api/servers/${instanceId}/tracker/players`)
      const snaps = Array.isArray(r.snapshots) ? r.snapshots : []
      snaps.sort((a, b) => (a.ts || 0) - (b.ts || 0))
      setSnapshots(snaps)
      setBufferSize(r.buffer_size || snaps.length)
      setLastRx(r.last_rx || 0)
      if (snaps.length) lastTsRef.current = snaps[snaps.length - 1].ts || 0
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  const loadIncremental = useCallback(async () => {
    if (instanceId == null) return
    if (!visibleRef.current) return
    try {
      const sinceTs = lastTsRef.current
      const r = await apiGet(`/api/servers/${instanceId}/tracker/players?since=${sinceTs}`)
      const fresh = Array.isArray(r.snapshots) ? r.snapshots : []
      setBufferSize(r.buffer_size || 0)
      setLastRx(r.last_rx || 0)
      if (fresh.length) {
        fresh.sort((a, b) => (a.ts || 0) - (b.ts || 0))
        lastTsRef.current = fresh[fresh.length - 1].ts || lastTsRef.current
        setSnapshots(prev => {
          const merged = [...prev, ...fresh].slice(-200)
          return merged
        })
      }
    } catch (e) {
      // silent
    }
  }, [instanceId])

  useEffect(() => {
    setLoading(true)
    lastTsRef.current = 0
    loadFresh()
  }, [instanceId, loadFresh])

  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden
    }
    document.addEventListener("visibilitychange", onVis)
    const t = setInterval(loadIncremental, POLL_INTERVAL_MS)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [loadIncremental])

  const clear = async () => {
    setBusy(true)
    try {
      await apiDelete(`/api/servers/${instanceId}/tracker/players`)
      setSnapshots([])
      setBufferSize(0)
      lastTsRef.current = 0
      toast?.("Player buffer cleared")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null
  const players = useMemo(() => Array.isArray(latest?.players) ? latest.players : [], [latest])

  const trails = useMemo(() => {
    const acc = new Map()
    const window = snapshots.slice(-TRAIL_LENGTH)
    for (const snap of window) {
      const ts = snap.ts || 0
      for (const p of (snap.players || [])) {
        if (!p?.uid) continue
        if (!acc.has(p.uid)) acc.set(p.uid, [])
        acc.get(p.uid).push({ x: Number(p.x || 0), z: Number(p.z || 0), ts })
      }
    }
    return acc
  }, [snapshots])

  if (loading && snapshots.length === 0) {
    return (
      <div style={{ color: C.textDim, padding: 16, fontSize: sz.base }}>Loading…</div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <TrackerControls
        onClear={clear}
        persistEnabled={persistEnabled}
        onTogglePersist={onTogglePersist}
        persistLabel="Persist players to disk"
        persistHelp="off by default"
        busy={busy}
        extras={
          <span style={{ color: C.textMuted, fontSize: sz.label - 1 }}>
            buffer {bufferSize} · {players.length} live
          </span>
        }
      />

      {bufferSize === 0 ? (
        <EmptyPlayers C={C} sz={sz} />
      ) : (
        <>
          <PlayersMap
            players={players}
            trails={trails}
            selectedUid={selectedUid}
            onSelectUid={setSelectedUid}
          />
          <PlayersTable
            players={players}
            selectedUid={selectedUid}
            onSelectUid={setSelectedUid}
          />
        </>
      )}
    </div>
  )
}

function EmptyPlayers({ C, sz }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 32,
        textAlign: "center",
      }}
    >
      <div style={{ color: C.textDim, fontSize: sz.base + 2, marginBottom: 6 }}>
        No player data received yet
      </div>
      <div style={{ color: C.textMuted, fontSize: sz.base, lineHeight: 1.6 }}>
        Install the <strong style={{ color: C.text }}>PlayerTracker</strong> mod
        (Workshop ID <code style={{ color: C.accent }}>691608368426C1F2</code>) on this server.
        <br />
        It posts snapshots to <code style={{ color: C.accent }}>/api/ingest/{"{id}"}/players</code> every ~10s.
      </div>
    </div>
  )
}
