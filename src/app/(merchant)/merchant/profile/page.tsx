"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { SHOP_CATEGORIES, getCategoryByValue, normalizeCategoryValue } from "@/lib/categories"

const MapPicker = dynamic(() => import("@/components/merchant/MapPicker"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#080806", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 32 }}>🗺️</div>
      <div style={{ color: "#6a5a40", fontSize: 12, fontFamily: "Lexend" }}>Đang tải bản đồ...</div>
    </div>
  ),
})

const AVATAR_LIST = ["🍜","🍗","🍕","🥗","🍱","🥤","🧁","🍛","🥩","🦐","🍔","🌮"]

type ToastType = "success" | "error" | "info"
interface Toast { id: number; msg: string; type: ToastType }

export default function MerchantProfilePage() {
  const supabase = createClient()

  const [shopId,      setShopId]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [isOpen,      setIsOpen]      = useState(false)
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [address,     setAddress]     = useState("")
  const [categories,  setCategories]  = useState<string[]>([])
  const [avatar,      setAvatar]      = useState("🍜")
  const [rating,      setRating]      = useState<number | null>(null)
  const [totalReview, setTotalReview] = useState(0)
  const [commission,  setCommission]  = useState(15)
  const [joined,      setJoined]      = useState("")
  const [lat,         setLat]         = useState<number | null>(null)
  const [lng,         setLng]         = useState<number | null>(null)

  // Track original values to detect changes
  const origRef = useRef({ name: "", phone: "", address: "" })
  const [dirty, setDirty] = useState(false)

  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showMapPicker,    setShowMapPicker]    = useState(false)
  const [toasts,           setToasts]           = useState<Toast[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const [{ data: profile }, { data: shop }] = await Promise.all([
          supabase.from("profiles").select("created_at").eq("id", user.id).single(),
          supabase.from("shops")
            .select("id,name,phone,address,category,categories,is_open,rating_avg,total_reviews,commission_rate,lat,lng")
            .eq("owner_id", user.id)
            .single(),
        ])

        if (profile?.created_at) {
          setJoined(new Date(profile.created_at).toLocaleDateString("vi-VN"))
        }
        if (shop) {
          setShopId(shop.id)
          setName(shop.name ?? "")
          setPhone(shop.phone ?? "")
          setAddress(shop.address ?? "")
          origRef.current = { name: shop.name ?? "", phone: shop.phone ?? "", address: shop.address ?? "" }
          const rawCats: string[] = Array.isArray(shop.categories) && shop.categories.length > 0
            ? shop.categories
            : shop.category ? [shop.category] : []
          setCategories(rawCats.map((v: string) => normalizeCategoryValue(v)))
          setIsOpen(shop.is_open ?? false)
          setRating(shop.rating_avg ?? null)
          setTotalReview(shop.total_reviews ?? 0)
          setCommission(shop.commission_rate ?? 15)
          if (shop.lat && shop.lng) {
            setLat(shop.lat as number)
            setLng(shop.lng as number)
          }
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkDirty = (n: string, p: string, a: string) => {
    const o = origRef.current
    setDirty(n !== o.name || p !== o.phone || a !== o.address)
  }

  const addToast = (msg: string, type: ToastType = "success") => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  const handleToggleOpen = async () => {
    const next = !isOpen
    setIsOpen(next)
    if (shopId) {
      const { error } = await supabase.from("shops").update({ is_open: next }).eq("id", shopId)
      if (error) { setIsOpen(!next); addToast("❌ Không thể cập nhật trạng thái", "error"); return }
    }
    addToast(next ? "🟢 Cửa hàng đang mở cửa" : "🔴 Cửa hàng đã đóng cửa", next ? "success" : "info")
  }

  const handleMapConfirm = async (pickedLat: number, pickedLng: number, geocodedAddr: string) => {
    setLat(pickedLat)
    setLng(pickedLng)
    if (geocodedAddr) {
      setAddress(geocodedAddr)
      checkDirty(name, phone, geocodedAddr)
    }
    setShowMapPicker(false)

    if (shopId) {
      const { error } = await supabase.from("shops").update({
        location:   `SRID=4326;POINT(${pickedLng} ${pickedLat})`,
        lat:        pickedLat,
        lng:        pickedLng,
        ...(geocodedAddr ? { address: geocodedAddr } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", shopId)
      if (error) addToast("❌ Lỗi lưu tọa độ: " + error.message, "error")
      else {
        addToast("📍 Đã lưu vị trí trên bản đồ")
        if (geocodedAddr) origRef.current.address = geocodedAddr
        checkDirty(name, phone, geocodedAddr || address)
      }
    }
  }

  const handleSave = async () => {
    if (!name.trim())    { addToast("❌ Tên cửa hàng không được để trống", "error"); return }
    if (!phone.trim())   { addToast("❌ Số điện thoại không được để trống", "error"); return }
    if (!address.trim()) { addToast("❌ Địa chỉ không được để trống", "error"); return }

    setSaving(true)
    if (shopId) {
      const payload: Record<string, unknown> = {
        name, phone, address, categories,
        category: categories[0] ?? "khac",
        updated_at: new Date().toISOString(),
      }
      if (lat !== null && lng !== null) {
        payload.location = `SRID=4326;POINT(${lng} ${lat})`
        payload.lat = lat
        payload.lng = lng
      }
      const { error } = await supabase.from("shops").update(payload).eq("id", shopId)
      if (error) { addToast("❌ Lỗi lưu: " + error.message, "error"); setSaving(false); return }
    }
    origRef.current = { name, phone, address }
    setDirty(false)
    setSaving(false)
    addToast("✅ Đã lưu thông tin cửa hàng")
  }

  const toastBg  = (t: ToastType) => t === "success" ? "rgba(62,207,110,0.15)"  : t === "error" ? "rgba(255,64,64,0.15)"  : "rgba(74,143,245,0.15)"
  const toastBdr = (t: ToastType) => t === "success" ? "rgba(62,207,110,0.4)"   : t === "error" ? "rgba(255,64,64,0.4)"   : "rgba(74,143,245,0.4)"
  const toastClr = (t: ToastType) => t === "success" ? "#3ecf6e"                : t === "error" ? "#ff4040"               : "#4a8ff5"

  if (loading) return (
    <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
      <div style={{ fontSize:32 }}>🏪</div>
      <div style={{ color:"#6a5a40",fontSize:12 }}>Đang tải hồ sơ...</div>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,textarea{outline:none;font-family:'Lexend',sans-serif}
        textarea{resize:none}
      `}</style>

      {/* Toast stack */}
      <div style={{ position:"fixed",top:"calc(env(safe-area-inset-top) + 64px)",left:16,right:16,zIndex:200,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:toastBg(t.type), border:`1px solid ${toastBdr(t.type)}`, borderRadius:12, padding:"10px 14px", color:toastClr(t.type), fontSize:12, fontWeight:600, backdropFilter:"blur(8px)" }}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Map Picker overlay */}
      {showMapPicker && (
        <MapPicker
          initialLat={lat}
          initialLng={lng}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 14px) 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <Link href="/merchant" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</Link>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Hồ sơ cửa hàng</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 100px" }}>

          {/* Avatar + stats */}
          <div style={{ textAlign:"center",marginBottom:20 }}>
            <div style={{ position:"relative",display:"inline-block",marginBottom:14 }}>
              <div onClick={() => setShowAvatarPicker(true)}
                style={{ width:88,height:88,borderRadius:24, background:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,107,0,0.05))", border:"2px solid rgba(255,107,0,0.3)", display:"flex",alignItems:"center",justifyContent:"center",fontSize:42, cursor:"pointer",position:"relative",overflow:"hidden" }}>
                {avatar}
                <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.55)",fontSize:9,color:"#fff",padding:"3px 0",fontWeight:600,textAlign:"center" }}>Đổi</div>
              </div>
              <div style={{ position:"absolute",bottom:-4,right:-4,width:22,height:22,borderRadius:7,background:isOpen?"#3ecf6e":"#6a5a40",border:"3px solid #080806" }} />
            </div>

            <div style={{ color:"#f8f0e0",fontSize:17,fontWeight:800,marginBottom:4 }}>{name || "Chưa đặt tên"}</div>
            <div style={{ color:"#6a5a40",fontSize:10,marginBottom:10 }}>
              {categories.length > 0 ? categories.map(v => getCategoryByValue(v).emoji).join(" ") + " " + categories.map(v => getCategoryByValue(v).label).join(", ") : "Chưa chọn loại hình"}
            </div>

            <div style={{ display:"flex",justifyContent:"center",gap:16,marginBottom:14 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#FF8C00",fontSize:14,fontWeight:700 }}>⭐ {rating?.toFixed(1) ?? "—"}</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>Điểm sao</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{totalReview}</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>Lượt đánh giá</div>
              </div>
              <div style={{ width:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:700 }}>{commission}%</div>
                <div style={{ color:"#6a5a40",fontSize:10 }}>Hoa hồng</div>
              </div>
            </div>

            <button onClick={handleToggleOpen}
              style={{ background:isOpen?"rgba(62,207,110,0.1)":"rgba(255,255,255,0.06)", border:isOpen?"1px solid rgba(62,207,110,0.3)":"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 20px", color:isOpen?"#3ecf6e":"#6a5a40", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              {isOpen ? "🟢 Đang mở cửa" : "🔴 Đang đóng cửa"}
            </button>
          </div>

          {/* Shop info — always editable */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600,marginBottom:12 }}>THÔNG TIN CỬA HÀNG</div>

            {/* Tên */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Tên cửa hàng</div>
              <input value={name} onChange={e => { setName(e.target.value); checkDirty(e.target.value, phone, address) }}
                placeholder="Tên cửa hàng..."
                style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12,fontWeight:600 }} />
            </div>

            {/* SĐT */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Số điện thoại</div>
              <input value={phone} onChange={e => { setPhone(e.target.value); checkDirty(name, e.target.value, address) }}
                placeholder="0xxx xxx xxx"
                style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:12 }} />
            </div>

            {/* Địa chỉ */}
            <div style={{ marginBottom:10 }}>
              <div style={{ color:"#6a5a40",fontSize:9,marginBottom:4 }}>Địa chỉ</div>
              <textarea value={address} onChange={e => { setAddress(e.target.value); checkDirty(name, phone, e.target.value) }}
                rows={2} placeholder="Số nhà, tên đường, phường/xã..."
                style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,107,0,0.25)",borderRadius:8,padding:"8px 10px",color:"#f8f0e0",fontSize:11,lineHeight:1.5 }} />
              <button type="button" onClick={() => setShowMapPicker(true)}
                style={{ marginTop:6,display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:8,background:"rgba(74,143,245,0.1)",border:"1px solid rgba(74,143,245,0.28)",color:"#4a8ff5",fontSize:9.5,fontWeight:700,cursor:"pointer" }}>
                📍 Chọn trên bản đồ
                {lat && lng && <span style={{ color:"#3ecf6e" }}>✓</span>}
              </button>
              {lat && lng && (
                <div style={{ color:"#3ecf6e",fontSize:8.5,marginTop:4 }}>✅ Có tọa độ · {lat.toFixed(5)}, {lng.toFixed(5)}</div>
              )}
            </div>

            {/* Loại hình — read-only */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Loại hình</span>
              <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600,textAlign:"right" }}>
                {categories.length > 0 ? categories.map(v=>`${getCategoryByValue(v).emoji} ${getCategoryByValue(v).label}`).join(", ") : "Chưa chọn"}
              </span>
            </div>

            {/* Ngày tham gia */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,marginTop:8,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color:"#6a5a40",fontSize:10 }}>Ngày tham gia</span>
              <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600 }}>{joined || "—"}</span>
            </div>
          </div>

          {/* Quick links */}
          <Link href="/merchant/shop-preview"
            style={{ display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:8,textDecoration:"none" }}>
            <div style={{ width:40,height:40,borderRadius:11,background:"rgba(255,107,0,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>👁</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600 }}>Xem trước cửa hàng</div>
              <div style={{ color:"#6a5a40",fontSize:10,marginTop:2 }}>Khách nhìn thấy thế này</div>
            </div>
            <span style={{ color:"#6a5a40",fontSize:16 }}>›</span>
          </Link>

        </div>

        {/* Sticky save bar — only shows when dirty */}
        {dirty && (
          <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"12px 16px calc(env(safe-area-inset-bottom) + 12px)",background:"linear-gradient(to top,#080806 60%,transparent)",borderTop:"1px solid rgba(255,107,0,0.15)" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#FF6B1A,#CC4A00)",border:"none",color:"#fff",fontSize:14,fontWeight:800,cursor:saving?"not-allowed":"pointer",opacity:saving?0.7:1,letterSpacing:0.5 }}>
              {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
            </button>
          </div>
        )}

      </div>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <>
          <div onClick={() => setShowAvatarPicker(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"20px 16px 32px",zIndex:51 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div style={{ color:"#f8f0e0",fontSize:13,fontWeight:800 }}>Chọn icon cửa hàng</div>
              <button onClick={() => setShowAvatarPicker(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center" }}>
              {AVATAR_LIST.map(e => (
                <button key={e} onClick={() => { setAvatar(e); setShowAvatarPicker(false) }}
                  style={{ width:52,height:52,borderRadius:12,background:avatar===e?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:avatar===e?"1px solid rgba(255,107,0,0.4)":"1px solid rgba(255,255,255,0.06)",fontSize:26,cursor:"pointer" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
