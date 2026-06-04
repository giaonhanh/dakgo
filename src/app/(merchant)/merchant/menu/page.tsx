"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import * as XLSX from "xlsx"
import {
  DndContext, DragEndEvent, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface MenuGroup {
  id: string; name: string
  allDay: boolean; startHour: string; endHour: string
  sortOrder: number
}
interface Topping { id: string; name: string; price: number }
interface SizeOpt  { id: string; label: string; priceDiff: number }
interface Product {
  id: string; name: string; description: string; imagePreview: string | null
  price: number; categories: string[]; menuGroupId: string
  allDay: boolean; startHour: string; endHour: string
  toppings: Topping[]; sizes: SizeOpt[]
  promoEnabled: boolean; promoPrice: number | null
  promoStart: string; promoEnd: string; promoPerPerson: number | null
  badge: "hot" | "bigsale" | "bestseller" | "new" | null
  available: boolean; soldCount: number; sortOrder: number
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORY_LIST = [
  "Buá»•i sÃ¡ng","Buá»•i trÆ°a","Buá»•i tá»‘i",
  "NÆ°á»›c uá»‘ng","MÃ³n nháº­u","Ä‚n váº·t",
]
const BADGE_LIST = [
  { key:"hot"        as const, label:"ðŸ”¥ HOT",      color:"#ff4040", bg:"rgba(255,64,64,0.15)",    border:"rgba(255,64,64,0.4)"    },
  { key:"bigsale"    as const, label:"ðŸ’¸ BIG SALE", color:"#FFD700", bg:"rgba(255,215,0,0.12)",    border:"rgba(255,215,0,0.4)"    },
  { key:"bestseller" as const, label:"ðŸ“ˆ BÃN CHáº Y", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)",  border:"rgba(62,207,110,0.4)"   },
  { key:"new"        as const, label:"âœ¨ Má»šI CÃ“",   color:"#4a8ff5", bg:"rgba(74,143,245,0.12)",   border:"rgba(74,143,245,0.4)"   },
]
const fmt = (n: number) => n.toLocaleString("vi-VN") + "Ä‘"
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`

// â”€â”€ Blank templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const blankGroup  = (): Omit<MenuGroup,"sortOrder"> => ({ id:uid(), name:"", allDay:true, startHour:"06:00", endHour:"22:00" })
const blankProduct = (): Product => ({
  id:uid(), name:"", description:"", imagePreview:null,
  price:0, categories:[], menuGroupId:"",
  allDay:true, startHour:"06:00", endHour:"22:00",
  toppings:[], sizes:[],
  promoEnabled:false, promoPrice:null, promoStart:"", promoEnd:"", promoPerPerson:null,
  badge:null, available:true, soldCount:0, sortOrder:0,
})

// (no hardcoded sample data â€” loaded from Supabase)

// â”€â”€ CSV Import types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ImportRow { name: string; description: string; price: number; promoPrice: number | null; category: string; badge: Product["badge"]; isAvailable: boolean; sizes: SizeOpt[]; toppings: Topping[] }

const APP_CATEGORIES = ["Buá»•i sÃ¡ng", "Buá»•i trÆ°a", "Buá»•i tá»‘i", "NÆ°á»›c uá»‘ng", "MÃ³n nháº­u", "Ä‚n váº·t"]

// Parse "Nhá»:25000, Vá»«a:30000, Lá»›n:35000" â†’ SizeOpt[]
function parseSizes(raw: string): SizeOpt[] {
  if (!raw.trim()) return []
  return raw.split(",").map(s => s.trim()).filter(Boolean).map((s, i) => {
    const [label, priceStr] = s.split(":").map(x => x.trim())
    const price = parseInt((priceStr ?? "").replace(/\D/g, "")) || 0
    return { id: `s${i}`, label: label || s, priceDiff: 0, _absPrice: price }
  }).map((s, _, arr) => ({ ...s, priceDiff: s._absPrice - (arr[0]?._absPrice ?? 0) }))
    .map(({ _absPrice: _p, ...rest }) => rest) as SizeOpt[]
}

// Parse "TrÃ¢n chÃ¢u:5000, Tháº¡ch:5000" â†’ Topping[]
function parseToppings(raw: string): Topping[] {
  if (!raw.trim()) return []
  return raw.split(",").map(s => s.trim()).filter(Boolean).map((s, i) => {
    const [name, priceStr] = s.split(":").map(x => x.trim())
    return { id: `t${i}`, name: name || s, price: parseInt((priceStr ?? "").replace(/\D/g, "")) || 0 }
  })
}

// â”€â”€ Drag-and-drop product card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ProductCardProps {
  p: Product; groups: MenuGroup[]
  onEdit: (p: Product) => void; onToggle: (id: string) => void; onDelete: (id: string) => void
}
function SortableProductCard({ p, groups, onEdit, onToggle, onDelete }: ProductCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  const bc = BADGE_LIST.find(x => x.key === p.badge)
  const gName = groups.find(g => g.id === p.menuGroupId)?.name ?? ""
  return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition,
      background:"rgba(255,255,255,0.04)", border:`1px solid ${p.available?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)"}`,
      borderRadius:14, padding:11, marginBottom:8, display:"flex", gap:10, alignItems:"center",
      opacity: isDragging ? 0.5 : p.available ? 1 : 0.6 }}>
      {/* Drag handle */}
      <div ref={setActivatorNodeRef} {...attributes} {...listeners}
        style={{ cursor:isDragging?"grabbing":"grab", touchAction:"none", flexShrink:0,
          color:"#3a2a15", fontSize:14, display:"flex", alignItems:"center", padding:"0 2px", userSelect:"none" as React.CSSProperties["userSelect"] }}>â ¿</div>
      {/* Image */}
      <div style={{width:54,height:54,borderRadius:12,flexShrink:0,background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,overflow:"hidden",position:"relative"}}>
        {p.imagePreview ? <img src={p.imagePreview} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span>ðŸ½ï¸</span>}
        {bc && <div style={{position:"absolute",top:2,left:2,background:bc.bg,border:`1px solid ${bc.border}`,borderRadius:4,padding:"1px 4px",fontSize:7,fontWeight:800,color:bc.color,lineHeight:1.3}}>{bc.label.split(" ")[0]}</div>}
      </div>
      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}>
          <div style={{color:"#f8f0e0",fontSize:11,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1,minWidth:0}}>{p.name}</div>
          {!p.available && <span style={{background:"rgba(255,64,64,0.1)",border:"1px solid rgba(255,64,64,0.2)",borderRadius:4,padding:"1px 5px",color:"#ff4040",fontSize:7,fontWeight:700,flexShrink:0}}>áº¨N</span>}
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4}}>
          <span style={{background:"linear-gradient(90deg,#FF6B00,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontSize:12,fontWeight:800}}>{fmt(p.price)}</span>
          {p.promoEnabled && p.promoPrice && p.promoPrice < p.price && (
            <span style={{background:"rgba(255,64,64,0.1)",border:"1px solid rgba(255,64,64,0.2)",borderRadius:4,padding:"1px 6px",color:"#ff4040",fontSize:9,fontWeight:700}}>{fmt(p.promoPrice)}</span>
          )}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {gName && <span style={{background:"rgba(74,143,245,0.1)",border:"1px solid rgba(74,143,245,0.2)",borderRadius:4,padding:"1px 5px",color:"#4a8ff5",fontSize:7}}>{gName}</span>}
          {p.categories.slice(0,2).map(c => (
            <span key={c} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:4,padding:"1px 5px",color:"#6a5a40",fontSize:7}}>{c}</span>
          ))}
          {p.toppings.length > 0 && <span style={{background:"rgba(180,100,255,0.08)",border:"1px solid rgba(180,100,255,0.2)",borderRadius:4,padding:"1px 5px",color:"#b464ff",fontSize:7}}>{p.toppings.length} topping</span>}
          {p.sizes.length > 0 && <span style={{background:"rgba(62,207,110,0.08)",border:"1px solid rgba(62,207,110,0.2)",borderRadius:4,padding:"1px 5px",color:"#3ecf6e",fontSize:7}}>{p.sizes.length} size</span>}
        </div>
      </div>
      {/* Actions */}
      <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
        <button onClick={() => onEdit(p)} style={{width:34,height:28,borderRadius:8,background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.2)",color:"#FF8C00",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>âœï¸</button>
        <button onClick={() => onToggle(p.id)} style={{width:34,height:28,borderRadius:8,background:p.available?"rgba(62,207,110,0.08)":"rgba(255,255,255,0.04)",border:p.available?"1px solid rgba(62,207,110,0.25)":"1px solid rgba(255,255,255,0.06)",color:p.available?"#3ecf6e":"#6a5a40",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
          {p.available?"ðŸ‘":"ðŸ™ˆ"}
        </button>
        <button onClick={() => onDelete(p.id)} style={{width:34,height:28,borderRadius:8,background:"rgba(255,64,64,0.06)",border:"1px solid rgba(255,64,64,0.15)",color:"#ff4040",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>ðŸ—‘</button>
      </div>
    </div>
  )
}

// â”€â”€ Drag-and-drop group card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface GroupCardProps {
  g: MenuGroup; productCount: number
  onEdit: (g: MenuGroup) => void; onDelete: (id: string) => void
}
function SortableGroupCard({ g, productCount, onEdit, onDelete }: GroupCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: g.id })
  return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition,
      background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:14, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12,
      opacity: isDragging ? 0.5 : 1 }}>
      {/* Drag handle */}
      <div ref={setActivatorNodeRef} {...attributes} {...listeners}
        style={{ cursor:isDragging?"grabbing":"grab", touchAction:"none", flexShrink:0,
          color:"#3a2a15", fontSize:14, display:"flex", alignItems:"center", padding:"0 2px", userSelect:"none" as React.CSSProperties["userSelect"] }}>â ¿</div>
      <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>ðŸ“‹</div>
      <div style={{flex:1}}>
        <div style={{color:"#f8f0e0",fontSize:12,fontWeight:700}}>{g.name}</div>
        <div style={{color:"#6a5a40",fontSize:9,marginTop:2}}>{productCount} mÃ³n Â· {g.allDay?"Cáº£ ngÃ y":`${g.startHour} â€“ ${g.endHour}`}</div>
      </div>
      <button onClick={() => onEdit(g)} style={{width:34,height:34,borderRadius:9,background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.2)",color:"#FF8C00",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>âœï¸</button>
      <button onClick={() => onDelete(g.id)} style={{width:34,height:34,borderRadius:9,background:"rgba(255,64,64,0.06)",border:"1px solid rgba(255,64,64,0.15)",color:"#ff4040",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>ðŸ—‘</button>
    </div>
  )
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function MerchantMenuPage() {
  const supabase = createClient()
  const [shopId,   setShopId]   = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [groups,   setGroups]   = useState<MenuGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mainTab,  setMainTab]  = useState<"products"|"groups">("products")
  const [filterGid, setFilterGid] = useState("all")

  // Group modal state
  const [gModal,   setGModal]   = useState<(Omit<MenuGroup,"sortOrder"> & {sortOrder?:number}) | null>(null)
  const [gEditing, setGEditing] = useState(false)

  // Product sheet state
  const [pModal,   setPModal]   = useState<Product | null>(null)
  const [pEditing, setPEditing] = useState(false)

  // CSV Import state
  const [importRows, setImportRows]   = useState<ImportRow[] | null>(null)
  const [importError, setImportError] = useState("")
  const [importSaving, setImportSaving] = useState(false)

  const [toast, setToast] = useState("")
  const [toastOk, setToastOk] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const csvRef   = useRef<HTMLInputElement>(null)

  const fire = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000) }

  // â”€â”€ Drag-and-drop sensors & handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const saveProdOrderToDb = useCallback(async (ordered: Product[]) => {
    for (const p of ordered) {
      await supabase.from("products").update({ sort_order: p.sortOrder }).eq("id", p.id)
    }
  }, [supabase])

  const persistGroups = useCallback(async (grps: MenuGroup[]) => {
    if (!shopId) return
    await supabase.from("shops").update({ menu_groups_data: grps }).eq("id", shopId)
  }, [shopId, supabase])

  const handleProductDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setProducts(ps => {
      const sorted = [...ps].sort((a,b) => a.sortOrder - b.sortOrder)
      const oldIdx = sorted.findIndex(p => p.id === active.id)
      const newIdx = sorted.findIndex(p => p.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return ps
      const reordered = arrayMove(sorted, oldIdx, newIdx)
      const updated = reordered.map((p, i) => ({ ...p, sortOrder: i }))
      saveProdOrderToDb(updated)
      return updated
    })
  }, [saveProdOrderToDb])

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setGroups(gs => {
      const sorted = [...gs].sort((a,b) => a.sortOrder - b.sortOrder)
      const oldIdx = sorted.findIndex(g => g.id === active.id)
      const newIdx = sorted.findIndex(g => g.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return gs
      const updated = arrayMove(sorted, oldIdx, newIdx).map((g, i) => ({ ...g, sortOrder: i }))
      persistGroups(updated)
      return updated
    })
  }, [persistGroups])

  // â”€â”€ Load from Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadProducts = useCallback(async (sid: string): Promise<Product[]> => {
    const { data } = await supabase
      .from("products")
      .select("id,name,description,price,original_price,category,tags,is_available,sold_count,sort_order,image_url,badge,toppings,sizes,all_day,start_hour,end_hour")
      .eq("shop_id", sid)
      .order("sort_order", { ascending: true })

    const mapped: Product[] = (data ?? []).map(p => ({
      id: p.id, name: p.name, description: p.description ?? "", imagePreview: p.image_url ?? null,
      price: p.price, categories: (p.tags as string[]) ?? [], menuGroupId: p.category ?? "",
      allDay: p.all_day ?? true,
      startHour: p.start_hour ?? "06:00",
      endHour: p.end_hour ?? "22:00",
      toppings: (p.toppings as Topping[]) ?? [],
      sizes: (p.sizes as SizeOpt[]) ?? [],
      promoEnabled: !!(p.original_price && p.original_price < p.price),
      promoPrice: p.original_price ?? null, promoStart: "", promoEnd: "", promoPerPerson: null,
      badge: (p.badge as Product["badge"]) ?? null,
      available: p.is_available, soldCount: p.sold_count, sortOrder: p.sort_order,
    }))
    setProducts(mapped)
    return mapped
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: shop } = await supabase
        .from("shops").select("id, menu_groups_data").eq("owner_id", user.id).maybeSingle()
      if (!shop) { setLoading(false); return }

      setShopId(shop.id)
      const prods = await loadProducts(shop.id)

      const saved = (shop.menu_groups_data as MenuGroup[] | null) ?? []
      if (saved.length > 0) {
        setGroups(saved)
      } else {
        // Backward compat: derive from existing product categories
        const cats = Array.from(new Set(prods.map(p => p.menuGroupId).filter(Boolean)))
        const derived: MenuGroup[] = cats.map((cat, i) => ({
          id: cat, name: cat, allDay: true, startHour: "06:00", endHour: "22:00", sortOrder: i,
        }))
        setGroups(derived)
        if (derived.length > 0) {
          await supabase.from("shops").update({ menu_groups_data: derived }).eq("id", shop.id)
        }
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // â”€â”€ CSV helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const splitCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = "", inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = ""
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const parseCSV = (text: string): ImportRow[] => {
    const lines = text.trim().split(/\r?\n/)
    const start = lines[0]?.toLowerCase().match(/tÃªn|name|mÃ³n/) ? 1 : 0
    const rows: ImportRow[] = []
    for (let i = start; i < lines.length; i++) {
      const r = parseRawRow(splitCSVLine(lines[i]))
      if (r) rows.push(r)
    }
    return rows
  }

  const parseRawRow = (cols: string[]): ImportRow | null => {
    // Thá»© tá»± cá»™t má»›i: [0]Danh má»¥c [1]TÃªn mÃ³n [2]MÃ´ táº£ [3]GiÃ¡ bÃ¡n [4]GiÃ¡ KM [5]Badge [6]Äang bÃ¡n
    // Backward compat: náº¿u cá»™t 0 trÃ´ng nhÆ° tÃªn mÃ³n (khÃ´ng cÃ³ giÃ¡ á»Ÿ cá»™t 3) â†’ dÃ¹ng thá»© tá»± cÅ©
    const col0 = cols[0]?.trim() ?? ""
    const col1 = cols[1]?.trim() ?? ""
    const priceAt3 = parseInt((cols[3] ?? "").replace(/\D/g, ""))
    const priceAt2 = parseInt((cols[2] ?? "").replace(/\D/g, ""))
    const isNewFormat = !isNaN(priceAt3) && priceAt3 > 0

    let name: string, category: string, description: string, priceRaw: string, promoRaw: string, badgeRaw: string, availRaw: string
    if (isNewFormat) {
      // Thá»© tá»± má»›i: Danh má»¥c | TÃªn | MÃ´ táº£ | GiÃ¡ | GiÃ¡ KM | Badge | Äang bÃ¡n
      category    = col0
      name        = col1
      description = cols[2]?.trim() ?? ""
      priceRaw    = cols[3] ?? ""
      promoRaw    = cols[4] ?? ""
      badgeRaw    = (cols[5] ?? "").toLowerCase().trim()
      availRaw    = (cols[6] ?? "").toLowerCase().trim()
    } else {
      // Thá»© tá»± cÅ© (backward compat): TÃªn | MÃ´ táº£ | GiÃ¡ | GiÃ¡ KM | Danh má»¥c | Badge
      name        = col0
      description = col1
      priceRaw    = cols[2] ?? ""
      promoRaw    = cols[3] ?? ""
      category    = cols[4]?.trim() ?? ""
      badgeRaw    = (cols[5] ?? "").toLowerCase().trim()
      availRaw    = (cols[6] ?? "").toLowerCase().trim()
      void priceAt3
    }

    if (!name) return null
    const price     = parseInt(priceRaw.replace(/\D/g, "")) || (isNewFormat ? 0 : priceAt2) || 0
    const promoPrice = promoRaw ? (parseInt(String(promoRaw).replace(/\D/g, "")) || null) : null
    const badge: Product["badge"] = badgeRaw === "hot" ? "hot" : badgeRaw === "bigsale" ? "bigsale" : badgeRaw === "bestseller" ? "bestseller" : badgeRaw === "new" ? "new" : null
    const isAvailable = availRaw === "" || ["cÃ³","co","yes","1","true"].includes(availRaw)
    const sizes    = parseSizes(   isNewFormat ? (cols[7] ?? "") : (cols[6] ?? ""))
    const toppings = parseToppings(isNewFormat ? (cols[8] ?? "") : (cols[7] ?? ""))
    return { name, description, price, promoPrice, category, badge, isAvailable, sizes, toppings }
  }

  const onCSVFile = (file: File) => {
    setImportError("")
    const isXLSX = /\.(xlsx|xls)$/i.test(file.name)
    if (isXLSX) {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const wb = XLSX.read(data, { type: "array" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][]
          const isHeader = raw[0] && /tÃªn|name|mÃ³n/i.test(String(raw[0][0]))
          const rows: ImportRow[] = []
          for (let i = isHeader ? 1 : 0; i < raw.length; i++) {
            const r = parseRawRow(raw[i].map(c => String(c ?? "")))
            if (r) rows.push(r)
          }
          if (rows.length === 0) { setImportError("File trá»‘ng hoáº·c khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng"); return }
          setImportRows(rows)
        } catch {
          setImportError("KhÃ´ng Ä‘á»c Ä‘Æ°á»£c file XLSX. Vui lÃ²ng táº£i láº¡i file máº«u.")
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        const rows = parseCSV(text)
        if (rows.length === 0) { setImportError("File trá»‘ng hoáº·c khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng"); return }
        setImportRows(rows)
      }
      reader.readAsText(file, "utf-8")
    }
  }

  const confirmImport = async () => {
    if (!importRows || !shopId) return
    setImportSaving(true)
    const saved: Product[] = []
    for (let i = 0; i < importRows.length; i++) {
      const r = importRows[i]
      const category = r.category || null
      const { data, error } = await supabase.from("products").insert({
        shop_id: shopId, name: r.name, description: r.description || null,
        price: r.price, original_price: r.promoPrice || null,
        category, is_available: r.isAvailable, sold_count: 0,
        sort_order: products.length + saved.length,
        sizes: r.sizes.length > 0 ? r.sizes : null,
        toppings: r.toppings.length > 0 ? r.toppings : null,
      }).select("id").single()
      if (!error && data) {
        saved.push({
          ...blankProduct(), id: data.id,
          name: r.name, description: r.description ?? "", price: r.price,
          promoEnabled: !!r.promoPrice && r.promoPrice < r.price,
          promoPrice: r.promoPrice, badge: r.badge,
          categories: category ? [category] : [], menuGroupId: category ?? "",
          sortOrder: products.length + saved.length,
        })
        if (category && !groups.find(g => g.id === category)) {
          setGroups(gs => [...gs, { id: category, name: category, allDay: true, startHour: "06:00", endHour: "22:00", sortOrder: gs.length }])
        }
      }
    }
    setProducts(ps => [...ps, ...saved])
    setImportRows(null)
    setImportSaving(false)
    fire(`âœ… ÄÃ£ lÆ°u ${saved.length}/${importRows.length} sáº£n pháº©m vÃ o Supabase`)
  }

  const downloadTemplate = () => {
    // â”€â”€ 9 cá»™t: Danh má»¥c | TÃªn mÃ³n | MÃ´ táº£ | GiÃ¡ bÃ¡n | GiÃ¡ KM | Badge | Äang bÃ¡n | Sizes | Toppings â”€â”€
    const headers = [
      "Danh má»¥c *",
      "TÃªn mÃ³n *",
      "MÃ´ táº£ / NguyÃªn liá»‡u",
      "GiÃ¡ bÃ¡n * (Ä‘)",
      "GiÃ¡ KM (Ä‘)",
      "Badge",
      "Äang bÃ¡n",
      "Sizes (TÃªn:GiÃ¡, TÃªn:GiÃ¡)",
      "Toppings (TÃªn:GiÃ¡, TÃªn:GiÃ¡)",
    ]

    // [Danh má»¥c, TÃªn, MÃ´ táº£, GiÃ¡, GiÃ¡ KM, Badge, Äang bÃ¡n, Sizes, Toppings]
    const samples = [
      ["Buá»•i sÃ¡ng", "BÃºn bÃ² Ä‘áº·c biá»‡t",   "BÃºn + thá»‹t bÃ² tÆ°Æ¡i + rau sá»‘ng",       45000, 40000, "bestseller", "CÃ“", "",                                   "ThÃªm thá»‹t:10000|ThÃªm trá»©ng:5000"],
      ["Buá»•i sÃ¡ng", "Phá»Ÿ bÃ² tÃ¡i chÃ­n",   "Phá»Ÿ + tÃ¡i + chÃ­n + hÃ nh lÃ¡",          40000, "",    "hot",        "CÃ“", "",                                   ""],
      ["Buá»•i sÃ¡ng", "BÃ¡nh mÃ¬ thá»‹t",      "BÃ¡nh mÃ¬ giÃ²n + pate + thá»‹t nguá»™i",    18000, 15000, "bigsale",    "CÃ“", "",                                   "ThÃªm trá»©ng:5000|ThÃªm phÃ´ mai:8000"],
      ["Buá»•i trÆ°a", "CÆ¡m sÆ°á»n bÃ¬ cháº£",   "CÆ¡m + sÆ°á»n nÆ°á»›ng + bÃ¬ + cháº£ lá»¥a",    40000, "",    "bestseller", "CÃ“", "",                                   ""],
      ["Buá»•i trÆ°a", "CÆ¡m gÃ  xá»‘i má»¡",     "CÆ¡m + gÃ  giÃ²n xá»‘i má»¡ + rau sá»‘ng",    42000, 38000, "hot",        "CÃ“", "",                                   ""],
      ["Buá»•i tá»‘i",  "GÃ  nÆ°á»›ng máº­t ong",  "GÃ  nÆ°á»›ng sá»‘t máº­t ong + tá»i + á»›t",   50000, 45000, "",           "CÃ“", "",                                   "ThÃªm cÆ¡m:10000|ThÃªm rau:5000"],
      ["Buá»•i tá»‘i",  "Láº©u thÃ¡i háº£i sáº£n",  "Láº©u chua cay + tÃ´m + má»±c + nghÃªu", 180000, "",    "hot",        "CÃ“", "Nhá» (2 ngÆ°á»i):180000|Lá»›n (4 ngÆ°á»i):320000", "ThÃªm mÃ¬:10000|ThÃªm rau:15000"],
      ["NÆ°á»›c uá»‘ng", "CÃ  phÃª sá»¯a Ä‘Ã¡",     "CÃ  phÃª phin + sá»¯a Ä‘áº·c + Ä‘Ã¡",          25000, "",    "",           "CÃ“", "Nhá»:25000|Vá»«a:30000|Lá»›n:35000",     "ThÃªm Ä‘Æ°á»ng:2000|Ãt Ä‘Ã¡:0"],
      ["NÆ°á»›c uá»‘ng", "TrÃ  sá»¯a trÃ¢n chÃ¢u", "TrÃ  sá»¯a thÆ¡m bÃ©o + trÃ¢n chÃ¢u Ä‘en",    35000, 30000, "bestseller", "CÃ“", "Nhá»:35000|Vá»«a:42000|Lá»›n:49000",     "TrÃ¢n chÃ¢u:5000|Tháº¡ch:5000|Pudding:8000"],
      ["NÆ°á»›c uá»‘ng", "Sinh tá»‘ bÆ¡",        "BÆ¡ tÆ°Æ¡i bÃ©o ngáº­y + sá»¯a Ä‘áº·c",          30000, "",    "hot",        "CÃ“", "Nhá»:30000|Lá»›n:40000",               "Ãt Ä‘Æ°á»ng:0|KhÃ´ng Ä‘Æ°á»ng:0"],
      ["MÃ³n nháº­u",  "GÃ  chiÃªn nÆ°á»›c máº¯m", "GÃ  chiÃªn giÃ²n sá»‘t nÆ°á»›c máº¯m + tá»i",   85000, "",    "",           "CÃ“", "Ná»­a con:85000|NguyÃªn con:160000",    ""],
      ["MÃ³n nháº­u",  "Báº¯p bÃ² ngÃ¢m máº¯m",  "Báº¯p bÃ² giÃ²n + tÆ°Æ¡ng hoisin + láº¡c",   65000, 55000, "new",        "CÃ“", "",                                   "ThÃªm trá»©ng:10000"],
      ["Ä‚n váº·t",    "BÃ¡nh trÃ¡ng trá»™n",   "BÃ¡nh trÃ¡ng + xoÃ i + tÃ´m khÃ´ + sa táº¿", 20000, "",    "hot",        "CÃ“", "Nhá»:20000|Lá»›n:30000",               "ThÃªm sa táº¿:3000|ThÃªm tÃ´m:5000"],
      ["Ä‚n váº·t",    "ChÃ¨ 3 mÃ u",         "Äáº­u xanh + Ä‘áº­u Ä‘á» + nÆ°á»›c cá»‘t dá»«a",   15000, "",    "",           "CÃ“", "",                                   "Ãt Ä‘Æ°á»ng:0|ThÃªm trÃ¢n chÃ¢u:5000"],
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...samples])

    // Äá»™ rá»™ng cá»™t
    ws["!cols"] = [
      { wch: 14 }, // A Danh má»¥c
      { wch: 24 }, // B TÃªn mÃ³n
      { wch: 34 }, // C MÃ´ táº£
      { wch: 13 }, // D GiÃ¡ bÃ¡n
      { wch: 11 }, // E GiÃ¡ KM
      { wch: 11 }, // F Badge
      { wch: 10 }, // G Äang bÃ¡n
      { wch: 36 }, // H Sizes
      { wch: 36 }, // I Toppings
    ]
    ws["!freeze"] = { xSplit: 0, ySplit: 1 }

    // Style tiÃªu Ä‘á»
    const HEADER_FILL = "FF6B1A"
    const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1:I1")
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r: 0, c })
      if (!ws[cell]) ws[cell] = { t: "s", v: "" }
      ws[cell].s = {
        font:      { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
        fill:      { patternType: "solid", fgColor: { rgb: HEADER_FILL } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border:    { bottom: { style: "medium", color: { rgb: "CC5500" } } },
      }
    }
    // MÃ u riÃªng cá»™t H, I (xanh tÃ­m nháº¡t Ä‘á»ƒ phÃ¢n biá»‡t)
    for (const col of ["H1","I1"]) {
      if (ws[col]) ws[col].s = { ...ws[col].s, fill: { patternType: "solid", fgColor: { rgb: "5050AA" } } }
    }

    // Style data rows â€” mÃ u xen káº½ + mÃ u Ä‘áº·c biá»‡t cho H, I
    for (let r = 1; r <= samples.length; r++) {
      const baseFill = r % 2 === 0 ? "FFF3EB" : "FFFFFF"
      for (let c = 0; c <= 8; c++) {
        const cell = XLSX.utils.encode_cell({ r, c })
        if (!ws[cell]) ws[cell] = { t: "s", v: "" }
        ws[cell].s = {
          fill:      { patternType: "solid", fgColor: { rgb: c >= 7 ? (r % 2 === 0 ? "EEEEFF" : "F5F5FF") : baseFill } },
          alignment: { vertical: "center", wrapText: c === 2 || c >= 7 },
          font:      { sz: 9, color: { rgb: c === 3 || c === 4 ? "CC4400" : c >= 7 ? "333388" : "000000" } },
          border: { top: { style: "thin", color: { rgb: "DDDDDD" } }, bottom: { style: "thin", color: { rgb: "DDDDDD" } }, left: { style: "thin", color: { rgb: "DDDDDD" } }, right: { style: "thin", color: { rgb: "DDDDDD" } } },
        }
      }
    }
    ws["!rows"] = [{ hpt: 28 }, ...Array(samples.length).fill({ hpt: 20 })]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "ðŸ“‹ Danh sÃ¡ch mÃ³n")

    // â”€â”€ Sheet hÆ°á»›ng dáº«n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const guide = XLSX.utils.aoa_to_sheet([
      ["ðŸ“– HÆ¯á»šNG DáºªN NHáº¬P MENU â€” GIAO NHANH KRÃ”NG Páº®C"],
      [""],
      ["ðŸ”¶ BÆ¯á»šC 1: Äiá»n thÃ´ng tin vÃ o sheet 'ðŸ“‹ Danh sÃ¡ch mÃ³n'"],
      ["ðŸ”¶ BÆ¯á»šC 2: LÆ°u file â†’ App â†’ Thá»±c Ä‘Æ¡n â†’ Nháº­p tá»« Excel â†’ chá»n file nÃ y"],
      ["ðŸ”¶ BÆ¯á»šC 3: Kiá»ƒm tra preview â†’ báº¥m LÆ°u vÃ o há»‡ thá»‘ng"],
      [""],
      ["â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"],
      ["ðŸ“Œ MÃ” Táº¢ 9 Cá»˜T"],
      ["â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"],
      ["Cá»™t", "Báº¯t buá»™c?", "MÃ´ táº£", "VÃ­ dá»¥"],
      ["A - Danh má»¥c *",  "CÃ“ âœ“",  "Chá»‰ dÃ¹ng 1 trong 6 danh má»¥c sau (viáº¿t Ä‘Ãºng chÃ­nh táº£):",       ""],
      ["",                "",       "  ðŸŒ… Buá»•i sÃ¡ng    â˜€ï¸ Buá»•i trÆ°a    ðŸŒ™ Buá»•i tá»‘i",               ""],
      ["",                "",       "  ðŸ¥¤ NÆ°á»›c uá»‘ng    ðŸº MÃ³n nháº­u     ðŸ¿ Ä‚n váº·t",                 ""],
      ["B - TÃªn mÃ³n *",   "CÃ“ âœ“",  "TÃªn hiá»ƒn thá»‹ cho khÃ¡ch Ä‘áº·t.",                                   "TrÃ  sá»¯a trÃ¢n chÃ¢u"],
      ["C - MÃ´ táº£",       "KhÃ´ng",  "NguyÃªn liá»‡u / mÃ´ táº£ ngáº¯n. Tá»‘i Ä‘a ~80 kÃ½ tá»±.",                  "TrÃ  sá»¯a + trÃ¢n chÃ¢u Ä‘en"],
      ["D - GiÃ¡ bÃ¡n * (Ä‘)","CÃ“ âœ“", "Sá»‘ nguyÃªn, KHÃ”NG gÃµ dáº¥u cháº¥m/pháº©y.",                           "35000"],
      ["E - GiÃ¡ KM (Ä‘)",  "KhÃ´ng",  "GiÃ¡ sau giáº£m. Pháº£i nhá» hÆ¡n giÃ¡ bÃ¡n. Bá» trá»‘ng náº¿u khÃ´ng KM.",  "30000"],
      ["F - Badge",       "KhÃ´ng",  "bestseller | hot | new | bigsale | (Ä‘á»ƒ trá»‘ng)",                 "bestseller"],
      ["G - Äang bÃ¡n",    "KhÃ´ng",  "CÃ“ hoáº·c KHÃ”NG. Máº·c Ä‘á»‹nh = CÃ“ náº¿u bá» trá»‘ng.",                  "CÃ“"],
      ["H - Sizes",       "KhÃ´ng",  "CÃ¡c cá»¡ cá»§a mÃ³n â€” dÃ¹ng dáº¥u | ngÄƒn cÃ¡ch, dáº¥u : ngÄƒn tÃªn vÃ  giÃ¡.", "Nhá»:25000|Vá»«a:30000|Lá»›n:35000"],
      ["",                "",       "  âš ï¸ Nháº­p GIÃ THá»°C (khÃ´ng pháº£i giÃ¡ chÃªnh lá»‡ch)",               ""],
      ["",                "",       "  âš ï¸ Size Ä‘áº§u tiÃªn = giÃ¡ gá»‘c (= cá»™t D). Size sau = giÃ¡ lá»›n hÆ¡n.",""],
      ["",                "",       "  âœ… Bá» trá»‘ng náº¿u mÃ³n khÃ´ng cÃ³ size",                           ""],
      ["I - Toppings",    "KhÃ´ng",  "CÃ¡c topping thÃªm vÃ o â€” dÃ¹ng dáº¥u | ngÄƒn cÃ¡ch, dáº¥u : ngÄƒn tÃªn:giÃ¡", "TrÃ¢n chÃ¢u:5000|Tháº¡ch:5000|Pudding:8000"],
      ["",                "",       "  âœ… Bá» trá»‘ng náº¿u khÃ´ng cÃ³ topping",                            ""],
      [""],
      ["â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"],
      ["ðŸ“ VÃ Dá»¤ Cá»¤ THá»‚"],
      ["â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"],
      ["TRÆ¯á»œNG Há»¢P 1: MÃ³n khÃ´ng cÃ³ size, khÃ´ng cÃ³ topping"],
      ["â†’ Sizes: (Ä‘á»ƒ trá»‘ng)    Toppings: (Ä‘á»ƒ trá»‘ng)"],
      [""],
      ["TRÆ¯á»œNG Há»¢P 2: CÃ  phÃª cÃ³ 3 cá»¡ + topping Ä‘Æ°á»ng"],
      ["â†’ Sizes:    Nhá»:25000|Vá»«a:30000|Lá»›n:35000"],
      ["â†’ Toppings: ThÃªm Ä‘Æ°á»ng:2000|Ãt Ä‘Ã¡:0"],
      [""],
      ["TRÆ¯á»œNG Há»¢P 3: Láº©u cÃ³ 2 pháº§n (2 ngÆ°á»i / 4 ngÆ°á»i)"],
      ["â†’ Sizes: Nhá» (2 ngÆ°á»i):180000|Lá»›n (4 ngÆ°á»i):320000"],
      ["â†’ Toppings: ThÃªm mÃ¬:10000|ThÃªm rau:15000|ThÃªm náº¥m:20000"],
      [""],
      ["TRÆ¯á»œNG Há»¢P 4: Topping miá»…n phÃ­ (tÃ¹y chá»n)"],
      ["â†’ Toppings: Ãt Ä‘Æ°á»ng:0|KhÃ´ng Ä‘Æ°á»ng:0|Nhiá»u Ä‘Ã¡:0"],
      [""],
      ["â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"],
      ["âš ï¸  LÆ¯U Ã"],
      ["â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"],
      ["âœ… KHÃ”NG xÃ³a dÃ²ng tiÃªu Ä‘á» (dÃ²ng 1 mÃ u cam)"],
      ["âœ… Má»—i mÃ³n 1 dÃ²ng â€” KHÃ”NG merge Ã´"],
      ["âœ… GiÃ¡ bÃ¡n, Sizes, Toppings Ä‘á»u nháº­p sá»‘ nguyÃªn (Ä‘á»“ng)"],
      ["âœ… Danh má»¥c pháº£i Ä‘Ãºng 1 trong 6 tÃªn trÃªn â€” sai sáº½ khÃ´ng hiá»ƒn thá»‹ Ä‘Ãºng trÃªn app"],
      ["âŒ KhÃ´ng upload áº£nh qua file Excel â€” upload áº£nh trong app sau khi lÆ°u"],
    ])

    guide["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 62 }, { wch: 40 }]
    guide["!rows"] = [{ hpt: 28 }]
    const titleCell = guide["A1"]
    if (titleCell) titleCell.s = { font: { bold: true, sz: 13, color: { rgb: "FF6B1A" } } }
    // Header row style (row index 9)
    for (let c = 0; c <= 3; c++) {
      const cell = XLSX.utils.encode_cell({ r: 9, c })
      if (!guide[cell]) continue
      guide[cell].s = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "FF6B1A" } } }
    }

    XLSX.utils.book_append_sheet(wb, guide, "ðŸ“– HÆ°á»›ng dáº«n")
    XLSX.writeFile(wb, "template_menu_giaonhanh.xlsx")
  }

  // â”€â”€ Group handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openNewGroup  = () => { setGModal(blankGroup()); setGEditing(false) }
  const openEditGroup = (g: MenuGroup) => { setGModal({...g}); setGEditing(true) }

  const saveGroup = async () => {
    if (!gModal?.name.trim()) return
    let newGroups: MenuGroup[]
    if (gEditing) {
      newGroups = groups.map(g => g.id === gModal.id ? {...gModal, sortOrder: g.sortOrder} as MenuGroup : g)
      fire("ÄÃ£ lÆ°u nhÃ³m menu")
    } else {
      const newId = gModal.name.trim()
      if (groups.find(g => g.id === newId)) { fire("âŒ NhÃ³m nÃ y Ä‘Ã£ tá»“n táº¡i", false); return }
      newGroups = [...groups, {...gModal, id: newId, sortOrder: groups.length} as MenuGroup]
      fire("ÄÃ£ táº¡o nhÃ³m menu má»›i")
    }
    setGroups(newGroups)
    await persistGroups(newGroups)
    setGModal(null)
  }

  const delGroup = async (id: string) => {
    if (!confirm("XoÃ¡ nhÃ³m nÃ y? CÃ¡c mÃ³n trong nhÃ³m sáº½ khÃ´ng bá»‹ xoÃ¡.")) return
    const newGroups = groups.filter(g => g.id !== id)
    setGroups(newGroups)
    await persistGroups(newGroups)
    setProducts(ps => ps.map(p => p.menuGroupId === id ? {...p, menuGroupId:""} : p))
    fire("ÄÃ£ xoÃ¡ nhÃ³m")
  }

  const moveGroup = (id: string, dir: 1 | -1) => {
    setGroups(gs => {
      const arr = [...gs].sort((a,b) => a.sortOrder - b.sortOrder)
      const i = arr.findIndex(g => g.id === id), j = i + dir
      if (j < 0 || j >= arr.length) return gs
      const tmp = arr[i].sortOrder
      arr[i] = {...arr[i], sortOrder: arr[j].sortOrder}
      arr[j] = {...arr[j], sortOrder: tmp}
      return [...arr]
    })
  }

  // â”€â”€ Product handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openNewProduct  = () => { setPModal(blankProduct()); setPEditing(false) }
  const openEditProduct = (p: Product) => { setPModal({...p}); setPEditing(true) }

  const saveProduct = async () => {
    if (!pModal?.name.trim() || pModal.price <= 0) { fire("âŒ Vui lÃ²ng nháº­p tÃªn mÃ³n vÃ  giÃ¡ bÃ¡n", false); return }
    const category = pModal.menuGroupId || null

    // Upload image if new file selected
    let imageUrl: string | undefined
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg"
      const productId = pEditing ? pModal.id : `new_${Date.now()}`
      const path = `${shopId}/${productId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, imageFile, { upsert: true })
      if (!upErr) {
        imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl
      } else {
        fire("âš ï¸ KhÃ´ng upload Ä‘Æ°á»£c áº£nh (" + upErr.message + "). MÃ³n váº«n Ä‘Æ°á»£c lÆ°u.", false)
      }
    }

    const payload = {
      name: pModal.name, description: pModal.description || null,
      price: pModal.price,
      original_price: pModal.promoEnabled && pModal.promoPrice ? pModal.promoPrice : null,
      category,
      tags: pModal.categories,
      badge: pModal.badge,
      toppings: pModal.toppings,
      sizes: pModal.sizes,
      all_day: pModal.allDay,
      start_hour: pModal.allDay ? null : (pModal.startHour || null),
      end_hour: pModal.allDay ? null : (pModal.endHour || null),
      is_available: pModal.available,
      sort_order: pModal.sortOrder,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }
    if (pEditing) {
      const { error } = await supabase.from("products").update(payload).eq("id", pModal.id)
      if (error) { fire("âŒ Lá»—i cáº­p nháº­t: " + error.message, false); return }
      const updatedPreview = imageUrl ?? pModal.imagePreview
      setProducts(ps => ps.map(p => p.id === pModal.id
        ? {...pModal, imagePreview: updatedPreview, menuGroupId: category ?? ""}
        : p))
      fire("ÄÃ£ cáº­p nháº­t mÃ³n")
    } else {
      if (!shopId) { fire("âŒ KhÃ´ng tÃ¬m tháº¥y cá»­a hÃ ng. Vui lÃ²ng táº£i láº¡i trang.", false); return }
      const { data, error } = await supabase.from("products")
        .insert({ ...payload, shop_id: shopId, sold_count: 0, sort_order: products.length })
        .select("id").single()
      if (error || !data) { fire("âŒ Lá»—i thÃªm mÃ³n: " + (error?.message ?? ""), false); return }
      const newProd: Product = {
        ...pModal, id: data.id, sortOrder: products.length,
        imagePreview: imageUrl ?? pModal.imagePreview,
        menuGroupId: category ?? "",
      }
      setProducts(ps => [...ps, newProd])
      if (category && !groups.find(g => g.id === category)) {
        setGroups(gs => [...gs, { id: category, name: category, allDay: true, startHour: "06:00", endHour: "22:00", sortOrder: gs.length }])
      }
      fire("ÄÃ£ thÃªm mÃ³n má»›i")
    }
    setImageFile(null)
    setPModal(null)
  }

  const delProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id)
    if (error) { fire("âŒ Lá»—i xoÃ¡: " + error.message, false); return }
    setProducts(ps => ps.filter(p => p.id !== id))
    fire("ÄÃ£ xoÃ¡ mÃ³n")
  }

  const toggleAvail = async (id: string) => {
    const p = products.find(x => x.id === id)
    if (!p) return
    const next = !p.available
    const { error } = await supabase.from("products").update({ is_available: next }).eq("id", id)
    if (error) { fire("âŒ Lá»—i cáº­p nháº­t", false); return }
    setProducts(ps => ps.map(x => x.id === id ? {...x, available: next} : x))
  }

  const moveProduct = (id: string, dir: 1 | -1) => {
    setProducts(ps => {
      const arr = [...ps].sort((a,b) => a.sortOrder - b.sortOrder)
      const i = arr.findIndex(p => p.id === id), j = i + dir
      if (j < 0 || j >= arr.length) return ps
      const tmp = arr[i].sortOrder
      arr[i] = {...arr[i], sortOrder: arr[j].sortOrder}
      arr[j] = {...arr[j], sortOrder: tmp}
      return [...arr]
    })
  }

  // â”€â”€ Product form helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toggleCat = (cat: string) => {
    if (!pModal) return
    const has = pModal.categories.includes(cat)
    if (!has && pModal.categories.length >= 3) return
    setPModal({...pModal, categories: has ? pModal.categories.filter(c => c !== cat) : [...pModal.categories, cat]})
  }

  const addTopping    = () => { if (pModal) setPModal({...pModal, toppings:[...pModal.toppings,{id:uid(),name:"",price:0}]}) }
  const removeTopping = (i: number) => { if (pModal) setPModal({...pModal, toppings:pModal.toppings.filter((_,idx)=>idx!==i)}) }
  const setTopping    = (i: number, key:"name"|"price", val:string) => {
    if (!pModal) return
    const t = [...pModal.toppings]
    t[i] = key==="name" ? {...t[i],name:val} : {...t[i],price:parseInt(val)||0}
    setPModal({...pModal, toppings:t})
  }

  const addSize    = () => { if (pModal) setPModal({...pModal, sizes:[...pModal.sizes,{id:uid(),label:"",priceDiff:0}]}) }
  const removeSize = (i: number) => { if (pModal) setPModal({...pModal, sizes:pModal.sizes.filter((_,idx)=>idx!==i)}) }
  const setSize    = (i: number, key:"label"|"priceDiff", val:string) => {
    if (!pModal) return
    const s = [...pModal.sizes]
    s[i] = key==="label" ? {...s[i],label:val} : {...s[i],priceDiff:parseInt(val)||0}
    setPModal({...pModal, sizes:s})
  }

  const onImageFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setImageFile(file)
    setPModal(m => m ? {...m, imagePreview:url} : m)
  }

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sortedGroups   = [...groups].sort((a,b) => a.sortOrder - b.sortOrder)
  const filteredProds  = products
    .filter(p => filterGid === "all" ? true : p.menuGroupId === filterGid)
    .sort((a,b) => a.sortOrder - b.sortOrder)
  const badgeCfg = (b: Product["badge"]) => BADGE_LIST.find(x => x.key === b)

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) return (
    <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
      <div style={{ fontSize:32 }}>ðŸ½ï¸</div>
      <div style={{ color:"#6a5a40",fontSize:12 }}>Äang táº£i menu...</div>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        input,select,textarea{outline:none;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{display:none}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}
            style={{position:"fixed",top:"calc(env(safe-area-inset-top) + 64px)",left:"50%",transform:"translateX(-50%)",zIndex:999,whiteSpace:"nowrap",
              background: toastOk ? "rgba(62,207,110,0.15)" : "rgba(255,64,64,0.15)",
              border: toastOk ? "1px solid rgba(62,207,110,0.35)" : "1px solid rgba(255,64,64,0.35)",
              borderRadius:12,padding:"7px 18px",
              color: toastOk ? "#3ecf6e" : "#ff4040",
              fontSize:11,fontWeight:600,backdropFilter:"blur(10px)"}}>
            {toastOk ? "âœ“" : "âœ•"} {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e => { const f = e.target.files?.[0]; if (f) onImageFile(f); e.target.value="" }} />
      <input ref={csvRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}}
        onChange={e => { const f = e.target.files?.[0]; if (f) onCSVFile(f); e.target.value="" }} />

      {/* â”€â”€ LAYOUT â”€â”€ */}
      <div style={{position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"calc(env(safe-area-inset-top) + 12px) 16px 0",background:"rgba(8,8,6,0.98)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <a href="/merchant" style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16,flexShrink:0}}>â†</a>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#f8f0e0",fontSize:16,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Quáº£n lÃ½ Menu</div>
              <div style={{color:"#6a5a40",fontSize:9}}>{products.length} mÃ³n Â· {groups.length} nhÃ³m Â· {products.filter(p=>p.available).length} Ä‘ang bÃ¡n</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginBottom:10}}>
            {mainTab === "products" && (<>
              <button onClick={downloadTemplate}
                style={{background:"rgba(74,143,245,0.1)",border:"1px solid rgba(74,143,245,0.3)",borderRadius:10,padding:"7px 12px",color:"#4a8ff5",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>
                ðŸ“„ Táº£i file máº«u
              </button>
              <button onClick={() => csvRef.current?.click()}
                style={{background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",borderRadius:10,padding:"7px 12px",color:"#3ecf6e",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>
                ðŸ“¥ Nháº­p Excel
              </button>
            </>)}
            <button onClick={mainTab==="groups" ? openNewGroup : openNewProduct}
              style={{background:"linear-gradient(90deg,#FF6B00,#FF8C00)",border:"none",borderRadius:10,padding:"7px 14px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 2px 12px rgba(255,107,0,0.4)",whiteSpace:"nowrap"}}>
              + {mainTab==="groups" ? "NhÃ³m má»›i" : "ThÃªm mÃ³n"}
            </button>
          </div>

          {/* Main tab switcher */}
          <div style={{display:"flex",gap:0}}>
            {([["products","ðŸ½ï¸ Danh sÃ¡ch mÃ³n"],["groups","ðŸ“‹ NhÃ³m menu"]] as const).map(([k,l]) => (
              <button key={k} onClick={() => setMainTab(k)}
                style={{flex:1,height:38,border:"none",background:"transparent",
                  borderBottom:`2px solid ${mainTab===k?"#FF6B00":"transparent"}`,
                  color:mainTab===k?"#FF8C00":"#6a5a40",fontSize:11,fontWeight:mainTab===k?700:400,cursor:"pointer",fontFamily:"Lexend",transition:"all .2s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* â•â• TAB: Danh sÃ¡ch mÃ³n â•â• */}
        {mainTab === "products" && (
          <>
            {/* Filter chips */}
            <div style={{display:"flex",gap:6,padding:"10px 16px",overflowX:"auto",flexShrink:0} as React.CSSProperties}>
              {[{id:"all",name:"Táº¥t cáº£"}, ...sortedGroups].map(g => (
                <button key={g.id} onClick={() => setFilterGid(g.id)}
                  style={{flexShrink:0,padding:"5px 14px",borderRadius:20,
                    background:filterGid===g.id?"rgba(255,107,0,0.12)":"rgba(255,255,255,0.04)",
                    border:filterGid===g.id?"1px solid rgba(255,107,0,0.35)":"1px solid rgba(255,255,255,0.06)",
                    color:filterGid===g.id?"#FF8C00":"#6a5a40",fontSize:10,fontWeight:filterGid===g.id?700:400,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>
                  {g.name}
                </button>
              ))}
            </div>

            {/* Product list */}
            <div style={{flex:1,overflowY:"auto",padding:"4px 16px 24px"}}>
              {filteredProds.length === 0 ? (
                <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:36,marginBottom:8}}>ðŸ½ï¸</div>
                  <div style={{color:"#6a5a40",fontSize:12,marginBottom:12}}>ChÆ°a cÃ³ mÃ³n nÃ o trong nhÃ³m nÃ y</div>
                  <button onClick={openNewProduct}
                    style={{background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:10,padding:"8px 18px",color:"#FF8C00",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
                    + ThÃªm mÃ³n Ä‘áº§u tiÃªn
                  </button>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
                  <SortableContext items={filteredProds.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {filteredProds.map(p => (
                      <SortableProductCard key={p.id} p={p} groups={groups}
                        onEdit={openEditProduct} onToggle={toggleAvail} onDelete={delProduct} />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </>
        )}

        {/* â•â• TAB: NhÃ³m menu â•â• */}
        {mainTab === "groups" && (
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px 24px"}}>
            {sortedGroups.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 0"}}>
                <div style={{fontSize:36,marginBottom:8}}>ðŸ“‹</div>
                <div style={{color:"#6a5a40",fontSize:12,marginBottom:12}}>ChÆ°a cÃ³ nhÃ³m menu nÃ o</div>
                <button onClick={openNewGroup}
                  style={{background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:10,padding:"8px 18px",color:"#FF8C00",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
                  + Táº¡o nhÃ³m Ä‘áº§u tiÃªn
                </button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                <SortableContext items={sortedGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {sortedGroups.map(g => (
                    <SortableGroupCard key={g.id} g={g}
                      productCount={products.filter(p => p.menuGroupId === g.id).length}
                      onEdit={openEditGroup} onDelete={delGroup} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </div>

      {/* â•â• MODAL: Import CSV â•â• */}
      <AnimatePresence>
        {(importRows !== null || importError) && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => { setImportRows(null); setImportError("") }}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:70,backdropFilter:"blur(5px)"}} />
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:24,stiffness:280}}
              style={{position:"fixed",bottom:0,left:0,right:0,zIndex:71,background:"#0e0c09",border:"1px solid rgba(62,207,110,0.2)",borderRadius:"22px 22px 0 0",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>

              <div style={{padding:"14px 18px 10px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{width:36,height:4,background:"rgba(255,255,255,0.12)",borderRadius:2,margin:"0 auto 12px"}} />
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{color:"#f8f0e0",fontSize:14,fontWeight:800}}>ðŸ“¥ Nháº­p sáº£n pháº©m tá»« file</div>
                    {importRows && <div style={{color:"#6a5a40",fontSize:9,marginTop:2}}>Xem trÆ°á»›c {importRows.length} sáº£n pháº©m Â· XÃ¡c nháº­n Ä‘á»ƒ thÃªm vÃ o menu</div>}
                  </div>
                  <button onClick={() => { setImportRows(null); setImportError("") }}
                    style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer"}}>Ã—</button>
                </div>
              </div>

              {importError ? (
                <div style={{padding:"24px 18px",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:8}}>âš ï¸</div>
                  <div style={{color:"#ff4040",fontSize:12,fontWeight:700,marginBottom:6}}>Lá»—i Ä‘á»c file</div>
                  <div style={{color:"rgba(255,100,100,0.7)",fontSize:10}}>{importError}</div>
                  <button onClick={downloadTemplate} style={{marginTop:16,background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",borderRadius:10,padding:"8px 16px",color:"#3ecf6e",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
                    ðŸ“‹ Táº£i file máº«u (.csv)
                  </button>
                </div>
              ) : importRows && (
                <>
                  {/* Format hint */}
                  <div style={{margin:"10px 18px 0",background:"rgba(74,143,245,0.06)",border:"1px solid rgba(74,143,245,0.18)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
                    <div style={{color:"#4a8ff5",fontSize:9,fontWeight:700,marginBottom:3}}>ðŸ“‹ Äá»‹nh dáº¡ng cá»™t CSV</div>
                    <div style={{color:"rgba(74,143,245,0.7)",fontSize:8,lineHeight:1.6}}>
                      <strong>TÃªn mÃ³n</strong> Â· MÃ´ táº£ Â· GiÃ¡ bÃ¡n Â· GiÃ¡ KM (tuá»³ chá»n) Â· Danh má»¥c Â· Badge (hot/bigsale/bestseller)
                    </div>
                    <button onClick={downloadTemplate} style={{marginTop:5,background:"transparent",border:"none",color:"#4a8ff5",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",textDecoration:"underline",padding:0}}>
                      Táº£i file máº«u
                    </button>
                  </div>

                  {/* Preview table */}
                  <div style={{flex:1,overflowY:"auto",padding:"10px 18px"}}>
                    {/* Table header */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",gap:6,padding:"6px 8px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:6}}>
                      {["TÃªn mÃ³n","GiÃ¡","KM","Danh má»¥c"].map(h => (
                        <div key={h} style={{color:"rgba(255,255,255,0.3)",fontSize:7.5,fontWeight:700,textTransform:"uppercase"}}>{h}</div>
                      ))}
                    </div>
                    {importRows.map((r, i) => (
                      <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",gap:6,padding:"7px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)",alignItems:"center"}}>
                        <div>
                          <div style={{color:"#f8f0e0",fontSize:10,fontWeight:600}}>{r.name}</div>
                          {r.description && <div style={{color:"#6a5a40",fontSize:8,marginTop:1}}>{r.description}</div>}
                          {r.badge && (
                            <span style={{background:r.badge==="hot"?"rgba(255,64,64,0.15)":r.badge==="bigsale"?"rgba(255,215,0,0.12)":"rgba(62,207,110,0.12)",borderRadius:4,padding:"1px 5px",fontSize:7,fontWeight:700,color:r.badge==="hot"?"#ff4040":r.badge==="bigsale"?"#FFD700":"#3ecf6e",marginTop:2,display:"inline-block"}}>
                              {r.badge==="hot"?"ðŸ”¥ HOT":r.badge==="bigsale"?"ðŸ’¸ BIG SALE":"ðŸ“ˆ BÃN CHáº Y"}
                            </span>
                          )}
                        </div>
                        <div style={{color:"#FF8C00",fontSize:10,fontWeight:700}}>{r.price.toLocaleString("vi-VN")}Ä‘</div>
                        <div style={{color:r.promoPrice?"#ff4040":"rgba(255,255,255,0.2)",fontSize:10}}>{r.promoPrice ? r.promoPrice.toLocaleString("vi-VN")+"Ä‘" : "â€”"}</div>
                        <div style={{color:"#6a5a40",fontSize:9}}>{r.category || "â€”"}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{padding:"12px 18px 28px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:8}}>
                    <button onClick={() => { setImportRows(null); setImportError("") }}
                      style={{flex:1,height:44,borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6a5a40",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Lexend"}}>
                      Há»§y
                    </button>
                    <button onClick={confirmImport} disabled={importSaving}
                      style={{flex:2,height:44,borderRadius:12,border:"none",background:"linear-gradient(90deg,#3ecf6e,#2bba5e)",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 3px 16px rgba(62,207,110,0.35)",opacity:importSaving?0.7:1}}>
                      {importSaving ? `â³ Äang lÆ°u... (${importRows.length} mÃ³n)` : `âœ… Nháº­p ${importRows.length} sáº£n pháº©m`}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* â•â• MODAL: Táº¡o / Sá»­a nhÃ³m â•â• */}
      <AnimatePresence>
        {gModal && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setGModal(null)}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,backdropFilter:"blur(4px)"}} />
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:24,stiffness:300}}
              style={{position:"fixed",bottom:0,left:0,right:0,background:"#0e0c09",borderRadius:"22px 22px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"18px 18px 36px",zIndex:51}}>
              <div style={{width:36,height:4,background:"rgba(255,255,255,0.12)",borderRadius:2,margin:"0 auto 16px"}} />
              <div style={{color:"#f8f0e0",fontSize:14,fontWeight:800,marginBottom:16}}>
                {gEditing ? "âœï¸ Chá»‰nh sá»­a nhÃ³m" : "ðŸ“‹ Táº¡o nhÃ³m menu má»›i"}
              </div>

              <FLabel>TÃªn nhÃ³m *</FLabel>
              <FInput value={gModal.name} onChange={v => setGModal(m => m ? {...m,name:v} : m)} placeholder="VD: BÃºn, Äá»“ uá»‘ng, MÃ³n thÃªm..." />

              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Toggle on={gModal.allDay} onToggle={() => setGModal(m => m ? {...m,allDay:!m.allDay} : m)} />
                <span style={{color:"#b0956a",fontSize:11}}>Phá»¥c vá»¥ cáº£ ngÃ y</span>
              </div>

              {!gModal.allDay && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <div>
                    <FLabel>Báº¯t Ä‘áº§u</FLabel>
                    <input type="time" value={gModal.startHour} onChange={e => setGModal(m => m ? {...m,startHour:e.target.value} : m)}
                      style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:12,padding:"0 10px",colorScheme:"dark"} as React.CSSProperties} />
                  </div>
                  <div>
                    <FLabel>Káº¿t thÃºc</FLabel>
                    <input type="time" value={gModal.endHour} onChange={e => setGModal(m => m ? {...m,endHour:e.target.value} : m)}
                      style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:12,padding:"0 10px",colorScheme:"dark"} as React.CSSProperties} />
                  </div>
                </div>
              )}

              <button onClick={saveGroup} disabled={!gModal.name.trim()}
                style={{width:"100%",height:46,borderRadius:12,border:"none",background:"linear-gradient(90deg,#FF6B00,#FF8C00)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 3px 16px rgba(255,107,0,0.4)",opacity:!gModal.name.trim()?0.5:1,position:"relative",overflow:"hidden"}}>
                <ShimmerBar />
                <span style={{position:"relative",zIndex:1}}>{gEditing ? "ðŸ’¾ LÆ°u thay Ä‘á»•i" : "âœ… Táº¡o nhÃ³m"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* â•â• SHEET: ThÃªm / Sá»­a mÃ³n â•â• */}
      <AnimatePresence>
        {pModal && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => { setPModal(null); setImageFile(null) }}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:60,backdropFilter:"blur(4px)"}} />
            <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:24,stiffness:280}}
              style={{position:"fixed",bottom:0,left:0,right:0,zIndex:61,background:"#0e0c09",border:"1px solid rgba(255,107,0,0.2)",borderRadius:"22px 22px 0 0",maxHeight:"95vh",display:"flex",flexDirection:"column"}}>

              {/* Sheet header */}
              <div style={{padding:"14px 18px 10px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{width:36,height:4,background:"rgba(255,255,255,0.12)",borderRadius:2,margin:"0 auto 12px"}} />
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{color:"#f8f0e0",fontSize:14,fontWeight:800}}>{pEditing ? "âœï¸ Chá»‰nh sá»­a mÃ³n" : "ðŸ½ï¸ ThÃªm mÃ³n má»›i"}</div>
                  <button onClick={() => { setPModal(null); setImageFile(null) }}
                    style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer"}}>Ã—</button>
                </div>
              </div>

              {/* Scrollable form */}
              <div style={{flex:1,overflowY:"auto",padding:"14px 18px 8px"}}>

                {/* â”€ áº¢nh + TÃªn â”€ */}
                <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
                  <div onClick={() => fileRef.current?.click()}
                    style={{width:90,height:90,borderRadius:16,flexShrink:0,background:"rgba(255,107,0,0.06)",border:"2px dashed rgba(255,107,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",position:"relative"}}>
                    {pModal.imagePreview
                      ? <>
                          <img src={pModal.imagePreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{color:"#fff",fontSize:10,fontWeight:700}}>Äá»•i áº£nh</span>
                          </div>
                        </>
                      : <div style={{textAlign:"center"}}>
                          <div style={{fontSize:26,marginBottom:2}}>ðŸ“·</div>
                          <div style={{color:"#6a5a40",fontSize:8}}>Táº£i áº£nh lÃªn</div>
                        </div>
                    }
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <FLabel>TÃªn mÃ³n *</FLabel>
                    <FInput value={pModal.name} onChange={v => setPModal(m => m ? {...m,name:v} : m)} placeholder="VD: BÃºn bÃ² Ä‘áº·c biá»‡t" />
                    <FLabel>MÃ´ táº£ ngáº¯n</FLabel>
                    <FInput value={pModal.description} onChange={v => setPModal(m => m ? {...m,description:v} : m)} placeholder="Tuá»³ chá»n..." />
                  </div>
                </div>

                {/* â”€ GiÃ¡ & NhÃ³m â”€ */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <FLabel>GiÃ¡ bÃ¡n *</FLabel>
                    <FInput value={pModal.price > 0 ? String(pModal.price) : ""} type="number"
                      onChange={v => setPModal(m => m ? {...m,price:parseInt(v)||0} : m)} placeholder="VD: 45000" />
                  </div>
                  <div>
                    <FLabel>NhÃ³m menu ná»™i bá»™</FLabel>
                    <select value={pModal.menuGroupId} onChange={e => setPModal(m => m ? {...m,menuGroupId:e.target.value} : m)}
                      style={{width:"100%",height:42,borderRadius:11,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:pModal.menuGroupId?"#f8f0e0":"#6a5a40",fontSize:11,padding:"0 10px",marginBottom:10,colorScheme:"dark",fontFamily:"Lexend"} as React.CSSProperties}>
                      <option value="" style={{background:"#0e0c09"}}>-- KhÃ´ng chá»n --</option>
                      {groups.map(g => <option key={g.id} value={g.id} style={{background:"#0e0c09"}}>{g.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* â”€ Giá» bÃ¡n â”€ */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                  <Toggle on={pModal.allDay} onToggle={() => setPModal(m => m ? {...m,allDay:!m.allDay} : m)} />
                  <span style={{color:"#b0956a",fontSize:11}}>BÃ¡n cáº£ ngÃ y</span>
                  {!pModal.allDay && (
                    <div style={{display:"flex",gap:6,alignItems:"center",flex:1,minWidth:160}}>
                      <input type="time" value={pModal.startHour} onChange={e => setPModal(m => m ? {...m,startHour:e.target.value} : m)}
                        style={{flex:1,height:34,borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                      <span style={{color:"#6a5a40",fontSize:11}}>â€“</span>
                      <input type="time" value={pModal.endHour} onChange={e => setPModal(m => m ? {...m,endHour:e.target.value} : m)}
                        style={{flex:1,height:34,borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                    </div>
                  )}
                </div>

                {/* â”€ Danh má»¥c trang chá»§ (hiá»ƒn thá»‹ á»Ÿ má»¥c duyá»‡t theo danh má»¥c ngoÃ i trang chá»§, tá»‘i Ä‘a 3) â”€ */}
                <div style={{marginBottom:14}}>
                  <FLabel>
                    ðŸ·ï¸ Danh má»¥c trang chá»§
                    <span style={{color:"#6a5a40"}}> Â· chá»n 1â€“3 Â· Ä‘Ã£ chá»n {pModal.categories.length}/3</span>
                  </FLabel>
                  <div style={{background:"rgba(74,143,245,0.05)",border:"1px solid rgba(74,143,245,0.15)",borderRadius:10,padding:"7px 10px",marginBottom:8}}>
                    <div style={{color:"#4a8ff5",fontSize:8.5,lineHeight:1.6}}>
                      Danh má»¥c giÃºp khÃ¡ch tÃ¬m mÃ³n theo loáº¡i <strong>ngoÃ i trang chá»§</strong> â€” khÃ¡c vá»›i NhÃ³m menu chá»‰ hiá»ƒn thá»‹ bÃªn trong cá»­a hÃ ng.
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {CATEGORY_LIST.map(c => {
                      const on       = pModal.categories.includes(c)
                      const disabled = !on && pModal.categories.length >= 3
                      return (
                        <button key={c} onClick={() => toggleCat(c)} disabled={disabled}
                          style={{padding:"5px 11px",borderRadius:20,
                            background:on?"rgba(255,107,0,0.14)":"rgba(255,255,255,0.04)",
                            border:on?"1px solid rgba(255,107,0,0.4)":"1px solid rgba(255,255,255,0.07)",
                            color:on?"#FF8C00":disabled?"rgba(106,90,64,0.4)":"#6a5a40",
                            fontSize:10,fontWeight:on?700:400,cursor:disabled?"not-allowed":"pointer",fontFamily:"Lexend",opacity:disabled?0.5:1}}>
                          {on && "âœ“ "}{c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* â”€ Badge / Ghim â”€ */}
                <div style={{marginBottom:14}}>
                  <FLabel>Ghim / Badge ná»•i báº­t</FLabel>
                  <div style={{display:"flex",gap:6}}>
                    {BADGE_LIST.map(b => {
                      const on = pModal.badge === b.key
                      return (
                        <button key={b.key} onClick={() => setPModal(m => m ? {...m,badge:on?null:b.key} : m)}
                          style={{flex:1,height:36,borderRadius:9,
                            background:on?b.bg:"rgba(255,255,255,0.04)",
                            border:`1px solid ${on?b.border:"rgba(255,255,255,0.07)"}`,
                            color:on?b.color:"#6a5a40",fontSize:9,fontWeight:on?700:400,cursor:"pointer",fontFamily:"Lexend"}}>
                          {b.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* â”€ Size â”€ */}
                <SectionBox label="Size" color="#3ecf6e" onAdd={addSize} addLabel="+ ThÃªm size">
                  {pModal.sizes.map((s, i) => (
                    <div key={s.id} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                      <input value={s.label} onChange={e => setSize(i,"label",e.target.value)} placeholder="TÃªn size (S/M/L...)"
                        style={{flex:1,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <input value={s.priceDiff > 0 ? String(s.priceDiff) : ""} type="number"
                        onChange={e => setSize(i,"priceDiff",e.target.value)} placeholder="+giÃ¡ (Ä‘)"
                        style={{width:90,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <button onClick={() => removeSize(i)}
                        style={{width:30,height:30,borderRadius:7,background:"rgba(255,64,64,0.07)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:14,cursor:"pointer"}}>Ã—</button>
                    </div>
                  ))}
                </SectionBox>

                {/* â”€ Topping â”€ */}
                <SectionBox label="Topping" color="#b464ff" onAdd={addTopping} addLabel="+ ThÃªm topping">
                  {pModal.toppings.map((t, i) => (
                    <div key={t.id} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                      <input value={t.name} onChange={e => setTopping(i,"name",e.target.value)} placeholder="TÃªn topping"
                        style={{flex:1,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <input value={t.price > 0 ? String(t.price) : ""} type="number"
                        onChange={e => setTopping(i,"price",e.target.value)} placeholder="GiÃ¡ thÃªm (Ä‘)"
                        style={{width:90,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <button onClick={() => removeTopping(i)}
                        style={{width:30,height:30,borderRadius:7,background:"rgba(255,64,64,0.07)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:14,cursor:"pointer"}}>Ã—</button>
                    </div>
                  ))}
                </SectionBox>

                {/* â”€ Khuyáº¿n mÃ£i â”€ */}
                <div style={{background:"rgba(255,64,64,0.04)",border:"1px solid rgba(255,64,64,0.12)",borderRadius:14,padding:12,marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:pModal.promoEnabled?14:0}}>
                    <Toggle on={pModal.promoEnabled} onToggle={() => setPModal(m => m ? {...m,promoEnabled:!m.promoEnabled} : m)} activeColor="#ff4040" activeBg="rgba(255,64,64,0.2)" activeBorder="rgba(255,64,64,0.4)" />
                    <span style={{color:pModal.promoEnabled?"#ff4040":"#6a5a40",fontSize:11,fontWeight:pModal.promoEnabled?700:400}}>ðŸ”¥ Báº­t khuyáº¿n mÃ£i cho mÃ³n nÃ y</span>
                  </div>

                  {pModal.promoEnabled && (
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <div>
                          <FLabel>GiÃ¡ khuyáº¿n mÃ£i *</FLabel>
                          <FInput value={pModal.promoPrice ? String(pModal.promoPrice) : ""} type="number"
                            onChange={v => setPModal(m => m ? {...m,promoPrice:parseInt(v)||null} : m)} placeholder="VD: 35000" />
                        </div>
                        <div>
                          <FLabel>Giá»›i háº¡n / ngÆ°á»i</FLabel>
                          <FInput value={pModal.promoPerPerson ? String(pModal.promoPerPerson) : ""} type="number"
                            onChange={v => setPModal(m => m ? {...m,promoPerPerson:parseInt(v)||null} : m)} placeholder="VD: 2 láº§n" />
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <FLabel>Tá»« ngÃ y</FLabel>
                          <input type="datetime-local" value={pModal.promoStart}
                            onChange={e => setPModal(m => m ? {...m,promoStart:e.target.value} : m)}
                            style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:10,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                        </div>
                        <div>
                          <FLabel>Äáº¿n ngÃ y</FLabel>
                          <input type="datetime-local" value={pModal.promoEnd}
                            onChange={e => setPModal(m => m ? {...m,promoEnd:e.target.value} : m)}
                            style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:10,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Save button */}
              <div style={{padding:"10px 18px 32px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                <button onClick={saveProduct} disabled={!pModal.name.trim() || pModal.price <= 0}
                  style={{width:"100%",height:48,borderRadius:13,border:"none",background:"linear-gradient(90deg,#FF6B00,#FF8C00,#FFB347)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 4px 20px rgba(255,107,0,0.4)",position:"relative",overflow:"hidden",opacity:!pModal.name.trim()||pModal.price<=0?0.5:1}}>
                  <ShimmerBar />
                  <span style={{position:"relative",zIndex:1}}>{pEditing ? "ðŸ’¾ LÆ°u thay Ä‘á»•i" : "âœ… ThÃªm vÃ o menu"}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// â”€â”€ Helper components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FLabel({ children }: { children: React.ReactNode }) {
  return <div style={{color:"rgba(176,149,106,0.75)",fontSize:9.5,marginBottom:5}}>{children}</div>
}

function FInput({ value, onChange, placeholder, type="text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${focused?"rgba(255,107,0,0.45)":"rgba(255,255,255,0.08)"}`,borderRadius:11,padding:"0 12px",height:42,marginBottom:10,transition:"all .2s",boxShadow:focused?"0 0 0 3px rgba(255,107,0,0.09)":"none",display:"flex",alignItems:"center"}}>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{flex:1,background:"transparent",border:"none",color:"#f8f0e0",fontSize:12}} />
    </div>
  )
}

function Toggle({ on, onToggle, activeColor="#FF8C00", activeBg="rgba(255,107,0,0.2)", activeBorder="rgba(255,107,0,0.4)" }: {
  on: boolean; onToggle: () => void; activeColor?: string; activeBg?: string; activeBorder?: string
}) {
  return (
    <button onClick={onToggle}
      style={{width:42,height:24,borderRadius:12,background:on?activeBg:"rgba(255,255,255,0.06)",border:`1px solid ${on?activeBorder:"rgba(255,255,255,0.1)"}`,display:"flex",alignItems:"center",padding:"3px 4px",cursor:"pointer",justifyContent:on?"flex-end":"flex-start",flexShrink:0,transition:"all .2s"}}>
      <div style={{width:16,height:16,borderRadius:"50%",background:on?activeColor:"#6a5a40",transition:"background .2s"}} />
    </button>
  )
}

function SectionBox({ label, color, onAdd, addLabel, children }: {
  label: string; color: string; onAdd: () => void; addLabel: string; children: React.ReactNode
}) {
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:12,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{color,fontSize:10,fontWeight:700}}>{label}</span>
        <button onClick={onAdd}
          style={{background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.2)",borderRadius:8,padding:"3px 10px",color:"#FF8C00",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
          {addLabel}
        </button>
      </div>
      {children}
    </div>
  )
}

function ShimmerBar() {
  return <div style={{position:"absolute",top:0,left:"-60%",width:"35%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",animation:"shimmer 2.5s infinite"}} />
}

