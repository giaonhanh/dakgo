"use client"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import ManualMaskEditor from "./ManualMaskEditor"

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
  const [activeSrc, setActiveSrc] = useState(src)
  const [crop,      setCrop]      = useState({ x: 0, y: 0 })
  const [zoom,      setZoom]      = useState(1)
  const [pixels,    setPixels]    = useState<Area | null>(null)
  const [busy,      setBusy]      = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const [bgRemoved,  setBgRemoved]  = useState(false)
  const [removeErr,  setRemoveErr]  = useState("")
  const [progress,   setProgress]   = useState("")
  const [showManual, setShowManual] = useState(false)

  const onCropComplete = useCallback((_: Area, p: Area) => setPixels(p), [])

  async function handleRemoveBg() {
    setRemoving(true)
    setRemoveErr("")
    setProgress("Đang tải mô hình AI...")
    try {
      // Dynamic import — tránh SSR và chỉ tải khi cần
      const { removeBackground } = await import("@imgly/background-removal")
      setProgress("Đang phân tích ảnh...")
      const blob = await removeBackground(activeSrc, {
        model:      "isnet_quint8",
        output:     { format: "image/png", quality: 0.9 },
        progress:   (key: string, cur: number, total: number) => {
          if (key === "compute:inference") {
            setProgress(`Đang xóa nền... ${Math.round((cur / total) * 100)}%`)
          }
        },
      })
      const url = URL.createObjectURL(blob)
      setActiveSrc(url)
      setBgRemoved(true)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    } catch {
      setRemoveErr("Không xóa được nền. Thử lại hoặc bỏ qua.")
    } finally {
      setRemoving(false)
      setProgress("")
    }
  }

  function handleRevert() {
    setActiveSrc(src)
    setBgRemoved(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRemoveErr("")
  }

  async function handleConfirm() {
    if (!pixels) return
    setBusy(true)
    const file = await cropToFile(activeSrc, pixels)
    onDone(file)
    setBusy(false)
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.95)",
      display:"flex", flexDirection:"column", fontFamily:"Lexend" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 16px", borderBottom:"1px solid rgba(255,107,0,0.15)", flexShrink:0 }}>
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

      {/* Xóa nền AI toolbar */}
      <div style={{ padding:"10px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.05)",
        display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>

        {!bgRemoved ? (
          <button onClick={handleRemoveBg} disabled={removing}
            style={{ display:"flex", alignItems:"center", gap:6,
              background: removing ? "rgba(180,100,255,0.1)" : "rgba(180,100,255,0.15)",
              border:"1px solid rgba(180,100,255,0.4)",
              borderRadius:10, padding:"7px 14px", cursor: removing ? "not-allowed" : "pointer",
              color:"#b464ff", fontSize:11, fontWeight:700, fontFamily:"Lexend",
              opacity: removing ? 0.8 : 1, transition:"all .2s" }}>
            {removing ? (
              <>
                <span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⏳</span>
                <span>{progress || "Đang xử lý..."}</span>
              </>
            ) : (
              <>✨ Xóa nền AI</>
            )}
          </button>
        ) : (
          <button onClick={handleRevert}
            style={{ display:"flex", alignItems:"center", gap:6,
              background:"rgba(255,64,64,0.1)", border:"1px solid rgba(255,64,64,0.3)",
              borderRadius:10, padding:"7px 14px", cursor:"pointer",
              color:"#ff8080", fontSize:11, fontWeight:600, fontFamily:"Lexend" }}>
            ↩ Khôi phục ảnh gốc
          </button>
        )}

        {bgRemoved && (
          <div style={{ display:"flex", alignItems:"center", gap:5,
            background:"rgba(62,207,110,0.1)", border:"1px solid rgba(62,207,110,0.3)",
            borderRadius:10, padding:"6px 12px" }}>
            <span style={{ fontSize:11 }}>✅</span>
            <span style={{ color:"#3ecf6e", fontSize:10, fontWeight:600 }}>Đã xóa nền</span>
          </div>
        )}

        {removeErr && (
          <span style={{ color:"#ff8080", fontSize:10 }}>⚠️ {removeErr}</span>
        )}

        {/* Chỉnh tay — luôn hiển thị sau khi có ảnh */}
        <button onClick={() => setShowManual(true)}
          style={{ display:"flex", alignItems:"center", gap:5,
            background:"rgba(74,143,245,0.12)", border:"1px solid rgba(74,143,245,0.35)",
            borderRadius:10, padding:"7px 12px", cursor:"pointer",
            color:"#4a8ff5", fontSize:11, fontWeight:700, fontFamily:"Lexend" }}>
          ✏️ Chỉnh tay
        </button>

        <div style={{ marginLeft:"auto", color:"#6a5a40", fontSize:9, textAlign:"right", lineHeight:1.4 }}>
          Lần đầu tải ~40MB<br/>Lần sau dùng cache
        </div>
      </div>

      {/* Cropper area */}
      <div style={{ flex:1, position:"relative" }}>
        <Cropper
          image={activeSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="rect"
          showGrid={true}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: {
              background: bgRemoved ? "repeating-conic-gradient(#1a1a1a 0% 25%, #0d0d0d 0% 50%) 0 0 / 16px 16px"
                                    : "#080806",
            },
            cropAreaStyle: {
              border: "2px solid #FF6B00",
              boxShadow: "0 0 0 9999px rgba(8,8,6,0.75)",
            },
          }}
        />

        {/* Loading overlay khi đang xóa nền */}
        {removing && (
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            zIndex:10, gap:12 }}>
            <div style={{ fontSize:36 }}>🤖</div>
            <div style={{ color:"#b464ff", fontSize:13, fontWeight:700 }}>{progress || "Đang xử lý..."}</div>
            <div style={{ color:"#6a5a40", fontSize:10, textAlign:"center", maxWidth:200 }}>
              AI đang phân tích và xóa nền ảnh,<br/>vui lòng chờ...
            </div>
          </div>
        )}
      </div>

      {/* Zoom slider */}
      <div style={{ padding:"14px 24px 28px", display:"flex", alignItems:"center", gap:12,
        borderTop:"1px solid rgba(255,107,0,0.12)", flexShrink:0 }}>
        <span style={{ fontSize:12 }}>🔍</span>
        <input type="range" min={1} max={3} step={0.05} value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ flex:1, accentColor:"#FF6B00", height:3 }}
        />
        <span style={{ fontSize:14 }}>🔎</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Manual mask editor */}
      {showManual && (
        <ManualMaskEditor
          src={activeSrc}
          originalSrc={src}
          onDone={(resultSrc) => {
            setActiveSrc(resultSrc)
            setBgRemoved(true)
            setCrop({ x: 0, y: 0 })
            setZoom(1)
            setShowManual(false)
          }}
          onCancel={() => setShowManual(false)}
        />
      )}
    </div>
  )
}
