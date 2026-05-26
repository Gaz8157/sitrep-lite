import { useState, useRef, useEffect, useMemo } from "react"
import { useT } from "../../ctx.jsx"
import { apiPost, APIError } from "../../api/index.js"
import { useFetch, useMobile } from "../../hooks/index.js"
import { Btn, Card, Empty, SrcTag } from "../../components/index.js"
import { SRC_LABELS, LVL } from "../../constants.js"

// Reforger console.log line format: "HH:MM:SS[.mmm] SOURCE      : message"
// Sources we see in real logs: ENGINE, RESOURCES, RENDER, NETWORK, SCRIPT,
// WORLD, GUI, INIT, MATERIAL, PLATFORM, PROFILING, BACKEND, plus the v1
// taxonomy keys (SCRIPT/WORLD/NETWORK/RCON/SYSTEM/AI_GM/PLAYER/MOD).
const LINE_RE = /^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([A-Z_]+)\s*:\s*(.*)$/

const EVENT_FILTERS = {
  connect: ["Authenticated player", "Player connected", "Creating player", "player_joined", "authenticating", "joined"],
  disconnect: ["Player disconnected", "disconnected", "player_left", "left"],
  kill: ["player_killed", "killed", "teamkill"],
  chat: ["chat message", "said:", "SCR_Global_Chat", "ChatMessage", "[CHAT]"],
}

function classifyLine(rawLine) {
  if (!rawLine) return null
  const m = rawLine.match(LINE_RE)
  if (!m) {
    // Non-parseable line — still surface it so operators see boot banners etc.
    return { ts: "", source: "SYSTEM", msg: rawLine, level: inferLevel(rawLine), raw: rawLine }
  }
  const [, ts, source, msg] = m
  return { ts, source, msg, level: inferLevel(msg), raw: rawLine }
}

function inferLevel(msg) {
  if (!msg) return "INFO"
  const u = msg.toUpperCase()
  if (u.includes("FATAL")) return "FATAL"
  if (u.includes("ERROR") || u.includes("[ERR]") || u.includes("FAILED")) return "ERROR"
  if (u.includes("WARNING") || u.includes("WARN")) return "WARN"
  if (msg.startsWith(">") || u.includes("RCON COMMAND")) return "CMD"
  if (u.includes("DEBUG")) return "DEBUG"
  return "INFO"
}

export default function Console({ instance, toast }) {
  const { C, sz } = useT()
  const mobile = useMobile()
  const id = instance?.id ?? instance?.instance_id

  // Live status — the parent's `instance` prop is captured at server-pick time
  // and never refreshes, so it'd say "offline" even when the server is up.
  // Poll /status every 3s for the truth.
  const { data: statusData } = useFetch(
    id != null ? `/api/servers/${id}/status` : null,
    3000,
  )
  const liveState = statusData?.state || instance?.state || instance?.status?.state
  const running = liveState === "active" || liveState === "running"

  // Always poll logs — server may have generated logs even when not running
  // (last boot's tail). 2000 lines covers ~10 min at active load and keeps
  // first paint fast even on 500MB log files. For older history, read the
  // log file directly under <instance>/profile/logs/logs_*/console.log.
  const { data, loading } = useFetch(
    id != null ? `/api/servers/${id}/logs?lines=2000` : null,
    running ? 3000 : 8000,
  )

  // Normalize backend payload (raw string lines) → structured entries.
  const allLogs = useMemo(() => {
    const lines = data?.lines || []
    const out = []
    for (const line of lines) {
      const parsed = classifyLine(line)
      if (parsed) out.push(parsed)
    }
    return out
  }, [data])

  const [filter, setFilter] = useState("")
  const [cmd, setCmd] = useState("")
  const [useRegex, setUseRegex] = useState(false)
  const [lvls, setLvls] = useState({ FATAL: true, ERROR: true, WARN: true, INFO: true, DEBUG: false })
  const [srcF, setSrcF] = useState(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem("console-tab") || "logs" } catch { return "logs" }
  })
  useEffect(() => { try { localStorage.setItem("console-tab", tab) } catch {} }, [tab])

  const [showFilters, setShowFilters] = useState(false)
  useEffect(() => { if (tab !== "logs") setShowFilters(false) }, [tab])

  const [eventF, setEventF] = useState(null)
  const ref = useRef(null)
  const iRef = useRef(null)

  const [broadcast, setBroadcast] = useState("")
  const [broadcasting, setBroadcasting] = useState(false)
  const [cmdHistory, setCmdHistory] = useState([])
  const [cmdHistIdx, setCmdHistIdx] = useState(-1)
  const [cmdSending, setCmdSending] = useState(false)

  useEffect(() => {
    if (!ref.current || !autoScroll) return
    ref.current.scrollTop = ref.current.scrollHeight
  }, [allLogs, autoScroll])

  const sendCmd = async () => {
    if (!cmd.trim() || cmdSending || id == null) return
    const c = cmd.trim()
    setCmdHistory(h => [c, ...h.filter(x => x !== c).slice(0, 49)])
    setCmdHistIdx(-1)
    setCmdSending(true)
    try {
      await apiPost(`/api/servers/${id}/rcon`, { command: c })
      toast?.(`> ${c}`, "info")
      setCmd("")
      iRef.current?.focus()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setCmdSending(false)
    }
  }

  const sendBroadcast = async () => {
    if (!broadcast.trim() || broadcasting || id == null) return
    setBroadcasting(true)
    try {
      await apiPost(`/api/servers/${id}/rcon/say`, { message: broadcast.trim() })
      toast?.("Broadcast sent", "info")
      setBroadcast("")
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBroadcasting(false)
    }
  }

  const compiledRegex = useMemo(() => {
    if (!filter || !useRegex) return null
    if (filter.length > 200) return null
    try { return new RegExp(filter, "i") } catch { return null }
  }, [filter, useRegex])

  const matchFilter = (msg) => {
    if (!filter) return true
    if (useRegex) {
      if (!compiledRegex) return true
      return compiledRegex.test(msg)
    }
    return msg.toLowerCase().includes(filter.toLowerCase())
  }

  const matchEvent = (msg) => {
    if (!eventF) return true
    const kws = EVENT_FILTERS[eventF] || []
    return kws.some(k => msg.toLowerCase().includes(k.toLowerCase()))
  }

  const logs = useMemo(
    () => allLogs.filter(l => lvls[l.level] !== false && (!srcF || l.source === srcF) && matchFilter(l.msg) && matchEvent(l.msg)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allLogs, lvls, srcF, filter, useRegex, eventF, compiledRegex],
  )

  // Cap the rendered DOM at the most recent 2000 lines. The poll already
  // tails at 5000, so this only kicks in for "deep filter on a long burst"
  // edge cases. Operators reading recent events still see them; old stuff
  // off-screen never paid for itself.
  const RENDER_CAP = 2000
  const visibleLogs = logs.length > RENDER_CAP ? logs.slice(-RENDER_CAP) : logs
  const truncated = logs.length - visibleLogs.length

  const stats = useMemo(() => {
    const s = {}
    allLogs.forEach(l => { s[l.level] = (s[l.level] || 0) + 1 })
    return s
  }, [allLogs])

  const playerEvents = useMemo(() => {
    const events = []
    allLogs.forEach(l => {
      const m = l.msg
      if (m.includes("Player joined") || m.includes("player_joined") || m.includes("Updating player:")) {
        const nm = m.match(/[Nn]ame[=:\s]+([^,\s|]+)/)
        const idM = m.match(/[Ii]dentity[Ii]d[=:\s]+([0-9a-f-]{20,})/i) || m.match(/identity[=:\s]+([0-9a-f-]{20,})/i)
        events.push({ type: "join", name: nm ? nm[1] : "Unknown", id: idM ? idM[1] : "", ts: l.ts, raw: m })
      } else if (m.includes("Player left") || m.includes("player_left") || m.includes("disconnected")) {
        const nm = m.match(/[Nn]ame[=:\s]+([^,\s|]+)/)
        events.push({ type: "leave", name: nm ? nm[1] : "Unknown", ts: l.ts, raw: m })
      } else if (m.includes("Players connected:")) {
        const ct = m.match(/Players connected:\s*(\d+)\s*\/\s*(\d+)/)
        if (ct) events.push({ type: "count", current: ct[1], max: ct[2], ts: l.ts })
      }
    })
    return events
  }, [allLogs])

  const errorGroups = useMemo(() => {
    const groups = {}
    allLogs.filter(l => l.level === "ERROR" || l.level === "FATAL").forEach(l => {
      const key = l.msg.slice(0, 80)
      if (!groups[key]) groups[key] = { msg: l.msg, count: 0, first: l.ts, last: l.ts }
      groups[key].count++
      groups[key].last = l.ts
    })
    return Object.values(groups).sort((a, b) => b.count - a.count)
  }, [allLogs])

  const exportLogs = () => {
    const text = logs.map(l => `${l.ts} [${l.level}] [${l.source}] ${l.msg}`).join("\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `server-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast?.("Logs exported", "info")
  }

  const joinCount = playerEvents.filter(e => e.type === "join").length
  const tabLabel = (t) => t === "players" ? `Players (${joinCount})` : t === "errors" ? `Errors (${errorGroups.length})` : "logs"

  const offlineHint = running ? null : "Server offline"

  // Pull the launch timestamp out of the log_dir path (the agent returns
  // `.../profile/logs/logs_2026-05-14_11-14-31`). When the server is offline
  // but we have logs, this tells the operator which session they're viewing.
  const sessionStamp = (() => {
    const dir = data?.log_dir
    if (!dir) return null
    const m = dir.match(/logs_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$/)
    if (!m) return null
    return `${m[1]} ${m[2].replaceAll("-", ":")}`
  })()

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-3 mb-2 flex-wrap shrink-0">
        <div className="flex rounded-lg overflow-hidden" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
          {["logs", "players", "errors"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 font-bold capitalize cursor-pointer"
              style={{
                background: tab === t ? C.accentBg : "transparent",
                color: tab === t ? C.accent : C.textDim,
                fontSize: sz.nav,
              }}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: running ? C.accent : C.textMuted }} />
          <span className="font-bold uppercase tracking-wide" style={{ color: running ? C.accent : C.textMuted, fontSize: sz.label }}>
            {running ? "LIVE" : "OFFLINE"}
          </span>
          {!running && sessionStamp && (
            <span
              className="font-mono"
              style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
              title="Most recent session being shown"
            >
              · {sessionStamp}
            </span>
          )}
        </div>
        <Btn small v="ghost" onClick={exportLogs}>Export</Btn>
        <Btn small v={autoScroll ? "default" : "ghost"} onClick={() => setAutoScroll(p => !p)}>
          {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        </Btn>
      </div>

      {tab === "logs" && (
        <>
          {mobile && (
            <button
              onClick={() => setShowFilters(p => !p)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-bold cursor-pointer mb-2 w-full"
              style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.textDim, fontSize: sz.stat }}
            >
              ⚙ Filters {showFilters ? "▲" : "▼"}
              {(Object.values(lvls).some(v => !v) || srcF || eventF || filter) && (
                <span style={{ color: C.accent }}>●</span>
              )}
            </button>
          )}
          {(!mobile || showFilters) && (
            <div className="flex gap-1.5 mb-2 items-center flex-wrap shrink-0">
              {["FATAL", "ERROR", "WARN", "INFO", "DEBUG"].map(l => {
                const ct = stats[l] || 0
                if (l === "FATAL" && ct === 0) return null
                const lv = LVL[l]
                return (
                  <button
                    key={l}
                    onClick={() => setLvls(p => ({ ...p, [l]: !p[l] }))}
                    className="px-2.5 py-1 rounded font-black cursor-pointer transition-opacity"
                    style={{
                      color: lv.c,
                      border: `1px solid ${lv.c}25`,
                      background: lv.c + "0a",
                      opacity: lvls[l] ? 1 : 0.2,
                      fontSize: sz.stat,
                    }}
                  >
                    {l} {ct}
                  </button>
                )
              })}
              {srcF && (
                <button
                  onClick={() => setSrcF(null)}
                  className="px-2.5 py-1 rounded font-black cursor-pointer"
                  style={{ color: C.accent, background: C.accentBg, border: `1px solid ${C.accent}30`, fontSize: sz.stat }}
                >
                  {SRC_LABELS[srcF] || srcF} ×
                </button>
              )}
              <div className="flex-1" />
              {[["connect", C.accent], ["disconnect", C.red], ["kill", C.orange], ["chat", C.blue]].map(([ev, col]) => (
                <button
                  key={ev}
                  onClick={() => setEventF(p => p === ev ? null : ev)}
                  className="px-2.5 py-1 rounded font-bold capitalize cursor-pointer"
                  style={{
                    color: eventF === ev ? col : C.textMuted,
                    background: eventF === ev ? col + "18" : "transparent",
                    border: `1px solid ${eventF === ev ? col + "40" : C.border}`,
                    fontSize: sz.stat,
                  }}
                >
                  {ev}
                </button>
              ))}
              {eventF && (
                <button
                  onClick={() => setEventF(null)}
                  className="px-2 py-1 rounded font-bold cursor-pointer"
                  style={{ color: C.textMuted, background: C.bgInput, border: `1px solid ${C.border}`, fontSize: sz.stat }}
                >
                  all
                </button>
              )}
              <button
                onClick={() => setUseRegex(p => !p)}
                className="px-2 py-1 rounded font-bold cursor-pointer"
                style={{
                  color: useRegex ? C.accent : C.textMuted,
                  background: useRegex ? C.accentBg : "transparent",
                  border: `1px solid ${useRegex ? C.accent + "30" : C.border}`,
                  fontSize: sz.stat,
                }}
              >
                .*
              </button>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={useRegex ? "Regex..." : "Player / keyword..."}
                className={`rounded-lg px-3 py-1.5 outline-none placeholder:opacity-30 ${mobile ? "flex-1" : "w-44"}`}
                style={{
                  background: C.bgInput,
                  border: `1px solid ${filter ? C.accent + "60" : C.border}`,
                  color: C.text,
                  fontSize: sz.input,
                }}
              />
            </div>
          )}

          <div
            ref={ref}
            className="flex-1 rounded-lg overflow-auto leading-[1.8] py-1 font-mono min-h-0"
            style={{ background: C.consoleBg, border: `1px solid ${C.border}`, fontSize: sz.code }}
          >
            {loading && allLogs.length === 0 && (
              <div className="p-4 animate-pulse" style={{ color: C.textMuted }}>Loading...</div>
            )}
            {!loading && allLogs.length === 0 && (
              <div className="p-4" style={{ color: C.textMuted }}>
                {running
                  ? "Waiting for the server to write its first lines..."
                  : data?.log_dir
                    ? "Last session's log was empty."
                    : "No log history yet — start the server to generate logs."}
              </div>
            )}
            {truncated > 0 && (
              <div className="px-3 py-1 font-mono" style={{ color: C.textMuted, background: C.bgInput, fontSize: sz.stat }}>
                · {truncated.toLocaleString()} older lines hidden — narrow your filter or use Export for the full session ·
              </div>
            )}
            {visibleLogs.map((l, i) => {
              const lv = LVL[l.level] || LVL.INFO
              const sev = l.level === "ERROR" || l.level === "FATAL"
              return (
                <div
                  key={i}
                  onClick={() => setSrcF(l.source === srcF ? null : l.source)}
                  className="flex items-start gap-1.5 px-3 py-[2px] cursor-pointer transition-colors"
                  style={sev ? { background: "#ff475706", borderLeft: `2px solid ${lv.c}` } : { borderLeft: "2px solid transparent" }}
                  onMouseEnter={e => { if (!sev) e.currentTarget.style.background = C.bgHover }}
                  onMouseLeave={e => { if (!sev) e.currentTarget.style.background = "transparent" }}
                >
                  <span className="w-3 text-center shrink-0" style={{ color: lv.c }}>{lv.i}</span>
                  {!mobile && (
                    <span className="w-[72px] shrink-0" style={{ color: C.textMuted, fontSize: sz.code - 1 }}>{l.ts}</span>
                  )}
                  <SrcTag source={l.source} />
                  <span
                    className="flex-1 break-words"
                    style={{
                      color: sev ? lv.c : l.level === "WARN" ? C.orange : C.textDim,
                      fontWeight: sev ? 700 : 400,
                    }}
                  >
                    {l.msg}
                  </span>
                </div>
              )
            })}
            <div className="px-3 py-[2px]">
              <span className="animate-[blink_1s_step-end_infinite]" style={{ color: C.accent }}>_</span>
            </div>
          </div>

          <div
            className="flex gap-2 mt-2 items-center px-2 py-1.5 rounded-xl shrink-0"
            style={{
              background: C.bgInput,
              border: `1px solid ${running ? C.accent + "40" : C.border}`,
              opacity: running ? 1 : 0.5,
            }}
          >
            <span className="font-black shrink-0 px-1" style={{ color: C.accent, fontSize: sz.base + 2 }}>📢</span>
            <input
              value={broadcast}
              onChange={e => setBroadcast(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendBroadcast()}
              placeholder={running ? "Broadcast to all players..." : "Server must be running to broadcast"}
              disabled={!running || broadcasting}
              className="flex-1 rounded-lg px-2 py-1.5 outline-none placeholder:opacity-30"
              style={{ background: "transparent", color: C.text, fontSize: sz.input }}
            />
            <Btn small onClick={sendBroadcast} disabled={!running || broadcasting || !broadcast.trim()}>
              {broadcasting ? "Sending..." : "Broadcast"}
            </Btn>
          </div>

          <div className={`grid gap-1.5 mt-1.5 shrink-0 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
            {[
              ["#restart", "Restart", C.orange],
              ["#shutdown", "Shutdown", C.red],
              ["#missions", "List Missions", C.blue],
              ["#monitor1", "Monitor", C.accent],
            ].map(([c, label, col]) => (
              <button
                key={c}
                onClick={() => { setCmd(c); iRef.current?.focus() }}
                disabled={!running}
                title={running ? `Insert command: ${c}` : "Server offline"}
                className="px-3 py-1.5 rounded-lg font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: col + "12", color: col, border: `1px solid ${col}30`, fontSize: sz.stat }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-1.5 items-center shrink-0">
            <span className="font-black" style={{ color: C.accent, fontSize: sz.base + 4 }}>$</span>
            <input
              ref={iRef}
              value={cmd}
              onChange={e => setCmd(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") sendCmd()
                if (e.key === "ArrowUp" && cmdHistory.length > 0) {
                  const i = Math.min(cmdHistIdx + 1, cmdHistory.length - 1)
                  setCmdHistIdx(i)
                  setCmd(cmdHistory[i])
                }
                if (e.key === "ArrowDown") {
                  const i = Math.max(cmdHistIdx - 1, -1)
                  setCmdHistIdx(i)
                  setCmd(i < 0 ? "" : cmdHistory[i])
                }
              }}
              placeholder={running ? "RCON command... (↑↓ history)" : offlineHint}
              disabled={!running || cmdSending}
              className="flex-1 rounded-lg px-3 outline-none font-mono placeholder:opacity-30"
              style={{
                paddingTop: mobile ? 12 : 10,
                paddingBottom: mobile ? 12 : 10,
                background: C.bgInput,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontSize: sz.input,
              }}
            />
            <Btn onClick={sendCmd} disabled={!running || cmdSending || !cmd.trim()}>
              {cmdSending ? "..." : "Execute"}
            </Btn>
          </div>

          {cmdHistory.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1 shrink-0">
              {cmdHistory.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setCmd(h); iRef.current?.focus() }}
                  className="px-2 py-0.5 rounded font-mono cursor-pointer"
                  style={{ background: C.bgInput, color: C.textMuted, border: `1px solid ${C.border}`, fontSize: sz.stat }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-1 shrink-0">
            <span style={{ color: C.textMuted, fontSize: sz.stat }}>
              Click source tags to filter | last 5000 lines (Export for full session) | {eventF ? `Event: ${eventF} | ` : ""}{useRegex ? "Regex" : "Keyword"} search
            </span>
            <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
              {visibleLogs.length}/{logs.length}/{allLogs.length}
            </span>
          </div>
        </>
      )}

      {tab === "players" && (
        <div className="flex-1 overflow-auto">
          {playerEvents.length === 0 ? (
            <Empty title="No player events detected" sub="Player joins/leaves will appear here as they happen" />
          ) : (
            <div className="space-y-1">
              {playerEvents.slice().reverse().map((ev, i) => (
                <Card key={i} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: ev.type === "join" ? C.accent : ev.type === "leave" ? C.red : C.blue }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: C.text, fontSize: sz.base }}>
                        {ev.name || "Player"}
                      </span>
                      <span
                        className="font-bold uppercase"
                        style={{
                          color: ev.type === "join" ? C.accent : ev.type === "leave" ? C.red : C.blue,
                          fontSize: sz.stat,
                        }}
                      >
                        {ev.type === "count" ? `${ev.current}/${ev.max} online` : ev.type}
                      </span>
                    </div>
                    {ev.id && (
                      <div className="font-mono mt-0.5 truncate" style={{ color: C.textMuted, fontSize: sz.stat }}>
                        {ev.id}
                      </div>
                    )}
                  </div>
                  <span className="font-mono shrink-0" style={{ color: C.textMuted, fontSize: sz.stat }}>
                    {ev.ts}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "errors" && (
        <div className="flex-1 overflow-auto">
          {errorGroups.length === 0 ? (
            <Empty title="No errors" sub="Errors will be grouped and counted here" />
          ) : (
            <div className="space-y-1.5">
              {errorGroups.map((eg, i) => (
                <Card key={i} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="px-2 py-0.5 rounded font-black"
                      style={{ background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontSize: sz.stat }}
                    >
                      ×{eg.count}
                    </span>
                    <span className="font-mono" style={{ color: C.textMuted, fontSize: sz.stat }}>
                      {eg.first}{eg.first !== eg.last ? ` - ${eg.last}` : ""}
                    </span>
                  </div>
                  <div className="font-mono break-words" style={{ color: C.red, fontSize: sz.code }}>
                    {eg.msg}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
