"use client"

// src/app/(customer)/notifications/page.tsx
// Trung t�m th�ng b�o � d?y d? t�nh nang
// Tab l?c � Mark read � Tap ? d�ng route � Badge unread � Real-time

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

// --- Types ------------------------------------------------
type NotifType = "order" | "promo" | "system" | "driver"

interface Notif {
  id:        string
  type:      NotifType
  title:     string
  body:      string
  href:      string
  isRead:    boolean
  time:      string
  icon:      string
  iconBg:    string
  iconColor: string
}

// --- Helpers ----------------------------------------------
function getNotifMeta(type: string): { icon: string; iconBg: string; iconColor: string; href: string } {
  switch (type) {
    case "order":  return { icon:"??", iconBg:"rgba(62,207,110,0.12)",   iconColor:"#3ecf6e", href:"/orders"       }
    case "promo":  return { icon:"???", iconBg:"rgba(255,107,0,0.12)",   iconColor:"#FF8C00", href:"/promo-items"  }
    case "ride":   return { icon:"??", iconBg:"rgba(255,107,0,0.12)",   iconColor:"#FF8C00", href:"/orders"       }
    case "driver": return { icon:"??", iconBg:"rgba(62,207,110,0.12)",   iconColor:"#3ecf6e", href:"/orders"       }
    default:       return { icon:"??", iconBg:"rgba(74,143,245,0.12)",   iconColor:"#4a8ff5", href:"/"             }
  }
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return "V?a xong"
  if (diff < 3600) return `${Math.floor(diff/60)} ph�t tru?c`
  if (diff < 86400) return `${Math.floor(diff/3600)} gi? tru?c`
  if (diff < 172800) return "H�m qua"
  return `${Math.floor(diff/86400)} ng�y tru?c`
}
const TABS = [
  { key:"all",    label:"T?t c?",     icon:"??" },
  { key:"order",  label:"�on h�ng",   icon:"??" },
  { key:"promo",  label:"Khuy?n m�i", icon:"???" },
  { key:"driver", label:"T�i x?",     icon:"??" },
  { key:"system", label:"H? th?ng",   icon:"??" },
]

// --- Main --------------------------------------------------
export default function NotificationsPage() {
  const supabase = createClient()
  const [notifs,    setNotifs]    = useState<Notif[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [loading,   setLoading]   = useState(true)
  const [swipedId,  setSwipedId]  = useState<string | null>(null)
  const touchX = useRef(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("notifications")
        .select("id,type,title,body,is_read,created_at,data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)
      const mapped: Notif[] = (data ?? []).map((n: {id:string;type:string;title:string;body:string;is_read:boolean;created_at:string;data:Record<string,unknown>|null}) => {
        const meta = getNotifMeta(n.type)
        const href = (n.data?.order_id ? `/tracking/${n.data.order_id}` : null) ?? meta.href
        return {
          id: n.id, type: n.type as NotifType, title: n.title, body: n.body,
          href, isRead: n.is_read, time: timeAgo(n.created_at),
          icon: meta.icon, iconBg: meta.iconBg, iconColor: meta.iconColor,
        }
      })
      setNotifs(mapped)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unreadCount = notifs.filter(n => !n.isRead).length

  const filtered = notifs.filter(n =>
    activeTab === "all" ? true : n.type === activeTab
  )

  const tabUnread = (key: string) =>
    key === "all"
      ? notifs.filter(n => !n.isRead).length
      : notifs.filter(n => n.type === key && !n.isRead).length

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead:true } : n))
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  }

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, isRead:true })))
    const ids = notifs.filter(n => !n.isRead).map(n => n.id)
    if (ids.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", ids)
    }
  }

  const deleteNotif = async (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id))
    setSwipedId(null)
    await supabase.from("notifications").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  }

  const deleteAll = async () => {
    const ids = (activeTab === "all" ? notifs : notifs.filter(n => n.type === activeTab)).map(n => n.id)
    if (!ids.length) return
    setNotifs(prev => activeTab === "all" ? [] : prev.filter(n => n.type !== activeTab))
    await supabase.from("notifications").update({ deleted_at: new Date().toISOString() }).in("id", ids)
  }

  return (
    <>
      <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      <div style={{ position:"fixed",inset:0,background:"#080806",
        display:"flex",flexDirection:"column" }}>

        {/* Header */}
        <div style={{ background:"rgba(8,8,6,0.96)",backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)",
          padding:"calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px",flexShrink:0,zIndex:40 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
            <a href="/" style={{ width:32,height:32,borderRadius:9,textDecoration:"none",
              background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>?</a>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f8f0e0",fontSize:15,fontWeight:700 }}>Th�ng b�o</div>
              {unreadCount > 0 && (
                <div style={{ color:"#6a5a40",fontSize:9,marginTop:1 }}>
                  {unreadCount} chua d?c
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  style={{ cursor:"pointer", color:"#FF8C00", fontSize:9, fontWeight:700, fontFamily:"Lexend", padding:"6px 10px", borderRadius:8, background:"rgba(255,107,0,0.08)", border:"1px solid rgba(255,107,0,0.2)", whiteSpace:"nowrap" }}>
                  ? �?c h?t
                </button>
              )}
              {filtered.length > 0 && (
                <button onClick={deleteAll}
                  style={{ cursor:"pointer", color:"#ff4040", fontSize:9, fontWeight:700, fontFamily:"Lexend", padding:"6px 10px", borderRadius:8, background:"rgba(255,64,64,0.08)", border:"1px solid rgba(255,64,64,0.2)", whiteSpace:"nowrap" }}>
                  ?? Xo� t?t c?
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex",gap:5,overflowX:"auto",
            scrollbarWidth:"none" } as React.CSSProperties}>
            {TABS.map(t => {
              const cnt = tabUnread(t.key); const on = activeTab === t.key
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ display:"flex",alignItems:"center",gap:4,flexShrink:0,
                    padding:"5px 11px",borderRadius:20,border:"none",
                    background:on?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                    outline:`${on?1.5:1}px solid ${on?"rgba(255,107,0,0.4)":"rgba(255,255,255,0.08)"}`,
                    color:on?"#FF8C00":"#6a5a40",
                    fontSize:9.5,fontWeight:on?600:400,
                    cursor:"pointer",fontFamily:"Lexend",transition:"all .2s" }}>
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {cnt > 0 && (
                    <span style={{ background:"#FF6B00",color:"#fff",
                      borderRadius:10,padding:"0 5px",fontSize:8,fontWeight:700 }}>
                      {cnt}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1,overflowY:"auto",padding:"10px 14px 88px",
          WebkitOverflowScrolling:"touch" } as React.CSSProperties}>

          {loading ? (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:220 }}>
              <div style={{ color:"#6a5a40",fontSize:11 }}>�ang t?i...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",height:220,gap:10 }}>
              <span style={{ fontSize:40 }}>??</span>
              <div style={{ color:"#6a5a40",fontSize:12 }}>Chua c� th�ng b�o n�o</div>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((n, idx) => (
                <motion.div key={n.id}
                  initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
                  exit={{ opacity:0,x:-40,transition:{duration:.2} }}
                  transition={{ delay:idx*0.03 }}
                  style={{ marginBottom:7, position:"relative", borderRadius:14 }}>
                  <a href={n.href} onClick={() => markRead(n.id)}
                    style={{ textDecoration:"none", display:"block" }}>
                    <div style={{
                      background: !n.isRead ? "rgba(255,107,0,0.06)" : "rgba(255,255,255,0.03)",
                      backdropFilter:"blur(10px)",
                      border:`1px solid ${!n.isRead ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius:14, padding:"11px 13px 11px 13px",
                      display:"flex", gap:10, alignItems:"flex-start",
                    }}>
                      <div style={{ width:38, height:38, borderRadius:11, background:n.iconBg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, marginTop:1 }}>
                        {n.icon}
                      </div>
                      <div style={{ flex:1, minWidth:0, paddingRight:16 }}>
                        <div style={{ color: !n.isRead?"#f8f0e0":"#b0956a", fontSize:11.5, fontWeight: !n.isRead?600:500, marginBottom:3, lineHeight:1.3 }}>
                          {n.title}
                        </div>
                        <div style={{ color:"#6a5a40", fontSize:9.5, lineHeight:1.5, marginBottom:5 }}>
                          {n.body}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ color:"#6a5a40", fontSize:8.5 }}>{n.time}</span>
                          <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.1)" }} />
                          <span style={{ fontSize:7.5, fontWeight:600, padding:"1px 6px", borderRadius:5,
                            background: n.type==="order"?"rgba(255,107,0,0.1)":n.type==="promo"?"rgba(255,179,71,0.1)":n.type==="driver"?"rgba(62,207,110,0.1)":"rgba(74,143,245,0.1)",
                            color: n.type==="order"?"#FF8C00":n.type==="promo"?"#FFB347":n.type==="driver"?"#3ecf6e":"#4a8ff5",
                          }}>
                            {n.type==="order"?"Đơn hàng":n.type==="promo"?"Khuyến mãi":n.type==="driver"?"Tài xế":"Hệ thống"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                  {/* Unread dot */}
                  {!n.isRead && (
                    <div style={{ position:"absolute", top:9, right:22, width:7, height:7, borderRadius:"50%", background:"#FF6B00", boxShadow:"0 0 5px rgba(255,107,0,0.6)", animation:"pulse 1.5s infinite", pointerEvents:"none" }} />
                  )}
                  {/* Delete × */}
                  <button onClick={e => { e.preventDefault(); deleteNotif(n.id) }}
                    style={{ position:"absolute", top:7, right:7, width:18, height:18, borderRadius:"50%", background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.35)", fontSize:11, lineHeight:1, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                    ×
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* All read state */}
          {unreadCount === 0 && notifs.length > 0 && (
            <div style={{ textAlign:"center",padding:"12px 0",
              color:"#6a5a40",fontSize:9 }}>
              ? B?n d� d?c t?t c? th�ng b�o
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{ position:"absolute",bottom:"max(16px,env(safe-area-inset-bottom))",left:14,right:14,height:56,
          background:"rgba(8,8,6,0.92)",backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          border:"1px solid rgba(255,107,0,0.2)",borderRadius:9999,
          display:"flex",alignItems:"center",justifyContent:"space-around",
          padding:"0 6px",zIndex:50,boxShadow:"0 0 20px rgba(255,107,0,0.1)" }}>
          {[
            { icon:"??",label:"Trang ch?",href:"/",        active:false },
            { icon:"??",label:"�on h�ng", href:"/orders",  active:false },
            { icon:"??",label:"Gi? h�ng", href:"/cart",    active:false },
            { icon:"??",label:"C�i d?t",  href:"/profile",active:false },
          ].map(tab => (
            <a key={tab.href} href={tab.href}
              style={{ textDecoration:"none",display:"flex",flexDirection:"column",
                alignItems:"center",gap:2,padding:"5px 11px",borderRadius:18,
                background:tab.active?"rgba(255,107,0,0.12)":"transparent",
                position:"relative",transition:"all .2s" }}>
              <span style={{ fontSize:19 }}>{tab.icon}</span>
              <span style={{ fontSize:7.5,color:"#6a5a40" }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
