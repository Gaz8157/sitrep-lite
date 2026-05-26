import { describe, it, expect, vi, beforeEach } from "vitest"
import { apiGet, apiPost, APIError } from "../client.js"

describe("api/client", () => {
  beforeEach(() => { globalThis.fetch = vi.fn() })

  it("apiGet returns JSON on success", async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ hello: "world" }),
    })
    const data = await apiGet("/api/x")
    expect(data).toEqual({ hello: "world" })
  })

  it("apiGet throws APIError on non-2xx", async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: "boom" }),
    })
    await expect(apiGet("/api/x")).rejects.toBeInstanceOf(APIError)
    try { await apiGet("/api/x") } catch (e) {
      expect(e.status).toBe(500)
      expect(e.message).toBe("boom")
    }
  })

  it("apiPost serialises body and sets content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: 1 }),
    })
    globalThis.fetch = fetchMock
    await apiPost("/api/y", { a: 1 })
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe("POST")
    expect(opts.headers["Content-Type"]).toBe("application/json")
    expect(JSON.parse(opts.body)).toEqual({ a: 1 })
  })
})

describe("client 401 interceptor", () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  it("calls /api/auth/refresh once on 401, then retries", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ user: "mark" }),
      })

    const r = await apiGet("/api/auth/me")
    expect(r).toEqual({ user: "mark" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/refresh")
    expect(fetchMock.mock.calls[1][1].method).toBe("POST")
  })

  it("redirects to /login if refresh also fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" })
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" })

    const originalLocation = window.location
    delete window.location
    window.location = { href: originalLocation.href, assign: vi.fn() }

    try {
      await expect(apiGet("/api/auth/me")).rejects.toBeInstanceOf(APIError)
      expect(window.location.assign).toHaveBeenCalledWith(expect.stringContaining("/login"))
    } finally {
      window.location = originalLocation
    }
  })

  it("does NOT recurse on the /api/auth/refresh endpoint itself", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" })
    await expect(apiGet("/api/auth/refresh")).rejects.toBeInstanceOf(APIError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does NOT recurse on the /api/auth/login endpoint itself", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" })
    await expect(apiGet("/api/auth/login")).rejects.toBeInstanceOf(APIError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("sends credentials: 'include' on requests", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({}),
    })
    await apiGet("/api/x")
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include")
  })

  it("single-flights concurrent 401s into one refresh call", async () => {
    let resolveRefresh
    const refreshPromise = new Promise((res) => { resolveRefresh = res })

    fetchMock.mockImplementation((url) => {
      if (url.includes("/api/auth/refresh")) {
        return refreshPromise.then(() => ({ ok: true, status: 200, text: async () => "" }))
      }
      // First call for either endpoint returns 401, retry returns 200 JSON
      const callsForUrl = fetchMock.mock.calls.filter((c) => c[0] === url).length
      if (callsForUrl === 1) {
        return Promise.resolve({ ok: false, status: 401, text: async () => "" })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ url }),
      })
    })

    const p1 = apiGet("/api/a")
    const p2 = apiGet("/api/b")
    // Let both initial 401s resolve before unblocking refresh
    await new Promise((r) => setTimeout(r, 10))
    resolveRefresh()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toEqual({ url: "/api/a" })
    expect(r2).toEqual({ url: "/api/b" })

    const refreshCalls = fetchMock.mock.calls.filter((c) => c[0].includes("/api/auth/refresh"))
    expect(refreshCalls.length).toBe(1)
  })
})
