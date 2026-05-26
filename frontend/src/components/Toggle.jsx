import { useT } from "../ctx.jsx"

export function Toggle({ value, onChange, label }) {
  const { C, sz } = useT()
  return (
    <div className="flex items-center justify-between mb-3">
      {label && (
        <label
          className="font-bold uppercase tracking-wide"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          {label}
        </label>
      )}
      <div
        onClick={onChange}
        className="rounded-full cursor-pointer transition-colors relative"
        style={{ background: value ? C.accent : C.border, width: 40, height: 22 }}
      >
        <div
          className="rounded-full bg-white absolute transition-all"
          style={{ width: 16, height: 16, top: 3, left: value ? 21 : 3 }}
        />
      </div>
    </div>
  )
}
