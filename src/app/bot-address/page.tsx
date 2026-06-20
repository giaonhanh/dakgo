"use client"
import { Suspense, useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"

const VIETMAP_KEY = process.env.NEXT_PUBLIC_VIETMAP_SERVICES_KEY!

interface Suggestion {
  ref_id: string
  name: string
  address: string
  display: string
}

function AddressPicker() {
  const params   = useSearchParams()
  const senderId = params.get("sid") ?? ""

  const [query, setQuery]         = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [status, setStatus]       = useState<"idle" | "sending" | "done" | "error">("idle")
  const [errMsg, setErrMsg]       = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://maps.vietmap.vn/api/autocomplete/v3?apikey=${VIETMAP_KEY}&text=${encodeURIComponent(query)}&focus.point.lat=12.7056&focus.point.lon=108.5242`
        const res  = await fetch(url)
        const data = await res.json()
        const items: Suggestion[] = (data as Array<{
          ref_id: string; name: string; address: string
        }>).slice(0, 6).map(d => ({
          ref_id:  d.ref_id,
          name:    d.name,
          address: d.address,
          display: d.address ? `${d.name}, ${d.address}` : d.name,
        }))
        setSuggestions(items)
      } catch { setSuggestions([]) }
    }, 350)
  }, [query])

  const confirm = async (address: string) => {
    setSelected(address)
    setSuggestions([])
    setQuery(address)
    setStatus("sending")
    try {
      const res = await fetch("/api/bot/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: senderId, address }),
      })
      if (res.ok) setStatus("done")
      else throw new Error()
    } catch {
      setStatus("error")
      setErrMsg("Có lỗi xảy ra. Bạn có thể copy địa chỉ và paste vào Messenger nhé!")
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#080806", color: "#f8f0e0",
      fontFamily: "sans-serif", padding: "20px 16px",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingBottom: 8 }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>📍</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#FF8C00", margin: 0 }}>
          Chọn địa chỉ giao hàng
        </h2>
        <p style={{ color: "#b0956a", fontSize: 13, marginTop: 4 }}>
          Tìm và chọn địa chỉ — tự động gửi vào Messenger
        </p>
      </div>

      {status === "done" ? (
        <div style={{
          background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.3)",
          borderRadius: 14, padding: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <p style={{ color: "#3ecf6e", fontWeight: 700, fontSize: 16, margin: 0 }}>
            Đã gửi địa chỉ!
          </p>
          <p style={{ color: "#b0956a", fontSize: 13, marginTop: 6 }}>
            {selected}
          </p>
          <p style={{ color: "#6a5a40", fontSize: 12, marginTop: 8 }}>
            Quay lại Messenger để tiếp tục đặt hàng 😊
          </p>
        </div>
      ) : (
        <>
          {/* Search box */}
          <div style={{ position: "relative" }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null) }}
              placeholder="Nhập địa chỉ, tên đường, khu vực..."
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "14px 44px 14px 16px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,107,0,0.3)",
                borderRadius: 14, color: "#f8f0e0",
                fontSize: 15, outline: "none",
              }}
            />
            {query.length > 0 && (
              <button
                onClick={() => { setQuery(""); setSuggestions([]); setSelected(null) }}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#6a5a40",
                  fontSize: 18, cursor: "pointer", padding: 4,
                }}
              >✕</button>
            )}
          </div>

          {/* Gợi ý */}
          {suggestions.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, overflow: "hidden",
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={s.ref_id}
                  onClick={() => confirm(s.display)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "12px 16px", background: "none", border: "none",
                    borderBottom: i < suggestions.length - 1
                      ? "1px solid rgba(255,255,255,0.06)" : "none",
                    color: "#f8f0e0", cursor: "pointer", lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>📍 {s.name}</div>
                  {s.address && (
                    <div style={{ color: "#b0956a", fontSize: 12, marginTop: 2 }}>
                      {s.address}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Nhập tay nếu không tìm được */}
          {query.length >= 3 && suggestions.length === 0 && status !== "sending" && (
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: 16, textAlign: "center",
            }}>
              <p style={{ color: "#b0956a", fontSize: 13, margin: "0 0 12px" }}>
                Không tìm thấy gợi ý? Dùng địa chỉ bạn nhập
              </p>
              <button
                onClick={() => confirm(query)}
                style={{
                  padding: "10px 24px", borderRadius: 10,
                  background: "linear-gradient(to right, #FF6B00, #FF8C00)",
                  color: "#fff", fontWeight: 700, border: "none",
                  cursor: "pointer", fontSize: 14,
                }}
              >
                Dùng địa chỉ này
              </button>
            </div>
          )}

          {status === "error" && (
            <div style={{
              background: "rgba(255,64,64,0.1)", border: "1px solid rgba(255,64,64,0.3)",
              borderRadius: 14, padding: 16,
            }}>
              <p style={{ color: "#ff4040", fontSize: 13, margin: "0 0 8px" }}>{errMsg}</p>
              {selected && (
                <div style={{
                  background: "rgba(255,255,255,0.07)", borderRadius: 8,
                  padding: 10, fontSize: 13, color: "#f8f0e0",
                  userSelect: "all", wordBreak: "break-all",
                }}>
                  {selected}
                </div>
              )}
            </div>
          )}

          {status === "sending" && (
            <div style={{ textAlign: "center", color: "#b0956a", fontSize: 14 }}>
              Đang gửi địa chỉ...
            </div>
          )}

          {/* Hướng dẫn */}
          <div style={{
            background: "rgba(255,107,0,0.05)",
            border: "1px solid rgba(255,107,0,0.15)",
            borderRadius: 12, padding: 14,
          }}>
            <p style={{ color: "#b0956a", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
              💡 <b style={{ color: "#FF8C00" }}>Mẹo:</b> Nhập số nhà + tên đường để tìm chính xác hơn.
              Ví dụ: <span style={{ color: "#f8f0e0" }}>120 Giải Phóng, Phước An</span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default function BotAddressPage() {
  return (
    <Suspense>
      <AddressPicker />
    </Suspense>
  )
}
