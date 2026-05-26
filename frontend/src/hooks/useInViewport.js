import { useEffect, useRef, useState } from "react"

// useInViewport(rootMargin) — IntersectionObserver hook.
// Returns [ref, inView]. Pre-loads inView=true slightly before scrolling on
// screen via rootMargin (default "200px"). Once an element has been seen, the
// hook keeps inView=true permanently — thumbnails don't need to re-fetch
// when the user scrolls back.
export function useInViewport(rootMargin = "200px") {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true)
            obs.disconnect()
            return
          }
        }
      },
      { rootMargin, threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [rootMargin])

  return [ref, inView]
}
