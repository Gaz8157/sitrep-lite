import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useAuth, AuthProvider } from "../useAuth.jsx"

beforeEach(() => {
  global.fetch = vi.fn()
})

const wrap = ({ children }) => <AuthProvider>{children}</AuthProvider>

describe("useAuth", () => {
  it("starts in loading then resolves to me when /me returns user", async () => {
    fetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ user: { id: 1, username: "mark", role: "owner" }, server_access: {} }),
    })
    const { result } = renderHook(useAuth, { wrapper: wrap })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.me.username).toBe("mark")
  })

  it("me is null when /me returns 401", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    const { result } = renderHook(useAuth, { wrapper: wrap })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.me).toBeNull()
  })

  it("login() POSTs credentials and updates me on success", async () => {
    fetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ user: { id: 1, username: "mark", role: "owner" }, server_access: {} }),
      })
    const { result } = renderHook(useAuth, { wrapper: wrap })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.login("mark", "pw", false) })
    expect(result.current.me.username).toBe("mark")
  })
})
