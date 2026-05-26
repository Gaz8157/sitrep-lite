import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import LoginPage from "../LoginPage.jsx"
import { AuthProvider } from "../useAuth.jsx"

beforeEach(() => {
  global.fetch = vi.fn()
  // /me 401 → not logged in
  fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
  // /public-config (any number of times, return discord disabled)
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ discord_enabled: false }) })
})

afterEach(() => {
  cleanup()
})

function wrap(children) {
  return <AuthProvider>{children}</AuthProvider>
}

describe("LoginPage", () => {
  it("renders username + password inputs by default", async () => {
    render(wrap(<LoginPage />))
    expect(await screen.findByPlaceholderText(/username/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy()
  })

  it("shows TOTP view when login returns requires_2fa", async () => {
    fetch.mockReset()
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })   // /me
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ discord_enabled: false }) })  // public-config
    fetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ requires_2fa: true, pending_token: "ptok" }),
    })  // /api/auth/login
    render(wrap(<LoginPage />))
    fireEvent.change(await screen.findByPlaceholderText(/username/i), { target: { value: "mark" } })
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: "pw" } })
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByPlaceholderText(/000000/i)).toBeTruthy()
  })
})
