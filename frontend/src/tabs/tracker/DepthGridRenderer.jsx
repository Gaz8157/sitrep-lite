import { useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../ctx.jsx"

const ASPECT = 48 / 27

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_RAW = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_depth;
uniform sampler2D u_type;
uniform vec2 u_grid;
uniform int u_ramp;

vec3 viridis(float t) {
  // Approximate Viridis curve (Bourke / matplotlib style)
  const vec3 c0 = vec3(0.267, 0.005, 0.329);
  const vec3 c1 = vec3(0.282, 0.140, 0.457);
  const vec3 c2 = vec3(0.254, 0.265, 0.530);
  const vec3 c3 = vec3(0.207, 0.372, 0.553);
  const vec3 c4 = vec3(0.164, 0.471, 0.558);
  const vec3 c5 = vec3(0.128, 0.567, 0.551);
  const vec3 c6 = vec3(0.135, 0.659, 0.518);
  const vec3 c7 = vec3(0.267, 0.749, 0.441);
  const vec3 c8 = vec3(0.478, 0.821, 0.318);
  const vec3 c9 = vec3(0.741, 0.873, 0.150);
  const vec3 cA = vec3(0.993, 0.906, 0.144);
  t = clamp(t, 0.0, 1.0);
  float s = t * 10.0;
  int i = int(floor(s));
  float f = fract(s);
  vec3 a, b;
  if (i <= 0)      { a = c0; b = c1; }
  else if (i == 1) { a = c1; b = c2; }
  else if (i == 2) { a = c2; b = c3; }
  else if (i == 3) { a = c3; b = c4; }
  else if (i == 4) { a = c4; b = c5; }
  else if (i == 5) { a = c5; b = c6; }
  else if (i == 6) { a = c6; b = c7; }
  else if (i == 7) { a = c7; b = c8; }
  else if (i == 8) { a = c8; b = c9; }
  else             { a = c9; b = cA; }
  return mix(a, b, f);
}

vec3 thermal(float t) {
  t = clamp(t, 0.0, 1.0);
  return vec3(
    smoothstep(0.4, 1.0, t),
    smoothstep(0.6, 1.0, t) * 0.9 + smoothstep(0.0, 0.5, t) * 0.5,
    1.0 - smoothstep(0.0, 0.5, t)
  );
}

void main() {
  // Nearest-neighbour sample (Raw mode)
  vec2 cell = floor(v_uv * u_grid) / u_grid + 0.5 / u_grid;
  float d = texture2D(u_depth, cell).r;
  float t = d;
  vec3 col;
  if (u_ramp == 0)      col = viridis(1.0 - t);
  else if (u_ramp == 1) col = vec3(1.0 - t);
  else                  col = thermal(1.0 - t);
  // Subtle entity overlay using type texture (2=infantry, 3=vehicle)
  float ty = texture2D(u_type, cell).r * 255.0;
  if (abs(ty - 2.0) < 0.5) col = mix(col, vec3(1.0, 0.4, 0.4), 0.55);
  else if (abs(ty - 3.0) < 0.5) col = mix(col, vec3(0.4, 0.7, 1.0), 0.45);
  gl_FragColor = vec4(col, 1.0);
}
`

const FRAG_JBU = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_depth;
uniform sampler2D u_type;
uniform vec2 u_grid;
uniform int u_ramp;

vec3 viridis(float t) {
  const vec3 c0 = vec3(0.267, 0.005, 0.329);
  const vec3 c1 = vec3(0.282, 0.140, 0.457);
  const vec3 c2 = vec3(0.254, 0.265, 0.530);
  const vec3 c3 = vec3(0.207, 0.372, 0.553);
  const vec3 c4 = vec3(0.164, 0.471, 0.558);
  const vec3 c5 = vec3(0.128, 0.567, 0.551);
  const vec3 c6 = vec3(0.135, 0.659, 0.518);
  const vec3 c7 = vec3(0.267, 0.749, 0.441);
  const vec3 c8 = vec3(0.478, 0.821, 0.318);
  const vec3 c9 = vec3(0.741, 0.873, 0.150);
  const vec3 cA = vec3(0.993, 0.906, 0.144);
  t = clamp(t, 0.0, 1.0);
  float s = t * 10.0;
  int i = int(floor(s));
  float f = fract(s);
  vec3 a, b;
  if (i <= 0)      { a = c0; b = c1; }
  else if (i == 1) { a = c1; b = c2; }
  else if (i == 2) { a = c2; b = c3; }
  else if (i == 3) { a = c3; b = c4; }
  else if (i == 4) { a = c4; b = c5; }
  else if (i == 5) { a = c5; b = c6; }
  else if (i == 6) { a = c6; b = c7; }
  else if (i == 7) { a = c7; b = c8; }
  else if (i == 8) { a = c8; b = c9; }
  else             { a = c9; b = cA; }
  return mix(a, b, f);
}

vec3 thermal(float t) {
  t = clamp(t, 0.0, 1.0);
  return vec3(
    smoothstep(0.4, 1.0, t),
    smoothstep(0.6, 1.0, t) * 0.9 + smoothstep(0.0, 0.5, t) * 0.5,
    1.0 - smoothstep(0.0, 0.5, t)
  );
}

// Joint Bilateral Upsample — entity type as guidance.
// Spatial Gaussian + range (type) Gaussian. Center sample heavily weighted.
void main() {
  vec2 texel = 1.0 / u_grid;
  vec2 centerCell = floor(v_uv * u_grid) / u_grid + 0.5 / u_grid;
  float centerType = texture2D(u_type, centerCell).r * 255.0;

  float sigmaS = 1.5;
  float sigmaR = 0.4; // type units (we'll normalize)

  float wSum = 0.0;
  float dSum = 0.0;
  // 5x5 kernel around the bilinear-fetch point in grid space
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      vec2 off = vec2(float(dx), float(dy)) * texel;
      vec2 samplePt = centerCell + off;
      float d = texture2D(u_depth, samplePt).r;
      float ty = texture2D(u_type, samplePt).r * 255.0;
      float dist2 = float(dx*dx + dy*dy);
      float wS = exp(-dist2 / (2.0 * sigmaS * sigmaS));
      float typeDiff = (ty - centerType) / 4.0;
      float wR = exp(-typeDiff * typeDiff / (2.0 * sigmaR * sigmaR));
      float w = wS * wR;
      wSum += w;
      dSum += w * d;
    }
  }
  float d = (wSum > 0.0) ? (dSum / wSum) : texture2D(u_depth, centerCell).r;
  float t = d;
  vec3 col;
  if (u_ramp == 0)      col = viridis(1.0 - t);
  else if (u_ramp == 1) col = vec3(1.0 - t);
  else                  col = thermal(1.0 - t);

  if (abs(centerType - 2.0) < 0.5) col = mix(col, vec3(1.0, 0.4, 0.4), 0.55);
  else if (abs(centerType - 3.0) < 0.5) col = mix(col, vec3(0.4, 0.7, 1.0), 0.45);
  gl_FragColor = vec4(col, 1.0);
}
`

function compileShader(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error("shader compile: " + err)
  }
  return sh
}

function makeProgram(gl, frag) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag)
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const err = gl.getProgramInfoLog(prog)
    throw new Error("program link: " + err)
  }
  return prog
}

export default function DepthGridRenderer({ frame, renderMode, colorRamp }) {
  const { C, sz } = useT()
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState(null)

  // Boot WebGL once
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false })
    if (!gl) {
      setSupported(false)
      return
    }

    let progRaw, progJbu, depthTex, typeTex, buf
    try {
      progRaw = makeProgram(gl, FRAG_RAW)
      progJbu = makeProgram(gl, FRAG_JBU)
    } catch (e) {
      setError(String(e))
      return
    }

    depthTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, depthTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    typeTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, typeTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )

    stateRef.current = { gl, progRaw, progJbu, depthTex, typeTex, buf, lastSize: { w: 0, h: 0 } }

    return () => {
      try {
        if (depthTex) gl.deleteTexture(depthTex)
        if (typeTex)  gl.deleteTexture(typeTex)
        if (buf)      gl.deleteBuffer(buf)
        if (progRaw)  gl.deleteProgram(progRaw)
        if (progJbu)  gl.deleteProgram(progJbu)
      } catch (_) {}
      stateRef.current = null
    }
  }, [])

  // Resize canvas to its layout box.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !stateRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (!e) return
      const w = Math.max(48, Math.floor(e.contentRect.width))
      const h = Math.max(27, Math.floor(w / ASPECT))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  // Draw a frame whenever inputs change.
  useEffect(() => {
    const st = stateRef.current
    if (!st || !frame) return
    const gl = st.gl
    const w = Math.max(1, frame.grid_w || 48)
    const h = Math.max(1, frame.grid_h || 27)
    const total = w * h
    const depths = frame.depth_grid || []
    const types = frame.type_grid || []
    const d8 = new Uint8Array(total)
    const t8 = new Uint8Array(total)
    for (let i = 0; i < total; i++) {
      d8[i] = depths[i] != null ? Math.max(0, Math.min(255, depths[i])) : 255
      t8[i] = types[i] != null ? Math.max(0, Math.min(4, types[i])) : 0
    }

    gl.bindTexture(gl.TEXTURE_2D, st.depthTex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, d8
    )
    gl.bindTexture(gl.TEXTURE_2D, st.typeTex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, t8
    )

    const prog = renderMode === "raw" ? st.progRaw : st.progJbu
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, st.buf)
    const aPos = gl.getAttribLocation(prog, "a_pos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, st.depthTex)
    gl.uniform1i(gl.getUniformLocation(prog, "u_depth"), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, st.typeTex)
    gl.uniform1i(gl.getUniformLocation(prog, "u_type"), 1)
    gl.uniform2f(gl.getUniformLocation(prog, "u_grid"), w, h)

    let ramp = 0
    if (colorRamp === "gray") ramp = 1
    else if (colorRamp === "thermal") ramp = 2
    gl.uniform1i(gl.getUniformLocation(prog, "u_ramp"), ramp)

    const canvas = canvasRef.current
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }, [frame, renderMode, colorRamp])

  if (!supported) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: C.textMuted,
          fontSize: sz.base,
          background: C.bg,
        }}
      >
        WebGL is not available in this browser. Camera feed cannot render.
      </div>
    )
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${ASPECT}`,
        background: "#000",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      {error && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: C.redBg,
            color: C.red,
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: sz.label - 1,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {error}
        </div>
      )}
      <Entities frame={frame} C={C} sz={sz} />
      <HudOverlay frame={frame} C={C} sz={sz} />
    </div>
  )
}

function Entities({ frame, C, sz }) {
  const entities = Array.isArray(frame?.entities) ? frame.entities : []
  if (!entities.length) return null
  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      viewBox={`0 0 ${frame.grid_w || 48} ${frame.grid_h || 27}`}
      preserveAspectRatio="none"
    >
      {entities.map((e, i) => {
        const x = Number(e.x || 0)
        const y = Number(e.y || 0)
        const w = Number(e.w || 1)
        const h = Number(e.h || 1)
        const color = e.type === "infantry" ? "#ff4040" :
                      e.type === "vehicle"  ? "#40a0ff" :
                      "#ffffff"
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="none"
            stroke={color}
            strokeWidth={0.2}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

function HudOverlay({ frame, C, sz }) {
  const yaw = Number(frame?.rot?.[0] || 0)
  const pitch = Number(frame?.rot?.[1] || 0)
  const hitDist = frame?.hit_dist
  const hitEntity = frame?.hit_entity
  const ageSec = frame?.ts ? Math.max(0, Math.floor(Date.now() / 1000) - frame.ts) : null
  const live = ageSec !== null && ageSec < 2
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "ui-monospace, monospace",
        color: "#a8ffa8",
        fontSize: sz.label,
      }}
    >
      <div style={{ position: "absolute", top: 6, left: 8, opacity: 0.95 }}>
        YAW {yaw.toFixed(1)}°  PITCH {pitch.toFixed(1)}°
      </div>
      <div style={{ position: "absolute", top: 6, right: 8, opacity: 0.95 }}>
        {live ? <span style={{ color: "#ff5050" }}>● REC</span> : <span style={{ opacity: 0.4 }}>○ STALE</span>}
        {ageSec !== null && <span style={{ marginLeft: 8, opacity: 0.7 }}>{ageSec}s</span>}
      </div>
      <div style={{ position: "absolute", bottom: 6, left: 8, opacity: 0.9 }}>
        {hitEntity ? `→ ${hitEntity}` : "—"}
        {hitDist != null && <span style={{ marginLeft: 8, opacity: 0.8 }}>{Number(hitDist).toFixed(0)}m</span>}
      </div>
      <div style={{ position: "absolute", bottom: 6, right: 8, opacity: 0.9 }}>
        {frame?.hit_grid || ""}
      </div>
      {/* Center crosshair */}
      <svg
        style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.8 }}
        width="22"
        height="22"
        viewBox="0 0 22 22"
      >
        <circle cx="11" cy="11" r="6" fill="none" stroke="#a8ffa8" strokeWidth="0.5" />
        <line x1="11" y1="0" x2="11" y2="6" stroke="#a8ffa8" strokeWidth="0.5" />
        <line x1="11" y1="16" x2="11" y2="22" stroke="#a8ffa8" strokeWidth="0.5" />
        <line x1="0" y1="11" x2="6" y2="11" stroke="#a8ffa8" strokeWidth="0.5" />
        <line x1="16" y1="11" x2="22" y2="11" stroke="#a8ffa8" strokeWidth="0.5" />
      </svg>
    </div>
  )
}
