import { useState } from "react"

// useFloatingPanels — encapsulates v1's float/hide panel state with
// localStorage persistence. Keys: `${prefix}-float`, `${prefix}-hidden`.
//
// State shapes:
//   floating: { [panelId]: { x, y } }  — detached panel position
//   hidden:   { [panelId]: true }      — panel hidden from layout
//
// Both maps are written through to localStorage on every mutation so that
// refreshing the page restores the panel layout.
export function useFloatingPanels(storageKeyPrefix = "dash") {
  const floatKey = `${storageKeyPrefix}-float`
  const hiddenKey = `${storageKeyPrefix}-hidden`

  const [floating, setFloating] = useState(() => {
    try { return JSON.parse(localStorage.getItem(floatKey) || "{}") } catch { return {} }
  })
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem(hiddenKey) || "{}") } catch { return {} }
  })

  const persistFloat = (n) => { try { localStorage.setItem(floatKey, JSON.stringify(n)) } catch {} }
  const persistHidden = (n) => { try { localStorage.setItem(hiddenKey, JSON.stringify(n)) } catch {} }

  const detach = (id, pos) => setFloating(p => {
    const count = Object.keys(p).length
    const n = { ...p, [id]: pos || { x: 120 + count * 30, y: 80 + count * 30 } }
    persistFloat(n)
    return n
  })
  const dock = (id) => setFloating(p => {
    const n = { ...p }
    delete n[id]
    persistFloat(n)
    return n
  })
  const hide = (id) => setHidden(p => {
    const n = { ...p, [id]: true }
    persistHidden(n)
    return n
  })
  const show = (id) => setHidden(p => {
    const n = { ...p }
    delete n[id]
    persistHidden(n)
    return n
  })

  return { floating, hidden, detach, dock, hide, show }
}
