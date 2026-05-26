import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useHistory } from "../useHistory.js"

describe("useHistory", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useHistory(5))
    expect(result.current.history).toEqual([])
  })

  it("pushes entries and stamps timestamps", () => {
    const { result } = renderHook(() => useHistory(5))
    act(() => result.current.push({ v: 1 }))
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].v).toBe(1)
    expect(typeof result.current.history[0].t).toBe("number")
  })

  it("rolls past maxLen", () => {
    const { result } = renderHook(() => useHistory(3))
    act(() => {
      result.current.push({ v: 1 })
      result.current.push({ v: 2 })
      result.current.push({ v: 3 })
      result.current.push({ v: 4 })
    })
    expect(result.current.history).toHaveLength(3)
    expect(result.current.history.map(e => e.v)).toEqual([2, 3, 4])
  })
})
