"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const AVATAR_LIST = ["🍜","🍗","🍕","🥗","🍱","🥤","🧁","🍛","🥩","🦐","🍔","🌮"]

type ToastType = "success" | "error" | "info"
interface Toast { id: number; msg: string; type: ToastType }
interface FormErrors { name: string; phone: string; address: string }

export default function MerchantProfilePage() {
  const supabase = createClient()

  // Data state
  const [shopId,      setShopId]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [isOpen,      setIsOpen]      = useState(false)
  const [name,        setName]        = useState("")
  const [phone,       setPhone]       = useState("")
  const [address,     setAddress]     = useState("")
  const [category,    setCategory]    = useState("")
  const [avatar,      setAvatar]      = useState("🍜")
  const [rating,      setRating]      = useState<number | null>(null)
  const [totalReview, setTotalReview] = useState(0)
  const [commission,  setCommission]  = useState(15)
  const [joined,      setJoined]      = useState("")

  // UI state
  const [editing,           setEditing]           = useState(false)
  const [showAvatarPicker,  setShowAvatarPicker]  = useState(false)
  const [toasts,            setToasts]            = useState<Toast[]>([])
  const [errors,            setErrors]            = useState<FormErrors>({ name:"", phone:"", address:"" })

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const [{ data: profile }, { data: shop }] = await Promise.all([
          supabase.from("profiles").select("created_at").eq("id", user.id).single(),
          supabase.from("shops")
            .select("id,name,phone,address,category,is_open,rating_avg,total_reviews,commission_rate,opening_hours")
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
          setCategory(shop.category ?? "")
          setIsOpen(shop.is_open ?? false)
          setRating(shop.rating_avg ?? null)
          setTotalReview(shop.total_reviews ?? 0)
          setCommission(shop.commission_rate ?? 15)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addToast = (msg: string, type: ToastType = "success") => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  const clearError = (key: keyof FormErrors) => setErrors(e => ({ ...e, [key]: "" }))


  const handleToggleOpen = async () => {
    const next = !isOpen
    setIsOpen(next)
    if (shopId) {
      const { error } = await supabase.from("shops").update({ is_open: next }).eq("id", shopId)
      if (error) { setIsOpen(!next); addToast("❌ Không thể cập nhật trạng thái", "error"); return }
    }
    addToast(next ? "🟢 Cửa hàng đang mở cửa" : "🔴 Cửa hàng đã đóng cửa", next ? "success" : "info")
  }

  const handleStartEdit = () => { setErrors({ name:"", phone:"", address:"" }); setEditing(true) }

  const handleSave = async () => {
    const next: FormErrors = { name:"", phone:"", address:"" }
    let valid = true
    if (!name.trim())    { next.name    = "Không được để trống"; valid = false }
    if (!phone.trim())   { next.phone   = "Không được để trống"; valid = false }
    if (!address.trim()) { next.address = "Không được để trống"; valid = false }
    setErrors(next)
    if (!valid) { addToast("❌ Vui lòng điền đầy đủ thông tin", "error"); return }

    if (shopId) {
      const { error } = await supabase.from("shops").update({
        name, phone, address,
        updated_at: new Date().toISOString(),
      }).eq("id", shopId)
      if (error) { addToast("❌ Lỗi lưu: " + error.message, "error"); return }
    }
    setEditing(false)
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
        html,body{background:#080806}
        input{outline:none}
        input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:0.5;cursor:pointer}
      `}</style>

      {/* Toast stack */}
      <div style={{ position:"fixed",top:"calc(env(safe-area-inset-top) + 64px)",left:16,right:16,zIndex:200,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:toastBg(t.type), border:`1px solid ${toastBdr(t.type)}`, borderRadius:12, padding:"10px 14px", color:toastClr(t.type), fontSize:12, fontWeight:600, backdropFilter:"blur(8px)" }}>
            {t.msg}
          </div>
        ))}
      </div>

      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"calc(env(safe-area-inset-top) + 14px) 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <Link href="/merchant" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</Link>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Hồ sơ cửa hàng</div>
            </div>
            <button onClick={editing ? handleSave : handleStartEdit}
              style={{ background:editing?"rgba(255,107,0,0.1)":"rgba(255,255,255,0.06)", border:editing?"1px solid rgba(255,107,0,0.3)":"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"6px 14px", color:editing?"#FF8C00":"#b0956a", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {editing ? "💾 Lưu" : "✏️ Sửa"}
            </button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 40px" }}>

          {/* Avatar + stats */}
          <div style={{ textAlign:"center",marginBottom:20 }}>
            <div style={{ position:"relative",display:"inline-block",marginBottom:14 }}>
              <div onClick={() => editing && setShowAvatarPicker(true)}
                style={{ width:88,height:88,borderRadius:24, background:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(255,107,0,0.05))", border:`2px solid ${editing?"rgba(255,107,0,0.55)":"rgba(255,107,0,0.3)"}`, display:"flex",alignItems:"center",justifyContent:"center",fontSize:42, cursor:editing?"pointer":"default",position:"relative",overflow:"hidden" }}>
                {avatar}
                {editing && <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.55)",fontSize:9,color:"#fff",padding:"3px 0",fontWeight:600,textAlign:"center" }}>Đổi</div>}
              </div>
              <div style={{ position:"absolute",bottom:-4,right:-4,width:22,height:22,borderRadius:7,background:isOpen?"#3ecf6e":"#6a5a40",border:"3px solid #080806" }} />
            </div>

            <div style={{ color:"#f8f0e0",fontSize:17,fontWeight:800,marginBottom:4 }}>{name || "Chưa đặt tên"}</div>
            <div style={{ color:"#6a5a40",fontSize:10,marginBottom:10 }}>{category || "Chưa chọn loại hình"}</div>

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

          {/* Shop info */}
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:10 }}>
            <div style={{ color:"#6a5a40",fontSize:10,fontWeight:600,marginBottom:12 }}>THÔNG TIN CỬA HÀNG</div>
            {([
              { label:"Tên cửa hàng",  value:name,    key:"name"    as const, setter: setName    },
              { label:"Số điện thoại", value:phone,   key:"phone"   as const, setter: setPhone   },
              { label:"Địa chỉ",       value:address, key:"address" as const, setter: setAddress },
              { label:"Ngày tham gia", value:joined || "—", key: null, setter: null },
            ] as Array<{ label:string; value:string; key: keyof FormErrors | null; setter: ((v:string)=>void) | null }>)
              .map(({ label, value, key, setter }, idx, arr) => {
                const isLast = idx === arr.length - 1
                const hasError = key ? errors[key] : ""
                return (
                  <div key={label} style={{ marginBottom: isLast ? 0 : 10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:isLast?0:10,borderBottom:isLast?"none":"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#6a5a40",fontSize:10,flexShrink:0,marginRight:8 }}>{label}</span>
                      {editing && setter && key ? (
                        <input value={value} onChange={e => { setter(e.target.value); clearError(key) }}
                          style={{ background:"rgba(255,255,255,0.06)",border:`1px solid ${hasError?"rgba(255,64,64,0.5)":"rgba(255,107,0,0.3)"}`,borderRadius:8,padding:"4px 10px",color:"#f8f0e0",fontSize:10,textAlign:"right",maxWidth:200,width:"100%" }} />
                      ) : (
                        <span style={{ color:"#f8f0e0",fontSize:10,fontWeight:600,textAlign:"right",maxWidth:200 }}>{value || "—"}</span>
                      )}
                    </div>
                    {hasError && <div style={{ color:"#ff4040",fontSize:9,textAlign:"right",marginTop:3 }}>{hasError}</div>}
                  </div>
                )
              })
            }
          </div>

          {/* Quick links */}
          {[
            { icon:"👁",  label:"Xem trước cửa hàng", sub:"Khách nhìn thấy thế này",    href:"/merchant/shop-preview" },
          ].map(({ icon, label, sub, href }) => (
            <Link key={label} href={href}
              style={{ display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14,marginBottom:8,textDecoration:"none" }}>
              <div style={{ width:40,height:40,borderRadius:11,background:"rgba(255,107,0,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#f8f0e0",fontSize:11,fontWeight:600 }}>{label}</div>
                <div style={{ color:"#6a5a40",fontSize:10,marginTop:2 }}>{sub}</div>
              </div>
              <span style={{ color:"#6a5a40",fontSize:16 }}>›</span>
            </Link>
          ))}

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

      </div>
    </>
  )
}
