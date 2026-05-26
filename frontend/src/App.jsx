import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"
import { Ctx } from "./ctx.jsx"
import { THEMES, TEXT_SIZES, TABS, ROLE_TABS } from "./constants.js"
import { useToast, useMobile } from "./hooks/index.js"
import { Toasts } from "./components/index.js"
import { apiGet } from "./api/index.js"
import { AuthProvider, useAuth } from "./auth/useAuth.jsx"
import LoginPage from "./auth/LoginPage.jsx"

const Clock = memo(function Clock({ color, fontSize }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <span
      className="tabular-nums font-mono shrink-0"
      style={{ color, fontSize }}
    >
      {now.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  )
})
import ServerPicker from "./tabs/serverpicker/index.js"
import Dashboard from "./tabs/dashboard/index.js"
import Console from "./tabs/console/index.js"
import Startup from "./tabs/startup/index.js"
import Admin from "./tabs/admin/index.js"
import Config from "./tabs/config/index.js"
import Mods from "./tabs/mods/index.js"
import Files from "./tabs/files/index.js"
import System from "./tabs/system/index.js"
import Profile from "./tabs/profile/index.js"
import Webhooks from "./tabs/webhooks/index.js"
import Scheduler from "./tabs/scheduler/index.js"

import UserChip from "./auth/UserChip.jsx"

const SELECTED_INSTANCE_KEY = "sitrep-selected-instance"

function TabPlaceholder({ tabId }) {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0, color: "#e0e8f0", fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>{tabId.toUpperCase()}</h2>
      <p style={{ color: "#7a8493", fontSize: 13 }}>Tab not yet implemented.</p>
    </div>
  )
}

const ROUTES = {
  dashboard: Dashboard,
  console:   Console,
  startup:   Startup,
  admin:     Admin,
  config:    Config,
  mods:      Mods,
  files:     Files,
  profile:   Profile,
  webhooks:  Webhooks,
  scheduler: Scheduler,
  system:    System,
}

function SetupWizard({ onDone }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError("")
    if (password.length < 8) { setError("Password must be 8+ characters"); return }
    setLoading(true)
    try {
      const r = await fetch("/api/setup/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      onDone()
    } catch { setError("Failed to create account") }
    finally { setLoading(false) }
  }

  const c = {
    bg: "#0e1116", card: "#161a22", input: "#1c2230", border: "#2a3142",
    text: "#e6e9ef", muted: "#8b95a8", dim: "#5f6a82", accent: "#6cd5ff",
    red: "#ff6b6b", redBg: "rgba(255,107,107,0.10)", redBorder: "rgba(255,107,107,0.35)",
  }

  return (
    <div style={{
      minHeight: "100vh", background: c.bg, color: c.text,
      fontFamily: "'JetBrains Mono','SF Mono',Consolas,monospace",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 420, padding: 32, background: c.card,
        border: `1px solid ${c.border}`, borderRadius: 14,
        boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 2, color: c.text }}>SITREP LITE</div>
        <div style={{ fontSize: 11, color: c.dim, marginTop: 2, marginBottom: 24 }}>First-time setup — create your admin account</div>
        <form onSubmit={submit}>
          <input
            placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoFocus
            autoComplete="off"
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 14px",
              background: c.input, border: `1px solid ${c.border}`,
              borderRadius: 8, color: c.text, fontFamily: "inherit", fontSize: 14,
              outline: "none", marginBottom: 12,
            }}
          />
          <input
            placeholder="Password (8+ characters)" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 14px",
              background: c.input, border: `1px solid ${c.border}`,
              borderRadius: 8, color: c.text, fontFamily: "inherit", fontSize: 14,
              outline: "none", marginBottom: 12,
            }}
          />
          {error && (
            <div style={{
              padding: "10px 12px", background: c.redBg,
              border: `1px solid ${c.redBorder}`, color: c.red,
              fontSize: 13, borderRadius: 8, marginBottom: 12,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading || !username || !password} style={{
            width: "100%", padding: "12px 14px", background: c.accent, color: "#000",
            border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer",
            fontFamily: "inherit",
          }}>
            {loading ? "Creating..." : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppGated />
    </AuthProvider>
  )
}

function AppGated() {
  const { me, loading, refresh } = useAuth()
  const [needsSetup, setNeedsSetup] = useState(null)

  useEffect(() => {
    fetch("/api/setup/status")
      .then(r => r.json())
      .then(d => setNeedsSetup(!d.setup_complete))
      .catch(() => setNeedsSetup(false))
  }, [])

  if (loading || needsSetup === null) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0e1116", color: "#e6e9ef",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
      }}>
        Loading…
      </div>
    )
  }
  if (needsSetup) return <SetupWizard onDone={() => { setNeedsSetup(false); refresh() }} />
  if (!me) return <LoginPage />
  return <AppRoot authUser={me} />
}

function AppRoot({ authUser }) {
  const [themeName, setThemeName] = useState(() => localStorage.getItem("sitrep-theme") || "dark")
  const [textSize, setTextSize] = useState(() => localStorage.getItem("sitrep-ts") || "M")
  const C = THEMES[themeName] || THEMES.dark
  const sz = TEXT_SIZES[textSize] || TEXT_SIZES.M
  const { toasts, push: toast, dismiss: dismissToast } = useToast()
  const [selectedInstance, setSelectedInstance] = useState(null)

  const ctxFullValue = useMemo(
    () => ({ C, sz, themeName, textSizeKey: textSize, setTheme: setThemeName, setTextSize }),
    [C, sz, themeName, textSize],
  )

  const selectInstance = useCallback((instance) => {
    setSelectedInstance(instance)
    if (instance) {
      try { localStorage.setItem(SELECTED_INSTANCE_KEY, String(instance.id ?? instance.instance_id ?? "")) } catch {}
    } else {
      try { localStorage.removeItem(SELECTED_INSTANCE_KEY) } catch {}
    }
  }, [])

  const backToServers = useCallback(() => {
    setSelectedInstance(null)
    try { localStorage.removeItem(SELECTED_INSTANCE_KEY) } catch {}
  }, [])

  useEffect(() => {
    const savedId = (() => {
      try { return localStorage.getItem(SELECTED_INSTANCE_KEY) } catch { return null }
    })()
    if (!savedId) return
    apiGet("/api/servers").then(d => {
      const saved = (d?.instances || []).find(i => String(i.id ?? i.instance_id) === savedId)
      if (saved) setSelectedInstance(saved)
      else { try { localStorage.removeItem(SELECTED_INSTANCE_KEY) } catch {} }
    }).catch(() => {})
  }, [])

  if (!selectedInstance) {
    return (
      <Ctx.Provider value={ctxFullValue}>
        <Toasts toasts={toasts} dismiss={dismissToast} />
        <ServerPicker
          authUser={authUser}
          onSelect={selectInstance}
          toast={toast}
          themeName={themeName}
          setThemeName={setThemeName}
          textSize={textSize}
          setTextSize={setTextSize}
        />
      </Ctx.Provider>
    )
  }
  return (
    <AppShell
      C={C}
      sz={sz}
      themeName={themeName}
      setThemeName={setThemeName}
      textSize={textSize}
      setTextSize={setTextSize}
      authUser={authUser}
      toast={toast}
      toasts={toasts}
      dismissToast={dismissToast}
      selectedInstance={selectedInstance}
      onBackToServers={backToServers}
    />
  )
}

function AppShell({
  C, sz, themeName, setThemeName, textSize, setTextSize, authUser,
  toast, toasts, dismissToast, selectedInstance, onBackToServers,
}) {
  const getHash = () => {
    const h = window.location.hash.slice(1)
    if (TABS.find(t => t.id === h)) return h
    const preferred = (() => {
      try { return localStorage.getItem("sitrep-default-tab") } catch { return null }
    })()
    if (preferred && TABS.find(t => t.id === preferred)) return preferred
    return "dashboard"
  }
  const [tab, setTab] = useState(getHash)
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("sitrep-sb") !== "0")
  const [showThemes, setShowThemes] = useState(false)
  const mobile = useMobile()
  const swipeRef = useRef(null)

  const allowedTabIds = new Set(ROLE_TABS[authUser.role] || ROLE_TABS.viewer || [])
  const visibleTabs = TABS.filter(t => allowedTabIds.has(t.id))

  useEffect(() => {
    const h = () => setTab(getHash())
    window.addEventListener("hashchange", h)
    return () => window.removeEventListener("hashchange", h)
  }, [])

  const nav = (id) => {
    window.location.hash = id
    setTab(id)
    if (mobile) setSidebarOpen(false)
  }

  const onSwipeStart = (e) => { if (mobile) swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onSwipeEnd = (e) => {
    if (!mobile || !swipeRef.current) return
    const dx = e.changedTouches[0].clientX - swipeRef.current.x
    const dy = e.changedTouches[0].clientY - swipeRef.current.y
    swipeRef.current = null
    if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return
    const cur = visibleTabs.findIndex(t => t.id === tab)
    if (dx < 0 && cur < visibleTabs.length - 1) nav(visibleTabs[cur + 1].id)
    else if (dx > 0 && cur > 0) nav(visibleTabs[cur - 1].id)
  }

  const Tab = ROUTES[tab] || TabPlaceholder
  const MOBILE_NAV_PRIORITY = ["dashboard", "console", "admin", "mods"]
  const bottomNavTabs = MOBILE_NAV_PRIORITY
    .map(id => visibleTabs.find(t => t.id === id))
    .filter(Boolean)
    .slice(0, 4)
  const hasMore = visibleTabs.length > 4

  const ctxValue = useMemo(() => ({ C, sz, themeName, textSizeKey: textSize, setTheme: setThemeName, setTextSize }), [C, sz, themeName, textSize])

  return (
    <Ctx.Provider value={ctxValue}>
      <div
        className="min-h-screen"
        style={{
          background: C.bg, color: C.text,
          fontFamily: "'JetBrains Mono','Fira Code','SF Mono',Consolas,monospace",
          position: "relative",
        }}
      >
        <Toasts toasts={toasts} dismiss={dismissToast} />
        <div
          className="px-3 h-12 flex items-center gap-2 select-none"
          style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}` }}
        >
          <button
            onClick={() => setSidebarOpen(p => { localStorage.setItem("sitrep-sb", !p ? "1" : "0"); return !p })}
            className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              color: C.textDim, fontSize: 18,
              background: sidebarOpen && !mobile ? C.accentBg : "transparent",
            }}
            aria-label="Toggle sidebar"
          >
            ≡
          </button>
          <button
            onClick={onBackToServers}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg font-bold cursor-pointer shrink-0"
            style={{ background: C.bgInput, color: C.textDim, border: `1px solid ${C.border}`, fontSize: sz.stat }}
            onMouseEnter={e => (e.currentTarget.style.color = C.text)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textDim)}
          >
            ← {mobile ? "" : "Servers"}
          </button>
          {selectedInstance && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg min-w-0 overflow-hidden"
              style={{ background: C.accentBg, border: `1px solid ${C.accent}30` }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.accent }} />
              <span className="font-bold truncate" style={{ color: C.accent, fontSize: sz.stat }}>
                {selectedInstance.display_name || selectedInstance.name}
                {!mobile && (selectedInstance.id != null ? ` #${selectedInstance.id}` : "")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="font-black tracking-wide" style={{ color: C.textBright, fontSize: sz.base + 2 }}>
              SITREP
            </span>
            <span className="font-bold" style={{ color: C.accent, fontSize: sz.stat }}>
              LITE
            </span>
          </div>
          <div className="flex-1" />
          {!mobile && (
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              {["S", "M", "L", "XL", "XXL"].map(s => (
                <button
                  key={s}
                  onClick={() => { setTextSize(s); localStorage.setItem("sitrep-ts", s) }}
                  className="px-2.5 py-1 font-bold cursor-pointer"
                  style={{
                    background: textSize === s ? C.accentBg : "transparent",
                    color: textSize === s ? C.accent : C.textDim,
                    fontSize: 9,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setShowThemes(s => !s)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
              style={{
                background: C.bgInput, border: `1px solid ${C.border}`,
                color: C.textDim, fontSize: sz.stat,
              }}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: C.accent }} />
              {!mobile && C.name}
            </button>
            {showThemes && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl shadow-2xl z-50"
                style={{ background: C.bgCard, border: `1px solid ${C.border}`, width: 306 }}
              >
                <div
                  style={{
                    padding: "7px 10px 6px",
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 8, fontWeight: 700, letterSpacing: "1.5px",
                    color: C.textMuted, textTransform: "uppercase",
                  }}
                >
                  Themes
                </div>
                <div style={{ padding: 8, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
                  {Object.entries(THEMES).map(([key, theme]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setThemeName(key)
                        localStorage.setItem("sitrep-theme", key)
                        setShowThemes(false)
                      }}
                      style={{
                        background: themeName === key ? `${theme.accent}10` : theme.bgCard,
                        border: `2px solid ${themeName === key ? theme.accent : theme.border}`,
                        borderRadius: 8,
                        padding: "8px 9px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={e => { if (themeName !== key) e.currentTarget.style.borderColor = theme.accent + "80" }}
                      onMouseLeave={e => { if (themeName !== key) e.currentTarget.style.borderColor = theme.border }}
                    >
                      <div style={{ display: "flex", gap: 1, marginBottom: 6, height: 4, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ flex: 3, background: theme.bg }} />
                        <div style={{ flex: 2, background: theme.accent }} />
                        <div style={{ flex: 1, background: theme.blue }} />
                        <div style={{ flex: 1, background: theme.red }} />
                      </div>
                      <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
                        {[theme.text, theme.textMuted, theme.accent, theme.red, theme.purple].map((c, i) => (
                          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                        ))}
                      </div>
                      <div
                        style={{
                          fontSize: 9, fontWeight: 700,
                          color: themeName === key ? theme.accent : theme.textDim,
                          letterSpacing: "0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}
                      >
                        {theme.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <UserChip authUser={authUser} onProfile={() => nav("profile")} />
          {!mobile && <Clock color={C.textMuted} fontSize={sz.stat} />}
        </div>

        <div className="flex" style={{ height: `calc(100vh - 48px${mobile ? " - 56px" : ""})` }}>
          {sidebarOpen && (() => {
            const groups = ["Server", "Configuration", "Tools"]
            const grouped = groups
              .map(g => ({ group: g, tabs: visibleTabs.filter(t => t.group === g) }))
              .filter(g => g.tabs.length > 0)
            return (
              <div
                className={`shrink-0 flex flex-col ${mobile ? "fixed inset-y-12 left-0 z-50 w-[240px] shadow-2xl" : "w-[210px]"}`}
                style={{ background: C.bgCard, borderRight: `1px solid ${C.border}` }}
              >
                <div className="flex-1 overflow-auto pt-3 pb-2">
                  {grouped.map((g, gi) => (
                    <div key={g.group} className={gi > 0 ? "mt-1" : ""}>
                      <div
                        className="px-5 pb-1.5 pt-2 font-black uppercase tracking-widest"
                        style={{ color: C.textMuted, fontSize: 9 }}
                      >
                        {g.group}
                      </div>
                      {g.tabs.map(tb => (
                        <div
                          key={tb.id}
                          onClick={() => nav(tb.id)}
                          className="flex items-center gap-3 cursor-pointer mx-2 rounded-lg px-3 py-3"
                          style={{
                            background: tab === tb.id ? C.accentBg : "transparent",
                            color: tab === tb.id ? C.accent : C.textDim,
                            fontWeight: tab === tb.id ? 800 : 500,
                            fontSize: sz.nav,
                            borderLeft: tab === tb.id ? `3px solid ${C.accent}` : "3px solid transparent",
                            minHeight: 44,
                          }}
                          onMouseEnter={e => {
                            if (tab !== tb.id) {
                              e.currentTarget.style.background = C.bgHover
                              e.currentTarget.style.color = C.text
                            }
                          }}
                          onMouseLeave={e => {
                            if (tab !== tb.id) {
                              e.currentTarget.style.background = "transparent"
                              e.currentTarget.style.color = C.textDim
                            }
                          }}
                        >
                          <span style={{ fontSize: 14, opacity: 0.7 }}>{tb.icon}</span>
                          {tb.label}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {!mobile && (
                  <div className="px-5 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="font-mono" style={{ color: C.textMuted, fontSize: 8 }}>SITREP LITE</div>
                  </div>
                )}
              </div>
            )
          })()}
          {mobile && sidebarOpen && (
            <div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div
            className="flex-1 overflow-auto"
            style={{ padding: mobile ? "12px" : "20px" }}
            onTouchStart={onSwipeStart}
            onTouchEnd={onSwipeEnd}
          >
            <Tab toast={toast} authUser={authUser} role={authUser.role} instance={selectedInstance} tabId={tab} />
          </div>
        </div>

        {mobile && (
          <div
            className="fixed bottom-0 left-0 right-0 z-50 flex"
            style={{
              background: C.bgCard, borderTop: `1px solid ${C.border}`,
              height: 56, paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {bottomNavTabs.map(tb => {
              const active = tab === tb.id
              return (
                <button
                  key={tb.id}
                  onClick={() => nav(tb.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
                  style={{ color: active ? C.accent : C.textMuted, background: "transparent", border: "none", minHeight: 56 }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{tb.icon}</span>
                  <span
                    style={{
                      fontSize: 8, fontWeight: active ? 800 : 600,
                      letterSpacing: "0.5px", textTransform: "uppercase",
                    }}
                  >
                    {tb.short}
                  </span>
                </button>
              )
            })}
            {hasMore && (
              <button
                onClick={() => setSidebarOpen(p => !p)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                style={{ color: C.textMuted, background: "transparent", border: "none", minHeight: 56 }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>≡</span>
                <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>More</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  )
}
