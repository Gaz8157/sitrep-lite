import { useCallback, useRef, useState } from "react"

let _tid = 0

// useToast — simple in-memory toast queue with auto-dismiss.
// Returns { toasts, push(msg, variant='default'), dismiss(id) }.
export function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((msg, v = "default") => {
    const id = ++_tid
    setToasts(prev => [...prev, { id, msg, v }])
    timers.current[id] = setTimeout(() => {
      delete timers.current[id]
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
    return id
  }, [])

  return { toasts, push, dismiss }
}
