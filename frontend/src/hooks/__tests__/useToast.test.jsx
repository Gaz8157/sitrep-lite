import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useToast } from "../useToast.js"

describe("useToast", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("starts empty", () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it("pushes and auto-dismisses", () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.push("hi", "info") })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].msg).toBe("hi")
    expect(result.current.toasts[0].v).toBe("info")
    act(() => { vi.advanceTimersByTime(4000) })
    expect(result.current.toasts).toEqual([])
  })

  it("dismiss removes by id", () => {
    const { result } = renderHook(() => useToast())
    let id
    act(() => { id = result.current.push("a") })
    act(() => { result.current.dismiss(id) })
    expect(result.current.toasts).toEqual([])
  })
})
