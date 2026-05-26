import { useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn } from "../../components/index.js"

const FACTION_COLORS = {
  US:        "#60a5fa",
  USSR:      "#f87171",
  FIA:       "#4ade80",
  CIVILIAN:  "#a3a3a3",
  UNKNOWN:   "#e5e7eb",
}

function factionColor(faction) {
  if (!faction) return FACTION_COLORS.UNKNOWN
  const key = String(faction).toUpperCase()
  if (key in FACTION_COLORS) return FACTION_COLORS[key]
  if (key.includes("US")) return FACTION_COLORS.US
  if (key.includes("USSR") || key.includes("RUS")) return FACTION_COLORS.USSR
  if (key.includes("FIA")) return FACTION_COLORS.FIA
  if (key.includes("CIV")) return FACTION_COLORS.CIVILIAN
  return FACTION_COLORS.UNKNOWN
}

export default function PlayersMap({
  players,
  trails,
  selectedUid,
  onSelectUid,
}) {
  const { C, sz } = useT()
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState(null)
  const [autoFit, setAutoFit] = useState(true)
  const dragRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (!e) return
      setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(300, e.contentRect.height) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Compute world-coordinate bounds covering all live players (with padding).
  const bounds = useMemo(() => {
    if (!players.length) return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of players) {
      const x = Number(p.x || 0), z = Number(p.z || 0)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
    const padX = Math.max(40, (maxX - minX) * 0.15)
    const padZ = Math.max(40, (maxZ - minZ) * 0.15)
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minZ: minZ - padZ,
      maxZ: maxZ + padZ,
    }
  }, [players])

  // Mapping world (x, z) → screen (px, py) using auto-fit, zoom, and pan offsets.
  // Note: world Z grows north on the Reforger map. We invert Z so north is up.
  const proj = useMemo(() => {
    const wWorld = bounds.maxX - bounds.minX
    const hWorld = bounds.maxZ - bounds.minZ
    const margin = 16
    const fitX = (size.w - margin * 2) / Math.max(1, wWorld)
    const fitZ = (size.h - margin * 2) / Math.max(1, hWorld)
    const baseScale = Math.min(fitX, fitZ)
    const scale = autoFit ? baseScale * zoom : baseScale * zoom
    const cx = size.w / 2 + panOffset.x
    const cy = size.h / 2 + panOffset.y
    const wcx = (bounds.minX + bounds.maxX) / 2
    const wcz = (bounds.minZ + bounds.maxZ) / 2
    return {
      toScreen: (x, z) => ({
        px: cx + (x - wcx) * scale,
        py: cy - (z - wcz) * scale,
      }),
      scale,
    }
  }, [bounds, size, zoom, panOffset, autoFit])

  // Grid line spacing in world meters chosen so they're 30-150 px apart on screen.
  const gridStep = useMemo(() => {
    const target = 80
    const meters = target / Math.max(0.0001, proj.scale)
    const candidates = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
    for (const c of candidates) if (c >= meters) return c
    return 10000
  }, [proj])

  const onWheel = (e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.85 : 1.18
    setZoom(z => Math.min(20, Math.max(0.1, z * factor)))
  }

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    dragRef.current = { x: e.clientX, y: e.clientY, offX: panOffset.x, offY: panOffset.y }
  }

  const onMouseMove = (e) => {
    if (!dragRef.current) return
    setAutoFit(false)
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setPanOffset({ x: dragRef.current.offX + dx, y: dragRef.current.offY + dy })
  }

  const onMouseUp = () => {
    dragRef.current = null
  }

  const reset = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
    setAutoFit(true)
  }

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        minHeight: 420,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "min(60vh, 600px)",
          position: "relative",
          cursor: dragRef.current ? "grabbing" : "grab",
          background: C.bg,
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg width={size.w} height={size.h} style={{ display: "block" }}>
          <Grid
            C={C}
            bounds={bounds}
            proj={proj}
            size={size}
            step={gridStep}
          />
          <Trails
            C={C}
            trails={trails}
            proj={proj}
            selectedUid={selectedUid}
          />
          {players.map(p => (
            <PlayerDot
              key={p.uid || p.name || Math.random()}
              player={p}
              proj={proj}
              C={C}
              selected={selectedUid === p.uid}
              onHover={setHover}
              onClick={() => onSelectUid(selectedUid === p.uid ? null : p.uid)}
            />
          ))}
          <ScaleBar
            C={C}
            sz={sz}
            scale={proj.scale}
            x={12}
            y={size.h - 18}
          />
        </svg>
        {hover && (
          <Tooltip player={hover.player} x={hover.x} y={hover.y} C={C} sz={sz} />
        )}
      </div>
      <Toolbar
        C={C}
        sz={sz}
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(20, z * 1.4))}
        onZoomOut={() => setZoom(z => Math.max(0.1, z / 1.4))}
        onReset={reset}
        playerCount={players.length}
      />
    </div>
  )
}

function Grid({ C, bounds, proj, size, step }) {
  const lines = []
  const fX0 = Math.floor(bounds.minX / step) * step
  const fZ0 = Math.floor(bounds.minZ / step) * step
  for (let x = fX0; x <= bounds.maxX; x += step) {
    const a = proj.toScreen(x, bounds.minZ)
    const b = proj.toScreen(x, bounds.maxZ)
    lines.push(
      <line
        key={`vx-${x}`}
        x1={a.px}
        y1={0}
        x2={b.px}
        y2={size.h}
        stroke={C.border}
        strokeWidth={0.5}
        opacity={0.55}
      />
    )
  }
  for (let z = fZ0; z <= bounds.maxZ; z += step) {
    const a = proj.toScreen(bounds.minX, z)
    const b = proj.toScreen(bounds.maxX, z)
    lines.push(
      <line
        key={`hz-${z}`}
        x1={0}
        y1={a.py}
        x2={size.w}
        y2={b.py}
        stroke={C.border}
        strokeWidth={0.5}
        opacity={0.55}
      />
    )
  }
  return <g>{lines}</g>
}

function Trails({ C, trails, proj, selectedUid }) {
  const arcs = []
  trails.forEach((segments, uid) => {
    if (segments.length < 2) return
    const isSelected = uid === selectedUid
    const path = segments.map((s, i) => {
      const { px, py } = proj.toScreen(s.x, s.z)
      return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`
    }).join(" ")
    arcs.push(
      <path
        key={uid}
        d={path}
        fill="none"
        stroke={isSelected ? C.accent : C.textMuted}
        strokeWidth={isSelected ? 2 : 1}
        opacity={isSelected ? 0.85 : 0.45}
      />
    )
  })
  return <g>{arcs}</g>
}

function PlayerDot({ player, proj, C, selected, onHover, onClick }) {
  const { px, py } = proj.toScreen(Number(player.x || 0), Number(player.z || 0))
  const color = factionColor(player.faction)
  const dead = (typeof player.health === "number" && player.health <= 0) || player.status === "dead"
  const r = selected ? 7 : 5

  // Direction indicator if heading is set
  const heading = typeof player.heading === "number" ? player.heading : null
  let dirEnd = null
  if (heading != null) {
    const rad = ((heading - 90) * Math.PI) / 180
    dirEnd = {
      x: px + Math.cos(rad) * 14,
      y: py + Math.sin(rad) * 14,
    }
  }

  return (
    <g
      onMouseEnter={(e) => {
        const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
        onHover({
          player,
          x: e.clientX - rect.left + 12,
          y: e.clientY - rect.top + 12,
        })
      }}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {dirEnd && (
        <line
          x1={px}
          y1={py}
          x2={dirEnd.x}
          y2={dirEnd.y}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.75}
        />
      )}
      <circle
        cx={px}
        cy={py}
        r={r + 2}
        fill={color}
        opacity={0.18}
      />
      <circle
        cx={px}
        cy={py}
        r={r}
        fill={dead ? "transparent" : color}
        stroke={dead ? color : C.bg}
        strokeWidth={dead ? 2 : 1.5}
      />
      {selected && (
        <circle
          cx={px}
          cy={py}
          r={r + 4}
          fill="none"
          stroke={C.accent}
          strokeWidth={1.5}
        />
      )}
    </g>
  )
}

function Tooltip({ player, x, y, C, sz }) {
  const lines = [
    [player.name || "(unknown)", null],
    ["UID", (player.uid || "").slice(-8) || "—"],
    ["Faction", player.faction || "—"],
    ["Health", player.health == null ? "—" : `${Math.round(Number(player.health) * 100)}%`],
    ["Status", player.status || "—"],
    ["Weapon", player.weapon || player.vehicle || "—"],
    ["Grid", player.grid || "—"],
    ["Squad", player.squad_name || "—"],
  ]
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: sz.label,
        color: C.text,
        pointerEvents: "none",
        zIndex: 10,
        minWidth: 180,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ color: C.textBright, fontWeight: 800, marginBottom: 4 }}>
        {lines[0][0]}
      </div>
      {lines.slice(1).map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, lineHeight: 1.4 }}>
          <span style={{ color: C.textMuted }}>{k}</span>
          <span style={{ color: C.text }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function Toolbar({ C, sz, zoom, onZoomIn, onZoomOut, onReset, playerCount }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: sz.label - 1,
          color: C.textDim,
          fontWeight: 700,
        }}
      >
        {playerCount} on map · {zoom.toFixed(1)}×
      </div>
      <Btn small v="ghost" onClick={onZoomOut}>−</Btn>
      <Btn small v="ghost" onClick={onZoomIn}>+</Btn>
      <Btn small v="ghost" onClick={onReset}>Reset</Btn>
    </div>
  )
}

function ScaleBar({ C, sz, scale, x, y }) {
  if (!scale || !Number.isFinite(scale)) return null
  const candidates = [50, 100, 250, 500, 1000, 2500, 5000]
  const target = 120
  let meters = candidates[0]
  for (const c of candidates) {
    if (c * scale <= target) meters = c
  }
  const px = meters * scale
  return (
    <g>
      <line x1={x} y1={y} x2={x + px} y2={y} stroke={C.text} strokeWidth={2} />
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={C.text} strokeWidth={2} />
      <line x1={x + px} y1={y - 4} x2={x + px} y2={y + 4} stroke={C.text} strokeWidth={2} />
      <text
        x={x + px + 6}
        y={y + 4}
        fill={C.textDim}
        fontSize={sz.label - 1}
        fontWeight={700}
      >
        {meters >= 1000 ? `${meters / 1000} km` : `${meters} m`}
      </text>
    </g>
  )
}
