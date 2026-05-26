import { useEffect, useRef, useState } from "react"

// useWebSocket — STUB for Plan H. Returns a sensible shape but never connects.
// Plan H will swap this implementation with reconnect/backoff logic.
export function useWebSocket(_url, _opts = {}) {
  const [connected] = useState(false)
  const [lastMessage] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    // Intentionally no connect — placeholder until Plan H.
    return () => {
      if (ref.current) {
        try { ref.current.close() } catch (_) {}
        ref.current = null
      }
    }
  }, [])
  return {
    connected,
    lastMessage,
    send: () => {},
    close: () => {},
  }
}
