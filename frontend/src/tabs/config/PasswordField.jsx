import { useState } from "react"
import { useT } from "../../ctx.jsx"

// Password input with a show/hide eye toggle. Optional clear button.
export default function PasswordField({ label, value, onChange, placeholder = "" }) {
  const { C, sz } = useT()
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <label
        className="font-bold uppercase tracking-wide"
        style={{ color: C.textDim, fontSize: sz.label }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full rounded-lg px-3 py-2 pr-20 outline-none font-mono placeholder:opacity-30"
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: sz.input,
          }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="cursor-pointer font-bold"
            style={{ color: C.textDim, fontSize: sz.label }}
          >
            {show ? "Hide" : "Show"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="cursor-pointer font-bold"
              style={{ color: C.textMuted, fontSize: sz.label }}
            >
              X
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
