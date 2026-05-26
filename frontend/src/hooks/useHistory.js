import { useCallback, useState } from "react"

// useHistory(maxLen) — rolling buffer for time-series samples.
// Each push adds { ...entry, t: Date.now() } and truncates to the last maxLen.
export function useHistory(maxLen = 60) {
  const [history, setHistory] = useState([])
  const push = useCallback((entry) => {
    setHistory(prev => {
      const next = [...prev, { ...entry, t: Date.now() }]
      return next.length > maxLen ? next.slice(-maxLen) : next
    })
  }, [maxLen])
  return { history, push }
}
