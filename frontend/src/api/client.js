const API_BASE = ""

export class APIError extends Error {
  constructor(status, body) {
    let parsed = body
    try { parsed = JSON.parse(body) } catch (_) {}
    const msg = typeof parsed === "string"
      ? parsed
      : (parsed?.detail?.message || parsed?.detail || body || `HTTP ${status}`)
    super(msg)
    this.status = status
    this.body = parsed
  }
}

let refreshInFlight = null

async function tryRefresh() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const r = await fetch(API_BASE + "/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      })
      return r.ok
    } catch (_) {
      return false
    }
  })()
  try { return await refreshInFlight }
  finally { refreshInFlight = null }
}

function isAuthBypassPath(path) {
  return path.endsWith("/api/auth/refresh") || path.endsWith("/api/auth/login")
}

function buildOpts(method, body) {
  const opts = { method, credentials: "include" }
  if (body !== undefined && body !== null) {
    opts.headers = { "Content-Type": "application/json" }
    opts.body = JSON.stringify(body)
  }
  if (method === "GET") opts.cache = "no-store"
  return opts
}

async function parseResponse(r) {
  const ct = (r.headers && typeof r.headers.get === "function") ? (r.headers.get("content-type") || "") : ""
  if (ct.includes("application/json")) return r.json()
  return r.text()
}

async function request(method, path, body) {
  let r = await fetch(API_BASE + path, buildOpts(method, body))

  if (r.status === 401 && !isAuthBypassPath(path)) {
    const ok = await tryRefresh()
    if (ok) {
      r = await fetch(API_BASE + path, buildOpts(method, body))
    } else {
      if (typeof window !== "undefined" && window.location && typeof window.location.assign === "function") {
        window.location.assign("/login")
      }
      throw new APIError(401, "Unauthorized")
    }
  }

  if (!r.ok) throw new APIError(r.status, await r.text())
  return parseResponse(r)
}

export function apiGet(path) { return request("GET", path) }
export function apiPost(path, body) { return request("POST", path, body) }
export function apiPut(path, body) { return request("PUT", path, body) }
export function apiPatch(path, body) { return request("PATCH", path, body) }
export function apiDelete(path) { return request("DELETE", path) }
