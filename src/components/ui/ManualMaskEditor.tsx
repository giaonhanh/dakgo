"use client"
import { useRef, useEffect, useState, useCallback } from "react"

interface Props {
  src: string        // ảnh hiện tại (có thể đã qua AI xóa nền — PNG với alpha)
  originalSrc: string // ảnh gốc (để restore)
  onDone: (resultSrc: string) => void
  onCancel: () => void
}

type Mode = "erase" | "restore"

const BRUSH_SIZES = [
  { label: "S", px: 18 },
  { label: "M", px: 36 },
  { label: "L", px: 60 },
]

export default function ManualMaskEditor({ src, originalSrc, onDone, onCancel }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const origDataRef   = useRef<ImageData | null>(null)
  const isDrawing     = useRef(false)
  const rafRef        = useRef<number | null>(null)
  const pendingRef    = useRef<{ x: number; y: number } | null>(null)
  const historyRef    = useRef<ImageData[]>([])

  const [mode,      setMode]      = useState<Mode>("erase")
  const [brushIdx,  setBrushIdx]  = useState(1)
  const [ready,     setReady]     = useState(false)

  // ── Load ảnh lên canvas ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas  = canvasRef.current!
    const ctx     = canvas.getContext("2d", { willReadFrequently: true })!

    const img     = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      // Load ảnh gốc để lấy pixel data khi restore
      const origImg = new Image()
      origImg.crossOrigin = "anonymous"
      origImg.onload = () => {
        const tmp = document.createElement("canvas")
        tmp.width  = img.naturalWidth
        tmp.height = img.naturalHeight
        const tCtx = tmp.getContext("2d", { willReadFrequently: true })!
        tCtx.drawImage(origImg, 0, 0, img.naturalWidth, img.naturalHeight)
        origDataRef.current = tCtx.getImageData(0, 0, tmp.width, tmp.height)
        setReady(true)
      }
      origImg.src = originalSrc
    }
    img.src = src
  }, [src, originalSrc])

  // ── Pixel-level brush ────────────────────────────────────────────────────
  const applyBrush = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext("2d", { willReadFrequently: true })!
    const radius = BRUSH_SIZES[brushIdx].px * (canvas.width / canvas.offsetWidth)
    const origD  = origDataRef.current
    if (!origD) return

    const x0 = Math.max(0,             Math.floor(cx - radius))
    const y0 = Math.max(0,             Math.floor(cy - radius))
    const x1 = Math.min(canvas.width,  Math.ceil(cx  + radius))
    const y1 = Math.min(canvas.height, Math.ceil(cy  + radius))
    const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0)
    const d      = region.data

    for (let row = 0; row < region.height; row++) {
      for (let col = 0; col < region.width; col++) {
        const px   = x0 + col
        const py   = y0 + row
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        if (dist > radius) continue

        const soft = 1 - Math.pow(dist / radius, 2)     // soft falloff
        const str  = Math.round(255 * soft * 0.8)
        const i    = (row * region.width + col) * 4
        const gi   = (py  * canvas.width  + px)  * 4

        if (mode === "erase") {
          d[i + 3] = Math.max(0,   d[i + 3] - str)
        } else {
          d[i]     = origD.data[gi]
          d[i + 1] = origD.data[gi + 1]
          d[i + 2] = origD.data[gi + 2]
          d[i + 3] = Math.min(255, d[i + 3] + str)
        }
      }
    }
    ctx.putImageData(region, x0, y0)
  }, [brushIdx, mode])

  // ── Pointer → canvas coords ──────────────────────────────────────────────
  function toCanvasXY(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  function saveHistory() {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext("2d", { willReadFrequently: true })!
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (historyRef.current.length > 20) historyRef.current.shift()
  }

  function undo() {
    if (!historyRef.current.length) return
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext("2d", { willReadFrequently: true })!
    ctx.putImageData(historyRef.current.pop()!, 0, 0)
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    saveHistory()
    isDrawing.current = true
    const { x, y } = toCanvasXY(e)
    applyBrush(x, y)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDrawing.current) return
    const { x, y } = toCanvasXY(e)
    pendingRef.current = { x, y }
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingRef.current) applyBrush(pendingRef.current.x, pendingRef.current.y)
        pendingRef.current = null
        rafRef.current     = null
      })
    }
  }

  function onPointerUp() { isDrawing.current = false }

  // ── Xong → export canvas thành data URL ─────────────────────────────────
  function handleDone() {
    const canvas = canvasRef.current!
    onDone(canvas.toDataURL("image/png"))
  }

  const brushPx = BRUSH_SIZES[brushIdx].px

  return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"#080806",
      display:"flex", flexDirection:"column", fontFamily:"Lexend" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
        <button onClick={onCancel}
          style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"7px 14px", color:"#b0956a",
            fontSize:11, fontWeight:600, fontFamily:"Lexend", cursor:"pointer" }}>
          ← Quay lại
        </button>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700 }}>Chỉnh tay</div>
          <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>Vẽ để xóa hoặc giữ lại vùng</div>
        </div>
        <button onClick={handleDone}
          style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)", border:"none",
            borderRadius:10, padding:"7px 14px", color:"#fff",
            fontSize:11, fontWeight:700, fontFamily:"Lexend", cursor:"pointer" }}>
          ✅ Xong
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
        borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0, flexWrap:"wrap" }}>

        {/* Mode */}
        {(["erase","restore"] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding:"6px 12px", borderRadius:20, fontSize:11, fontWeight:600,
              fontFamily:"Lexend", cursor:"pointer", border:"1px solid",
              background: mode === m
                ? m === "erase" ? "rgba(255,64,64,0.2)"  : "rgba(62,207,110,0.2)"
                : "rgba(255,255,255,0.05)",
              borderColor: mode === m
                ? m === "erase" ? "rgba(255,64,64,0.6)"  : "rgba(62,207,110,0.6)"
                : "rgba(255,255,255,0.1)",
              color: mode === m
                ? m === "erase" ? "#ff8080" : "#3ecf6e"
                : "#6a5a40" }}>
            {m === "erase" ? "🧹 Xóa thêm" : "🖌️ Giữ lại"}
          </button>
        ))}

        {/* Brush size */}
        <div style={{ display:"flex", gap:4, marginLeft:4 }}>
          {BRUSH_SIZES.map((b, i) => (
            <button key={b.label} onClick={() => setBrushIdx(i)}
              style={{ width:28, height:28, borderRadius:"50%", border:"1px solid",
                background: brushIdx === i ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.05)",
                borderColor: brushIdx === i ? "rgba(255,107,0,0.6)" : "rgba(255,255,255,0.1)",
                color: brushIdx === i ? "#FF8C00" : "#6a5a40",
                fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"Lexend" }}>
              {b.label}
            </button>
          ))}
        </div>

        {/* Undo */}
        <button onClick={undo}
          style={{ marginLeft:"auto", padding:"6px 12px", borderRadius:10,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
            color:"#6a5a40", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Lexend" }}>
          ↩ Hoàn tác
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef}
        style={{ flex:1, position:"relative", overflow:"hidden",
          background:"repeating-conic-gradient(#1a1a1a 0% 25%, #0d0d0d 0% 50%) 0 0 / 16px 16px",
          cursor:"none", touchAction:"none" }}>
        <canvas ref={canvasRef}
          style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {/* Brush cursor overlay */}
        <BrushCursor containerRef={containerRef} size={brushPx} mode={mode} />
        {!ready && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:8 }}>
            <div style={{ fontSize:28 }}>⏳</div>
            <div style={{ color:"#6a5a40", fontSize:11 }}>Đang tải ảnh...</div>
          </div>
        )}
      </div>

      {/* Hint */}
      <div style={{ padding:"8px 16px 20px", textAlign:"center",
        color:"rgba(106,90,64,0.5)", fontSize:9, flexShrink:0 }}>
        {mode === "erase" ? "Vẽ lên vùng nền còn sót để xóa" : "Vẽ lên vùng chủ thể bị xóa nhầm để khôi phục"}
      </div>
    </div>
  )
}

// ── Brush cursor theo ngón tay / chuột ─────────────────────────────────────
function BrushCursor({ containerRef, size, mode }: {
  containerRef: React.RefObject<HTMLDivElement | null>
  size: number
  mode: Mode
}) {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    const dot = dotRef.current
    if (!el || !dot) return
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      dot.style.left    = `${e.clientX - r.left}px`
      dot.style.top     = `${e.clientY - r.top}px`
      dot.style.display = "block"
    }
    const hide = () => { dot.style.display = "none" }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerleave", hide)
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", hide) }
  }, [containerRef])

  return (
    <div ref={dotRef}
      style={{ position:"absolute", pointerEvents:"none", display:"none",
        width: size * 2, height: size * 2,
        borderRadius:"50%",
        border: `2px solid ${mode === "erase" ? "rgba(255,100,100,0.8)" : "rgba(62,207,110,0.8)"}`,
        background: mode === "erase" ? "rgba(255,64,64,0.15)" : "rgba(62,207,110,0.15)",
        transform:"translate(-50%,-50%)",
        zIndex:10, transition:"width .1s,height .1s" }}
    />
  )
}
