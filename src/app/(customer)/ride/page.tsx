"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import AddressPicker from "@/components/map/AddressPicker";
import { createClient } from "@/lib/supabase/client";
import { getRouteKm } from "@/lib/vietmapRoute";
import type { AddressPickerResult } from "@/types";

// Same row-based fare calc as taxi
function calcFeeFromRows(km: number, rows: string[], extra: string): number {
  const kmInt = Math.ceil(Math.max(km, 1))
  let total = 0
  for (let i = 0; i < Math.min(kmInt, 10); i++) {
    let price = 0
    for (let j = i; j >= 0; j--) {
      if (rows[j] && rows[j] !== "") { price = parseInt(rows[j]) || 0; break }
    }
    total += price
  }
  if (kmInt > 10) total += (kmInt - 10) * (parseInt(extra) || 0)
  return total
}

const DEFAULT_MOTORBIKE_ROWS  = ["10000","9000","8000","7500","7000","6500","6000","5500","5000","4500"]
const DEFAULT_MOTORBIKE_EXTRA = "4000"

function RideContent() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [service,       setService]       = useState(params.get("type") === "taxi" ? "taxi" : "xe-om");
  const [pickup,        setPickup]        = useState("Krông Pắc, Đắk Lắk");
  const [dest,          setDest]          = useState("");
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState("");
  const [mapMode,       setMapMode]       = useState<null | "pickup" | "dest">(null);
  const [pickupCoord,   setPickupCoord]   = useState<{ lat: number; lng: number } | null>(null);
  const [destCoord,     setDestCoord]     = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm,    setDistanceKm]    = useState<number>(0);
  const [pricingRows,   setPricingRows]   = useState<string[]>(DEFAULT_MOTORBIKE_ROWS);
  const [pricingExtra,  setPricingExtra]  = useState(DEFAULT_MOTORBIKE_EXTRA);

  // Load pricing theo loại xe từ admin settings
  useEffect(() => {
    createClient()
      .from("app_settings").select("value").eq("key", "pricing").maybeSingle()
      .then(({ data }) => {
        const p = data?.value as Record<string, { rows?: string[]; extra?: string }> | null
        const key = service === "taxi" ? "taxi" : "motorbike"
        if (p?.[key]?.rows)  setPricingRows(p[key].rows!)
        if (p?.[key]?.extra) setPricingExtra(p[key].extra!)
      })
  }, [service])

  // Tính km cung đường thực khi có đủ 2 toạ độ (fallback haversine nếu API lỗi)
  useEffect(() => {
    if (!pickupCoord || !destCoord) { setDistanceKm(0); return }
    setDistanceKm(0)
    getRouteKm(pickupCoord.lat, pickupCoord.lng, destCoord.lat, destCoord.lng)
      .then(km => setDistanceKm(parseFloat(km.toFixed(1))))
  }, [pickupCoord, destCoord])

  const fireToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500) }

  const estimatedKm    = distanceKm
  const estimatedPrice = dest
    ? calcFeeFromRows(estimatedKm || 1, pricingRows, pricingExtra)
    : 0

  const handleBook = async () => {
    if (!dest.trim()) { fireToast("Vui lòng nhập điểm đến"); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { fireToast("Vui lòng đăng nhập để đặt xe"); setLoading(false); return }
      const pLat = pickupCoord?.lat ?? 12.683
      const pLng = pickupCoord?.lng ?? 108.483
      const dLat = destCoord?.lat ?? 12.683
      const dLng = destCoord?.lng ?? 108.483
      const { error } = await supabase.from("rides").insert({
        customer_id:     user.id,
        vehicle_type:    service === "taxi" ? "car" : "motorbike",
        pickup_address:  pickup,
        pickup_lat:      pLat,
        pickup_lng:      pLng,
        dropoff_address: dest,
        dropoff_lat:     dLat,
        dropoff_lng:     dLng,
        distance_km:     estimatedKm || null,
        estimated_fare:  estimatedPrice,
        payment_method:  "cash",
        status:          "searching",
      })
      if (error) { fireToast("Không thể đặt xe. Thử lại sau."); setLoading(false); return }
      fireToast("✅ Đang tìm xe ôm cho bạn...")
      setTimeout(() => router.push("/orders"), 2000)
    } catch {
      fireToast("Có lỗi xảy ra, vui lòng thử lại")
      setLoading(false)
    }
  }

  return (
    <>
    <div className="min-h-screen pb-32" style={{ background: "#080806" }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            style={{ position:"fixed",top:"calc(env(safe-area-inset-top, 0px) + 62px)",left:"50%",transform:"translateX(-50%)",zIndex:999,
              background:"rgba(255,107,0,0.15)",border:"1px solid rgba(255,107,0,0.35)",
              borderRadius:12,padding:"7px 16px",color:"#FF8C00",fontSize:11,fontWeight:600,
              backdropFilter:"blur(10px)",whiteSpace:"nowrap" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <header
        className="fixed top-0 inset-x-0 z-40 flex items-center gap-3 px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: 12,
          background: "rgba(8,8,6,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,107,0,0.08)",
        }}
      >
        <button onClick={() => router.back()}
          style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
          <ArrowLeft size={20} style={{ color: "var(--acc)" }} />
        </button>
        <h1 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{service === "taxi" ? "Đặt Taxi" : "Đặt xe ôm"}</h1>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)" }}>

        {/* Route preview */}
        {(pickupCoord || destCoord) ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl mt-4 p-4"
            style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.22)" }}
          >
            <div style={{ color: "rgba(255,215,0,0.65)", fontSize: 11, fontWeight: 700,
              marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
              🗺️ Tuyến đường
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: "var(--green)", boxShadow: "0 0 6px var(--green)" }} />
                <span style={{ color: pickupCoord ? "#f8f0e0" : "#6a5a40", fontSize: 10.5, flex: 1, lineHeight: 1.4 }}>
                  {pickup || "Chưa chọn điểm đón"}
                </span>
              </div>
              <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)", marginLeft: 3.5 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  background: "var(--acc)", boxShadow: "0 0 6px var(--acc)" }} />
                <span style={{ color: destCoord ? "#f8f0e0" : "#6a5a40", fontSize: 10.5, flex: 1, lineHeight: 1.4 }}>
                  {dest || "Chưa chọn điểm đến"}
                </span>
              </div>
              {distanceKm > 0 && (
                <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)",
                  color: "#b0956a", fontSize: 10 }}>
                  📏 Khoảng cách: <strong style={{ color: "#f8f0e0" }}>{distanceKm} km</strong>
                  <span style={{ color: "#6a5a40", marginLeft: 6 }}>(đường chim bay)</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div
            className="w-full rounded-2xl overflow-hidden mt-4"
            style={{ height: 80, background: "var(--glass)", border: "1px dashed rgba(255,215,0,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
          >
            <span style={{ fontSize: 26 }}>🏍️</span>
            <div>
              <p style={{ color: "#b0956a", fontSize: 11, fontWeight: 600 }}>Chọn điểm đón & điểm đến</p>
              <p style={{ color: "#6a5a40", fontSize: 11, marginTop: 2 }}>Nhấn 📍 hoặc 🗺️ để chọn trên bản đồ</p>
            </div>
          </div>
        )}

        {/* Địa chỉ */}
        <div
          className="p-4 rounded-2xl space-y-3"
          style={{ background: "var(--glass)", border: "1px solid var(--border-2)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--green)" }} />
            <input
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)", caretColor: "var(--acc)" }}
              placeholder="Điểm đón..."
            />
            <button
              onClick={() => setMapMode("pickup")}
              style={{ width: 44, height: 44, borderRadius: 10, border: "none", cursor: "pointer",
                background: "rgba(62,207,110,0.12)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              📍
            </button>
          </div>
          <div style={{ height: 1, background: "var(--border-2)" }} />
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--acc)" }} />
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)", caretColor: "var(--acc)" }}
              placeholder="Bạn muốn đến đâu?"
            />
            <button
              onClick={() => setMapMode("dest")}
              style={{ width: 44, height: 44, borderRadius: 10, border: "none", cursor: "pointer",
                background: "rgba(255,107,0,0.12)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              🗺️
            </button>
          </div>
        </div>

        {/* Ước tính */}
        {dest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl"
            style={{ background: "var(--glass-acc)", border: "1px solid var(--border)" }}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {distanceKm > 0 ? "Ước tính" : "Tối thiểu"}
                </p>
                <p className="text-xl font-black mt-0.5" style={{ color: "var(--acc)" }}>
                  {formatPrice(estimatedPrice)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Khoảng cách</p>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {distanceKm > 0 ? `${distanceKm} km` : "—"}
                </p>
              </div>
            </div>
            {distanceKm === 0 && dest && (
              <p style={{ color: "#6a5a40", fontSize: 9, marginTop: 6 }}>
                * Chọn điểm trên bản đồ để tính khoảng cách chính xác
              </p>
            )}
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!dest || loading}
          onClick={handleBook}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
          style={{
            background: dest && !loading
              ? "linear-gradient(135deg,var(--acc),var(--acc-mid),var(--acc-light))"
              : "rgba(255,255,255,0.06)",
            color: dest && !loading ? "#fff" : "var(--text-muted)",
            boxShadow: dest && !loading ? "0 4px 20px rgba(255,107,0,0.4)" : "none",
          }}
        >
          {loading ? "Đang tìm xe..." : service === "taxi"
            ? <>🚕 Đặt taxi ngay <ChevronRight size={18} /></>
            : <>🏍️ Đặt xe ôm ngay <ChevronRight size={18} /></>}
        </motion.button>
      </main>
    </div>

    {/* AddressPicker fullscreen overlay */}
    {mapMode && (
      <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
        <AddressPicker
          height="100dvh"
          initialLat={mapMode === "pickup" ? (pickupCoord?.lat ?? 12.6455) : (destCoord?.lat ?? 12.6455)}
          initialLng={mapMode === "pickup" ? (pickupCoord?.lng ?? 108.2612) : (destCoord?.lng ?? 108.2612)}
          onClose={() => setMapMode(null)}
          onConfirm={(result: AddressPickerResult) => {
            if (mapMode === "pickup") {
              setPickup(result.address)
              setPickupCoord({ lat: result.lat, lng: result.lng })
            } else {
              setDest(result.address)
              setDestCoord({ lat: result.lat, lng: result.lng })
            }
            setMapMode(null)
          }}
        />
      </div>
    )}
    </>
  );
}

export default function RidePage() {
  return (
    <Suspense>
      <RideContent />
    </Suspense>
  )
}
