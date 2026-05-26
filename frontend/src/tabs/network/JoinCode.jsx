import { useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn } from "../../components/index.js"

export default function JoinCode({ publicIp, gamePort, toast }) {
  const { C, sz } = useT()
  const [copied, setCopied] = useState(false)
  const code = publicIp && gamePort ? `${publicIp}:${gamePort}` : null

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast?.("Copied direct-join code")
    } catch {
      toast?.("Clipboard denied", "danger")
    }
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        className="font-black uppercase tracking-widest mb-3"
        style={{ color: C.textDim, fontSize: sz.label }}
      >
        Direct-join code
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <code
          className="font-mono px-4 py-3 rounded-lg flex-1"
          style={{
            background: C.consoleBg,
            border: `1px solid ${C.accent}40`,
            color: C.text,
            fontSize: sz.base + 6,
            letterSpacing: 0.5,
            minWidth: 0,
            wordBreak: "break-all",
          }}
        >
          {code || "(no public address yet)"}
        </code>
        <Btn onClick={copy} disabled={!code}>
          {copied ? "Copied" : "Copy"}
        </Btn>
      </div>
      <div className="mt-2" style={{ color: C.textMuted, fontSize: sz.stat }}>
        Players paste this into the Reforger server browser's Direct Connect field.
      </div>
    </div>
  )
}
