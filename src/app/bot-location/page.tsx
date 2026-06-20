"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function LocationCapture() {
  const params = useSearchParams()
  const senderId = params.get("sid") ?? ""
  const keyword  = params.get("kw")  ?? "đồ ăn"

  const [status, setStatus] = useState<"asking" | "loading" | "done" | "error">("asking")
  const [msg, setMsg] = useState("")

  const capture = () => {
    setStatus("loading")
    if (!navigator.geolocation) {
      setStatus("error")
      setMsg("Trình duyệt không hỗ trợ xác định vị trí.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/bot/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender_id: senderId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              keyword,
            }),
          })
          if (res.ok) {
            setStatus("done")
            setMsg("Đã xác định vị trí! Quay lại Messenger để xem kết quả nhé 😊")
          } else {
            throw new Error("API error")
          }
        } catch {
          setStatus("error")
          setMsg("Có lỗi xảy ra, vui lòng thử lại.")
        }
      },
      (err) => {
        setStatus("error")
        setMsg(
          err.code === 1
            ? "Bạn cần cho phép truy cập vị trí để mình tìm quán gần nhất nhé!"
            : "Không thể xác định vị trí. Vui lòng thử lại."
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => { if (status === "asking") capture() }, [])

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#080806", color: "#f8f0e0",
      fontFamily: "sans-serif", padding: 24, textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        {status === "loading" ? "📡" : status === "done" ? "✅" : status === "error" ? "❌" : "📍"}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#FF8C00" }}>
        {status === "loading" ? "Đang xác định vị trí..." :
         status === "done"    ? "Thành công!" :
         status === "error"   ? "Không thể xác định" : "Xác định vị trí"}
      </h2>

      <p style={{ color: "#b0956a", fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
        {status === "loading" ? "Vui lòng chờ trong giây lát..." :
         status === "asking"  ? "Đang yêu cầu quyền truy cập vị trí..." : msg}
      </p>

      {status === "error" && (
        <button onClick={capture} style={{
          marginTop: 20, padding: "12px 28px", borderRadius: 12,
          background: "linear-gradient(to right, #FF6B00, #FF8C00)",
          color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 15,
        }}>
          Thử lại
        </button>
      )}

      {status === "done" && (
        <p style={{ marginTop: 16, color: "#3ecf6e", fontSize: 13 }}>
          Bạn có thể đóng trang này
        </p>
      )}
    </div>
  )
}

export default function BotLocationPage() {
  return (
    <Suspense>
      <LocationCapture />
    </Suspense>
  )
}
