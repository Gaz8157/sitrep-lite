import { useT } from "../ctx.jsx"

export function Card({ children, className = "", onClick }) {
  const { C } = useT()
  return (
    <div
      onClick={onClick}
      className={`rounded-xl transition-all ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
    >
      {children}
    </div>
  )
}
