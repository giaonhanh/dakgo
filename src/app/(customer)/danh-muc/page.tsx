"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SHOP_CATEGORIES } from "@/lib/categories"
import { useCartStore } from "@/store/cartStore"

export default function AllCategoriesPage() {
  const router  = useRouter()
  const { items } = useCartStore()
  const totalQty  = items.reduce((s, i) => s + i.qty, 0)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
      `}</style>

      {/* Header */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:40,
        padding:"calc(env(safe-area-inset-top,0px) + 12px) 16px 12px",
        background:"rgba(8,8,6,0.97)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,107,0,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => router.back()}
            style={{ width:40, height:40, borderRadius:12,
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, cursor:"pointer", flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ color:"#f8f0e0", fontSize:16, fontWeight:800 }}>Tất cả danh mục</div>
            <div style={{ color:"#6a5a40", fontSize:11, marginTop:1 }}>{SHOP_CATEGORIES.length} loại món · Krông Pắc</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ minHeight:"100dvh", background:"#080806",
        paddingTop:"calc(env(safe-area-inset-top,0px) + 72px)",
        paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 80px)",
        padding:"calc(env(safe-area-inset-top,0px) + 72px) 16px calc(env(safe-area-inset-bottom,0px) + 80px)" }}>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {SHOP_CATEGORIES.map((cat, i) => (
            <motion.button key={cat.value}
              initial={{ opacity:0, y:12 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale:.93 }}
              onClick={() => router.push(`/danh-muc/${cat.value}`)}
              style={{
                background: cat.color,
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:16, padding:"18px 8px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                cursor:"pointer", fontFamily:"Lexend", transition:"all .15s",
              }}>
              <span style={{ fontSize:36 }}>{cat.emoji}</span>
              <span style={{ fontSize:10, fontWeight:700, color:"#f8f0e0",
                textAlign:"center", lineHeight:1.4 }}>{cat.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:"max(16px,env(safe-area-inset-bottom))", left:14, right:14, height:56,
        background:"rgba(8,8,6,0.92)", backdropFilter:"blur(20px)",
        border:"1px solid rgba(255,107,0,0.2)", borderRadius:9999,
        display:"flex", alignItems:"center", justifyContent:"space-around",
        padding:"0 6px", zIndex:50, boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
        {[
          { icon:"🏠", label:"Trang chủ", href:"/" },
          { icon:"📋", label:"Đơn hàng",  href:"/orders" },
          { icon:"🛒", label:"Giỏ hàng",  href:"/cart", badge: totalQty },
          { icon:"⚙️", label:"Cài đặt",   href:"/settings" },
        ].map(tab => (
          <a key={tab.href} href={tab.href}
            style={{ textDecoration:"none", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, padding:"5px 11px", borderRadius:18, position:"relative" }}>
            <span style={{ fontSize:19 }}>{tab.icon}</span>
            {"badge" in tab && tab.badge > 0 && (
              <div style={{ position:"absolute", top:1, right:6,
                width:14, height:14, borderRadius:99,
                background:"#ff4040", color:"#fff",
                fontSize:10, fontWeight:800,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {tab.badge > 9 ? "9+" : tab.badge}
              </div>
            )}
            <span style={{ fontSize:10, color:"#6a5a40" }}>{tab.label}</span>
          </a>
        ))}
      </div>
    </>
  )
}
