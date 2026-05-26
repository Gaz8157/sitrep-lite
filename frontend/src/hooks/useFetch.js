import { useCallback, useEffect, useRef, useState } from "react"
import { apiGet, APIError } from "../api/index.js"

// useFetch(url, intervalMs?) — polls JSON via apiGet (cookie auth + 401-refresh
// interceptor). Returns { data, loading, error, refetch, lastUpdated }.
// lastUpdated is the Date.now() timestamp of the most recent successful
// fetch (null until first success); consumers render freshness indicators
// from it.
export function useFetch(url, interval = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const goRef = useRef(null)

  useEffect(() => {
    // Reset on URL change so consumers don't render the previous URL's
    // payload while waiting for the new fetch to complete. Without this,
    // switching server instances shows the prior server's player count,
    // log lines, and status for one full poll cycle (3-5s).
    setData(null)
    setError(null)
    setLoading(true)
    setLastUpdated(null)

    let alive = true
    const go = async () => {
      if (!url) { setLoading(false); return }
      try {
        const j = await apiGet(url)
        if (alive) {
          setData(j); setError(null); setLoading(false); setLastUpdated(Date.now())
        }
      } catch (e) {
        if (alive) { setError(e instanceof APIError ? e : new Error(String(e))); setLoading(false) }
      }
    }
    goRef.current = go
    go()
    if (interval) {
      const id = setInterval(go, interval)
      return () => { alive = false; clearInterval(id) }
    }
    return () => { alive = false }
  }, [url, interval])

  const refetch = useCallback(() => goRef.current?.(), [])
  return { data, loading, error, refetch, lastUpdated }
}
