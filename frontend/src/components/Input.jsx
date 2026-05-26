import { useState } from "react"
import { useT } from "../ctx.jsx"

export function Input({ label, value, onChange, type = "text", placeholder, mono }) {
  const { C, sz } = useT()
  const [show, setShow] = useState(false)
  const isPw = type === "password"
  return (
    <div className="mb-3">
      {label && (
        <label
          className="block font-bold uppercase tracking-wide mb-1.5"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={isPw ? (show ? "text" : "password") : type}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:opacity-30 ${isPw ? "pr-9" : ""} ${mono ? "font-mono" : ""}`}
          style={{ background: C.bgInput, border: `1px solid ${C.border}`, color: C.text, fontSize: sz.input }}
          onFocus={e => (e.target.style.borderColor = C.accent + "80")}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: C.textDim, fontSize: sz.label }}
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  )
}
