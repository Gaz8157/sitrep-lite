import { createContext, useContext, useEffect, useState, useCallback } from "react"

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [serverAccess, setServerAccess] = useState({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" })
      if (!r.ok) {
        setMe(null); setServerAccess({})
        return null
      }
      const d = await r.json()
      setMe(d.user)
      return d.user
    } catch {
      setMe(null); setServerAccess({})
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (username, password, remember) => {
    const r = await fetch("/api/auth/login", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember }),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.detail || "login_failed")
    }
    const d = await r.json()
    if (d.requires_2fa) return { requires_2fa: true, pending_token: d.pending_token }
    setMe(d.user)
    return { user: d.user }
  }, [])

  const verify2fa = useCallback(async (pending_token, code) => {
    const r = await fetch("/api/auth/2fa/verify", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pending_token, code }),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.detail || "2fa_failed")
    }
    const d = await r.json()
    setMe(d.user)
    return d.user
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    setMe(null); setServerAccess({})
  }, [])

  const value = { me, serverAccess, loading, login, verify2fa, logout, refresh }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>")
  return ctx
}
