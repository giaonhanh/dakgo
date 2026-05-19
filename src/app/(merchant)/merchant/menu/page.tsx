"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Product {
  id: number; name: string; price: number; originalPrice?: number
  category: string; emoji: string; available: boolean; soldCount: number
}

const INIT: Product[] = [
  { id:1, name:"Bún bò đặc biệt", price:45000, originalPrice:55000, category:"Bún", emoji:"🍜", available:true, soldCount:156 },
  { id:2, name:"Bún bò thường",   price:35000, category:"Bún",      emoji:"🍜", available:true, soldCount:89 },
  { id:3, name:"Chả chiên giòn",  price:15000, category:"Thêm",     emoji:"🍡", available:true, soldCount:234 },
  { id:4, name:"Trứng cút luộc",  price:8000,  category:"Thêm",     emoji:"🥚", available:false, soldCount:45 },
  { id:5, name:"Trà đá",          price:5000,  category:"Đồ uống",  emoji:"🧊", available:true, soldCount:312 },
  { id:6, name:"Sinh tố bơ",      price:25000, category:"Đồ uống",  emoji:"🥑", available:true, soldCount:67 },
]
const CATS = ["Tất cả","Bún","Thêm","Đồ uống"]
const EMOJIS = ["🍜","🍗","🥤","🍱","🥗","🍕","🧁","🥩","🦐","🍛","🥚","🧊"]
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"

export default function MerchantMenuPage() {
  const [products, setProducts] = useState<Product[]>(INIT)
  const [cat, setCat] = useState("Tất cả")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:"", price:"", originalPrice:"", category:"", emoji:"🍜" })

  const toggle = (id: number) => setProducts(p => p.map(x => x.id===id?{...x,available:!x.available}:x))
  const remove = (id: number) => {
    const p = products.find(x => x.id === id)
    if (!p) return
    if (!confirm(`Xoá "${p.name}" khỏi menu?`)) return
    setProducts(prev => prev.filter(x => x.id !== id))
  }
  const handleAdd = () => {
    if (!form.name || !form.price) return
    setProducts(p => [...p, { id:Date.now(), name:form.name, price:parseInt(form.price.replace(/\D/g,"")||"0"), originalPrice:form.originalPrice?parseInt(form.originalPrice.replace(/\D/g,"")||"0"):undefined, category:form.category||"Khác", emoji:form.emoji, available:true, soldCount:0 }])
    setForm({ name:"",price:"",originalPrice:"",category:"",emoji:"🍜" })
    setShowAdd(false)
  }

  const filtered = cat==="Tất cả" ? products : products.filter(p=>p.category===cat)
  const totalRevenue = products.reduce((s,p)=>s+p.price*p.soldCount,0)

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input{outline:none;font-family:'Lexend',sans-serif}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>
      <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"52px 16px 0",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
            <a href="/merchant" style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16 }}>←</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:16,fontWeight:800 }}>Quản lý menu</div>
              <div style={{ color:"#6a5a40",fontSize:9 }}>{products.length} món · {products.filter(p=>p.available).length} đang bán</div>
            </div>
            <button onClick={()=>setShowAdd(true)} style={{ background:"linear-gradient(90deg,#FF6B00,#FF8C00)",border:"none",borderRadius:10,padding:"8px 14px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 2px 12px rgba(255,107,0,0.4)",flexShrink:0,whiteSpace:"nowrap" }}>+ Thêm món</button>
          </div>

          {/* Stats row */}
          <div style={{ display:"flex",gap:8,marginBottom:12 }}>
            {[
              { label:"Doanh thu (ước tính)", value:fmt(totalRevenue), color:"#FF8C00" },
              { label:"Đang bán", value:`${products.filter(p=>p.available).length} món`, color:"#3ecf6e" },
              { label:"Tạm ẩn", value:`${products.filter(p=>!p.available).length} món`, color:"#6a5a40" },
            ].map(({label,value,color}) => (
              <div key={label} style={{ flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:8 }}>
                <div style={{ color,fontSize:11,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{value}</div>
                <div style={{ color:"#6a5a40",fontSize:7,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Category tabs */}
          <div style={{ display:"flex",gap:6,overflowX:"auto",paddingBottom:14 }}>
            {CATS.map(c => (
              <button key={c} onClick={()=>setCat(c)} style={{ flexShrink:0,padding:"6px 14px",borderRadius:20,background:cat===c?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:cat===c?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",color:cat===c?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:cat===c?700:400,cursor:"pointer",fontFamily:"Lexend",transition:"all .15s",whiteSpace:"nowrap" }}>{c}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1,overflowY:"auto",padding:"10px 16px 20px" }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background:"rgba(255,255,255,0.04)",border:`1px solid ${p.available?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)"}`,borderRadius:14,padding:12,marginBottom:8,opacity:p.available?1:0.6,display:"flex",gap:12,alignItems:"center" }}>
              <div style={{ width:56,height:56,borderRadius:12,flexShrink:0,background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28 }}>{p.emoji}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ color:"#f8f0e0",fontSize:11.5,fontWeight:700,marginBottom:3,display:"flex",gap:6,alignItems:"center" }}>
                  {p.name}
                  {!p.available && <span style={{ background:"rgba(255,64,64,0.1)",border:"1px solid rgba(255,64,64,0.2)",borderRadius:4,padding:"1px 5px",color:"#ff4040",fontSize:7,fontWeight:700 }}>TẠM ẨN</span>}
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:3 }}>
                  <span style={{ background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:12,fontWeight:800 }}>{fmt(p.price)}</span>
                  {p.originalPrice && <span style={{ color:"#6a5a40",fontSize:9,textDecoration:"line-through" }}>{fmt(p.originalPrice)}</span>}
                </div>
                <div style={{ color:"#6a5a40",fontSize:8 }}>Đã bán: {p.soldCount} · {p.category}</div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6,flexShrink:0 }}>
                <button onClick={()=>toggle(p.id)} style={{ width:44,height:24,borderRadius:12,background:p.available?"rgba(62,207,110,0.2)":"rgba(255,255,255,0.06)",border:p.available?"1px solid rgba(62,207,110,0.4)":"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",padding:"2px 4px",cursor:"pointer",justifyContent:p.available?"flex-end":"flex-start",transition:"all .2s" }}>
                  <div style={{ width:16,height:16,borderRadius:"50%",background:p.available?"#3ecf6e":"#6a5a40",transition:"background .2s" }} />
                </button>
                <button onClick={()=>remove(p.id)} style={{ width:44,height:24,borderRadius:7,background:"rgba(255,64,64,0.06)",border:"1px solid rgba(255,64,64,0.15)",color:"#ff4040",fontSize:12,cursor:"pointer" }}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        {/* Add modal */}
        <AnimatePresence>
          {showAdd && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={()=>setShowAdd(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,backdropFilter:"blur(4px)" }} />
              <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }} transition={{ type:"spring",damping:22,stiffness:300 }} style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"20px 16px 32px",zIndex:51 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                  <div style={{ color:"#f8f0e0",fontSize:14,fontWeight:800 }}>Thêm món mới</div>
                  <button onClick={()=>setShowAdd(false)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer" }}>×</button>
                </div>
                <div style={{ display:"flex",gap:5,marginBottom:12,overflowX:"auto" }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={()=>setForm(f=>({...f,emoji:e}))} style={{ width:36,height:36,borderRadius:8,flexShrink:0,background:form.emoji===e?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",border:form.emoji===e?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",fontSize:18,cursor:"pointer" }}>{e}</button>
                  ))}
                </div>
                {[{ph:"Tên món *",fld:"name"},{ph:"Giá bán (VD: 45000) *",fld:"price"},{ph:"Giá gốc (nếu đang giảm)",fld:"originalPrice"},{ph:"Danh mục (Bún, Đồ uống...)",fld:"category"}].map(({ph,fld}) => (
                  <input key={fld} value={(form as Record<string,string>)[fld]} onChange={e=>setForm(f=>({...f,[fld]:e.target.value}))} placeholder={ph} style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px",color:"#f8f0e0",fontSize:12,marginBottom:8 }} />
                ))}
                <button onClick={handleAdd} style={{ width:"100%",height:48,borderRadius:12,background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",border:"none",cursor:"pointer",color:"#fff",fontSize:13,fontWeight:800,fontFamily:"Lexend",boxShadow:"0 4px 20px rgba(255,107,0,0.4)",position:"relative",overflow:"hidden",marginTop:4 }}>
                  <div style={{ position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",animation:"shimmer 2.5s infinite" }} />
                  <span style={{ position:"relative",zIndex:1 }}>✅ Thêm vào menu</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
