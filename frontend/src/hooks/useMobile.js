import { useEffect, useState } from "react"

// useMobile — true while viewport is narrower than 768px.
const BREAKPOINT = 768

export function useMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < BREAKPOINT : false,
  )
  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setMobile(window.innerWidth < BREAKPOINT)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return mobile
}
