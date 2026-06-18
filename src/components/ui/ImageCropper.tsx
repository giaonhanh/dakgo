"use client"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"

interface Props {
  src: string
  onDone: (file: File) => void
  onCancel: () => void
}

async function cropToFile(src: string, pixelCrop: Area): Promise<File> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload  = () => res(i)
    i.onerror = rej
    i.src     = src
  })
  const canvas = document.createElement("canvas")
  const size = Math.min(pixelCrop.width, pixelCrop.height)
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size)
  return new Promise(res =>
    canvas.toBlob(b => res(new File([b!], "product.webp", { type: "image/webp" })), "image/webp", 0.88)
  )
}

export default function ImageCropper({ src, onDone, onCancel }: Props) {
  const [crop,   setCrop]   = useState({ x: 0, y: 0 })
  const [zoom,   setZoom]   = useState(1)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [busy,   setBusy]   = useState(false)

  const onCropComplete = useCallback((_: Area, p: Area) => setPixels(p), [])

  async function handleConfirm() {
    if (!pixels) return
    setBusy(true)
    const file = await cropToFile(src, pixels)
    onDone(file)
    setBusy(false)
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.92)",
      display:"flex", flexDirection:"column", fontFamily:"Lexend" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 16px", borderBottom:"1px solid rgba(255,107,0,0.15)" }}>
        <button onClick={onCancel}
          style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"7px 14px", color:"#b0956a", fontSize:11,
            fontWeight:600, fontFamily:"Lexend", cursor:"pointer" }}>
          Hủy
        </button>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#f8f0e0", fontSize:13, fontWeight:700 }}>Cắt ảnh</div>
          <div style={{ color:"#6a5a40", fontSize:9, marginTop:1 }}>Kéo · Pinch zoom để căn chỉnh</div>
        </div>
        <button onClick={handleConfirm} disabled={busy}
          style={{ background: busy ? "rgba(255,107,0,0.3)" : "linear-gradient(90deg,#FF6B00,#FFB347)",
            border:"none", borderRadius:10, padding:"7px 14px",
            color:"#fff", fontSize:11, fontWeight:700, fontFamily:"Lexend",
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "..." : "✅ Dùng ảnh"}
        </button>
      </div>

      {/* Cropper area */}
      <div style={{ flex:1, position:"relative" }}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="rect"
          showGrid={true}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { background:"#080806" },
            cropAreaStyle: {
              border: "2px solid #FF6B00",
              boxShadow: "0 0 0 9999px rgba(8,8,6,0.75)",
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div style={{ padding:"14px 24px 28px", display:"flex", alignItems:"center", gap:12,
        borderTop:"1px solid rgba(255,107,0,0.12)" }}>
        <span style={{ fontSize:12 }}>🔍</span>
        <input type="range" min={1} max={3} step={0.05} value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ flex:1, accentColor:"#FF6B00", height:3 }}
        />
        <span style={{ fontSize:14 }}>🔎</span>
      </div>
    </div>
  )
}
