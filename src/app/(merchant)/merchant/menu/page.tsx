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

// ── Types ──────────────────────────────────────────────────────────────────
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
  badge: "hot" | "bigsale" | "bestseller" | null
  available: boolean; soldCount: number; sortOrder: number
}

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORY_LIST = [
  "Buổi sáng","Buổi trưa","Buổi tối",
  "Đồ uống","Đồ nhậu","Ăn vặt","Khác",
]
const BADGE_LIST = [
  { key:"hot"        as const, label:"🔥 HOT",      color:"#ff4040", bg:"rgba(255,64,64,0.15)",    border:"rgba(255,64,64,0.4)"    },
  { key:"bigsale"    as const, label:"💸 BIG SALE", color:"#FFD700", bg:"rgba(255,215,0,0.12)",    border:"rgba(255,215,0,0.4)"    },
  { key:"bestseller" as const, label:"📈 BÁN CHẠY", color:"#3ecf6e", bg:"rgba(62,207,110,0.12)",  border:"rgba(62,207,110,0.4)"   },
]
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ"
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`

// ── Blank templates ────────────────────────────────────────────────────────
const blankGroup  = (): Omit<MenuGroup,"sortOrder"> => ({ id:uid(), name:"", allDay:true, startHour:"06:00", endHour:"22:00" })
const blankProduct = (): Product => ({
  id:uid(), name:"", description:"", imagePreview:null,
  price:0, categories:[], menuGroupId:"",
  allDay:true, startHour:"06:00", endHour:"22:00",
  toppings:[], sizes:[],
  promoEnabled:false, promoPrice:null, promoStart:"", promoEnd:"", promoPerPerson:null,
  badge:null, available:true, soldCount:0, sortOrder:0,
})

// (no hardcoded sample data — loaded from Supabase)

// ── CSV Import types ───────────────────────────────────────────────────────
interface ImportRow { name: string; description: string; price: number; promoPrice: number | null; category: string; badge: Product["badge"] }

// ── Drag-and-drop product card ─────────────────────────────────────────────
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
          color:"#3a2a15", fontSize:14, display:"flex", alignItems:"center", padding:"0 2px", userSelect:"none" as React.CSSProperties["userSelect"] }}>⠿</div>
      {/* Image */}
      <div style={{width:54,height:54,borderRadius:12,flexShrink:0,background:"rgba(255,107,0,0.07)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,overflow:"hidden",position:"relative"}}>
        {p.imagePreview ? <img src={p.imagePreview} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span>🍽️</span>}
        {bc && <div style={{position:"absolute",top:2,left:2,background:bc.bg,border:`1px solid ${bc.border}`,borderRadius:4,padding:"1px 4px",fontSize:7,fontWeight:800,color:bc.color,lineHeight:1.3}}>{bc.label.split(" ")[0]}</div>}
      </div>
      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}>
          <div style={{color:"#f8f0e0",fontSize:11,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1,minWidth:0}}>{p.name}</div>
          {!p.available && <span style={{background:"rgba(255,64,64,0.1)",border:"1px solid rgba(255,64,64,0.2)",borderRadius:4,padding:"1px 5px",color:"#ff4040",fontSize:7,fontWeight:700,flexShrink:0}}>ẨN</span>}
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
        <button onClick={() => onEdit(p)} style={{width:34,height:28,borderRadius:8,background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.2)",color:"#FF8C00",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
        <button onClick={() => onToggle(p.id)} style={{width:34,height:28,borderRadius:8,background:p.available?"rgba(62,207,110,0.08)":"rgba(255,255,255,0.04)",border:p.available?"1px solid rgba(62,207,110,0.25)":"1px solid rgba(255,255,255,0.06)",color:p.available?"#3ecf6e":"#6a5a40",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
          {p.available?"👁":"🙈"}
        </button>
        <button onClick={() => onDelete(p.id)} style={{width:34,height:28,borderRadius:8,background:"rgba(255,64,64,0.06)",border:"1px solid rgba(255,64,64,0.15)",color:"#ff4040",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
      </div>
    </div>
  )
}

// ── Drag-and-drop group card ────────────────────────────────────────────────
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
          color:"#3a2a15", fontSize:14, display:"flex", alignItems:"center", padding:"0 2px", userSelect:"none" as React.CSSProperties["userSelect"] }}>⠿</div>
      <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📋</div>
      <div style={{flex:1}}>
        <div style={{color:"#f8f0e0",fontSize:12,fontWeight:700}}>{g.name}</div>
        <div style={{color:"#6a5a40",fontSize:9,marginTop:2}}>{productCount} món · {g.allDay?"Cả ngày":`${g.startHour} – ${g.endHour}`}</div>
      </div>
      <button onClick={() => onEdit(g)} style={{width:34,height:34,borderRadius:9,background:"rgba(255,107,0,0.08)",border:"1px solid rgba(255,107,0,0.2)",color:"#FF8C00",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
      <button onClick={() => onDelete(g.id)} style={{width:34,height:34,borderRadius:9,background:"rgba(255,64,64,0.06)",border:"1px solid rgba(255,64,64,0.15)",color:"#ff4040",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
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

  // ── Drag-and-drop sensors & handlers ──────────────────────────────────────
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

  // ── Load from Supabase ─────────────────────────────────────────────────
  const loadProducts = useCallback(async (sid: string): Promise<Product[]> => {
    const { data } = await supabase
      .from("products")
      .select("id,name,description,price,original_price,category,is_available,sold_count,sort_order,image_url")
      .eq("shop_id", sid)
      .order("sort_order", { ascending: true })

    const mapped: Product[] = (data ?? []).map(p => ({
      id: p.id, name: p.name, description: p.description ?? "", imagePreview: p.image_url ?? null,
      price: p.price, categories: p.category ? [p.category] : [], menuGroupId: p.category ?? "",
      allDay: true, startHour: "", endHour: "", toppings: [], sizes: [],
      promoEnabled: !!(p.original_price && p.original_price < p.price),
      promoPrice: p.original_price ?? null, promoStart: "", promoEnd: "", promoPerPerson: null,
      badge: null, available: p.is_available, soldCount: p.sold_count, sortOrder: p.sort_order,
    }))
    setProducts(mapped)
    return mapped
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: shop } = await supabase
        .from("shops").select("id, menu_groups_data").eq("owner_id", user.id).single()
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

  // ── CSV helpers ────────────────────────────────────────────────────────
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
    const rows: ImportRow[] = []
    const start = lines[0]?.toLowerCase().includes("tên") || lines[0]?.toLowerCase().includes("name") ? 1 : 0
    for (let i = start; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i])
      if (!cols[0]) continue
      const price = parseInt(cols[2]?.replace(/\D/g, "") || "0") || 0
      const promoPrice = cols[3] ? (parseInt(cols[3].replace(/\D/g, "")) || null) : null
      const badgeRaw = (cols[5] ?? "").toLowerCase()
      const badge: Product["badge"] = badgeRaw === "hot" ? "hot" : badgeRaw === "bigsale" ? "bigsale" : badgeRaw === "bestseller" ? "bestseller" : null
      rows.push({ name: cols[0], description: cols[1] ?? "", price, promoPrice, category: cols[4] ?? "", badge })
    }
    return rows
  }

  const onCSVFile = (file: File) => {
    setImportError("")
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) { setImportError("File trống hoặc không đúng định dạng"); return }
      setImportRows(rows)
    }
    reader.readAsText(file, "utf-8")
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
        category, is_available: true, sold_count: 0,
        sort_order: products.length + saved.length,
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
    fire(`✅ Đã lưu ${saved.length}/${importRows.length} sản phẩm vào Supabase`)
  }

  const downloadTemplate = () => {
    const headers = ["Tên món *", "Mô tả", "Giá bán * (VNĐ)", "Giá khuyến mãi (VNĐ)", "Danh mục", "Badge"]
    const samples = [
      ["Bún bò đặc biệt", "Thịt bò tươi + bún thơm + rau sống", 45000, 38000, "Bún / Phở", "bestseller"],
      ["Cơm gà xối mỡ",  "Cơm trắng + gà giòn xối mỡ + rau",  42000, "",     "Cơm",       "hot"],
      ["Trà đá",          "Trà đậm đà mát lạnh",                5000,  "",     "Đồ uống",   ""],
      ["Nước cam tươi",   "Cam vắt tươi không đường",           25000, "",     "Đồ uống",   ""],
      ["Bánh mì thịt",    "Bánh mì giòn + thịt nguội + pate",   18000, 15000,  "Bánh",      "bigsale"],
      ["Gà rán cay",      "2 miếng gà rán sốt cay Hàn Quốc",   55000, "",     "Gà",        ""],
      ["Cơm sườn bì chả", "Cơm + sườn nướng + bì + chả lụa",   40000, "",     "Cơm",       "bestseller"],
      ["Sinh tố bơ",      "Bơ tươi béo ngậy không đường",       30000, "",     "Đồ uống",   "hot"],
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...samples])

    // Độ rộng cột
    ws["!cols"] = [
      { wch: 28 }, // Tên món
      { wch: 36 }, // Mô tả
      { wch: 18 }, // Giá bán
      { wch: 20 }, // Giá KM
      { wch: 16 }, // Danh mục
      { wch: 14 }, // Badge
    ]

    // Style dòng tiêu đề (in đậm nền cam)
    const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1:F1")
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r: 0, c })
      if (!ws[cell]) continue
      ws[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "FF6B00" } },
        alignment: { horizontal: "center" },
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Menu mẫu")

    // Sheet hướng dẫn
    const guide = XLSX.utils.aoa_to_sheet([
      ["HƯỚNG DẪN NHẬP MENU"],
      [""],
      ["Cột", "Bắt buộc", "Mô tả"],
      ["Tên món *",              "Có",  "Tên hiển thị của món ăn"],
      ["Mô tả",                  "Không","Mô tả ngắn, nguyên liệu chính"],
      ["Giá bán * (VNĐ)",        "Có",  "Số nguyên, không có dấu phẩy. Ví dụ: 45000"],
      ["Giá khuyến mãi (VNĐ)",   "Không","Giá sau giảm, bỏ trống nếu không KM"],
      ["Danh mục",               "Không","Nhóm món. Ví dụ: Cơm, Bún / Phở, Đồ uống"],
      ["Badge",                  "Không","bestseller | hot | new | bigsale (hoặc bỏ trống)"],
      [""],
      ["Lưu ý: Không xoá dòng tiêu đề. Giá phải là số nguyên (VNĐ)."],
    ])
    guide["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 48 }]
    XLSX.utils.book_append_sheet(wb, guide, "Hướng dẫn")

    XLSX.writeFile(wb, "template_menu_giaonhanh.xlsx")
  }

  // ── Group handlers ─────────────────────────────────────────────────────
  const openNewGroup  = () => { setGModal(blankGroup()); setGEditing(false) }
  const openEditGroup = (g: MenuGroup) => { setGModal({...g}); setGEditing(true) }

  const saveGroup = async () => {
    if (!gModal?.name.trim()) return
    let newGroups: MenuGroup[]
    if (gEditing) {
      newGroups = groups.map(g => g.id === gModal.id ? {...gModal, sortOrder: g.sortOrder} as MenuGroup : g)
      fire("Đã lưu nhóm menu")
    } else {
      const newId = gModal.name.trim()
      if (groups.find(g => g.id === newId)) { fire("❌ Nhóm này đã tồn tại", false); return }
      newGroups = [...groups, {...gModal, id: newId, sortOrder: groups.length} as MenuGroup]
      fire("Đã tạo nhóm menu mới")
    }
    setGroups(newGroups)
    await persistGroups(newGroups)
    setGModal(null)
  }

  const delGroup = async (id: string) => {
    if (!confirm("Xoá nhóm này? Các món trong nhóm sẽ không bị xoá.")) return
    const newGroups = groups.filter(g => g.id !== id)
    setGroups(newGroups)
    await persistGroups(newGroups)
    setProducts(ps => ps.map(p => p.menuGroupId === id ? {...p, menuGroupId:""} : p))
    fire("Đã xoá nhóm")
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

  // ── Product handlers ───────────────────────────────────────────────────
  const openNewProduct  = () => { setPModal(blankProduct()); setPEditing(false) }
  const openEditProduct = (p: Product) => { setPModal({...p}); setPEditing(true) }

  const saveProduct = async () => {
    if (!pModal?.name.trim() || pModal.price <= 0) { fire("❌ Vui lòng nhập tên món và giá bán", false); return }
    const category = pModal.categories[0] || pModal.menuGroupId || null

    // Upload image if new file selected
    let imageUrl: string | undefined
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg"
      const productId = pEditing ? pModal.id : `new_${Date.now()}`
      const path = `product-images/${shopId}/${productId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, imageFile, { upsert: true })
      if (!upErr) {
        imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl
      }
    }

    const payload = {
      name: pModal.name, description: pModal.description || null,
      price: pModal.price, original_price: pModal.promoEnabled && pModal.promoPrice ? pModal.promoPrice : null,
      category, is_available: pModal.available, sort_order: pModal.sortOrder,
      updated_at: new Date().toISOString(),
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }
    if (pEditing) {
      const { error } = await supabase.from("products").update(payload).eq("id", pModal.id)
      if (error) { fire("❌ Lỗi cập nhật: " + error.message, false); return }
      const updatedPreview = imageUrl ?? pModal.imagePreview
      setProducts(ps => ps.map(p => p.id === pModal.id
        ? {...pModal, imagePreview: updatedPreview, categories: category ? [category] : [], menuGroupId: category ?? ""}
        : p))
      fire("Đã cập nhật món")
    } else {
      if (!shopId) { fire("❌ Không tìm thấy cửa hàng. Vui lòng tải lại trang.", false); return }
      const { data, error } = await supabase.from("products")
        .insert({ ...payload, shop_id: shopId, sold_count: 0 })
        .select("id").single()
      if (error || !data) { fire("❌ Lỗi thêm món: " + (error?.message ?? ""), false); return }
      const newProd: Product = {
        ...pModal, id: data.id, sortOrder: products.length,
        imagePreview: imageUrl ?? pModal.imagePreview,
        categories: category ? [category] : [], menuGroupId: category ?? "",
      }
      setProducts(ps => [...ps, newProd])
      if (category && !groups.find(g => g.id === category)) {
        setGroups(gs => [...gs, { id: category, name: category, allDay: true, startHour: "06:00", endHour: "22:00", sortOrder: gs.length }])
      }
      fire("Đã thêm món mới")
    }
    setImageFile(null)
    setPModal(null)
  }

  const delProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id)
    if (error) { fire("❌ Lỗi xoá: " + error.message, false); return }
    setProducts(ps => ps.filter(p => p.id !== id))
    fire("Đã xoá món")
  }

  const toggleAvail = async (id: string) => {
    const p = products.find(x => x.id === id)
    if (!p) return
    const next = !p.available
    const { error } = await supabase.from("products").update({ is_available: next }).eq("id", id)
    if (error) { fire("❌ Lỗi cập nhật", false); return }
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

  // ── Product form helpers ───────────────────────────────────────────────
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

  // ── Derived ────────────────────────────────────────────────────────────
  const sortedGroups   = [...groups].sort((a,b) => a.sortOrder - b.sortOrder)
  const filteredProds  = products
    .filter(p => filterGid === "all" ? true : p.menuGroupId === filterGid)
    .sort((a,b) => a.sortOrder - b.sortOrder)
  const badgeCfg = (b: Product["badge"]) => BADGE_LIST.find(x => x.key === b)

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ position:"fixed",inset:0,background:"#080806",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
      <div style={{ fontSize:32 }}>🍽️</div>
      <div style={{ color:"#6a5a40",fontSize:12 }}>Đang tải menu...</div>
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
            {toastOk ? "✓" : "✕"} {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e => { const f = e.target.files?.[0]; if (f) onImageFile(f); e.target.value="" }} />
      <input ref={csvRef} type="file" accept=".csv,.txt" style={{display:"none"}}
        onChange={e => { const f = e.target.files?.[0]; if (f) onCSVFile(f); e.target.value="" }} />

      {/* ── LAYOUT ── */}
      <div style={{position:"fixed",inset:0,background:"#080806",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"calc(env(safe-area-inset-top) + 12px) 16px 0",background:"rgba(8,8,6,0.98)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <a href="/merchant" style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#f8f0e0",fontSize:16,flexShrink:0}}>←</a>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#f8f0e0",fontSize:16,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Quản lý Menu</div>
              <div style={{color:"#6a5a40",fontSize:9}}>{products.length} món · {groups.length} nhóm · {products.filter(p=>p.available).length} đang bán</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginBottom:10}}>
            {mainTab === "products" && (<>
              <button onClick={downloadTemplate}
                style={{background:"rgba(74,143,245,0.1)",border:"1px solid rgba(74,143,245,0.3)",borderRadius:10,padding:"7px 12px",color:"#4a8ff5",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>
                📄 Tải file mẫu
              </button>
              <button onClick={() => csvRef.current?.click()}
                style={{background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",borderRadius:10,padding:"7px 12px",color:"#3ecf6e",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",whiteSpace:"nowrap"}}>
                📥 Nhập Excel
              </button>
            </>)}
            <button onClick={mainTab==="groups" ? openNewGroup : openNewProduct}
              style={{background:"linear-gradient(90deg,#FF6B00,#FF8C00)",border:"none",borderRadius:10,padding:"7px 14px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 2px 12px rgba(255,107,0,0.4)",whiteSpace:"nowrap"}}>
              + {mainTab==="groups" ? "Nhóm mới" : "Thêm món"}
            </button>
          </div>

          {/* Main tab switcher */}
          <div style={{display:"flex",gap:0}}>
            {([["products","🍽️ Danh sách món"],["groups","📋 Nhóm menu"]] as const).map(([k,l]) => (
              <button key={k} onClick={() => setMainTab(k)}
                style={{flex:1,height:38,border:"none",background:"transparent",
                  borderBottom:`2px solid ${mainTab===k?"#FF6B00":"transparent"}`,
                  color:mainTab===k?"#FF8C00":"#6a5a40",fontSize:11,fontWeight:mainTab===k?700:400,cursor:"pointer",fontFamily:"Lexend",transition:"all .2s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ══ TAB: Danh sách món ══ */}
        {mainTab === "products" && (
          <>
            {/* Filter chips */}
            <div style={{display:"flex",gap:6,padding:"10px 16px",overflowX:"auto",flexShrink:0} as React.CSSProperties}>
              {[{id:"all",name:"Tất cả"}, ...sortedGroups].map(g => (
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
                  <div style={{fontSize:36,marginBottom:8}}>🍽️</div>
                  <div style={{color:"#6a5a40",fontSize:12,marginBottom:12}}>Chưa có món nào trong nhóm này</div>
                  <button onClick={openNewProduct}
                    style={{background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:10,padding:"8px 18px",color:"#FF8C00",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
                    + Thêm món đầu tiên
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

        {/* ══ TAB: Nhóm menu ══ */}
        {mainTab === "groups" && (
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px 24px"}}>
            {sortedGroups.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 0"}}>
                <div style={{fontSize:36,marginBottom:8}}>📋</div>
                <div style={{color:"#6a5a40",fontSize:12,marginBottom:12}}>Chưa có nhóm menu nào</div>
                <button onClick={openNewGroup}
                  style={{background:"rgba(255,107,0,0.1)",border:"1px solid rgba(255,107,0,0.3)",borderRadius:10,padding:"8px 18px",color:"#FF8C00",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
                  + Tạo nhóm đầu tiên
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

      {/* ══ MODAL: Import CSV ══ */}
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
                    <div style={{color:"#f8f0e0",fontSize:14,fontWeight:800}}>📥 Nhập sản phẩm từ file</div>
                    {importRows && <div style={{color:"#6a5a40",fontSize:9,marginTop:2}}>Xem trước {importRows.length} sản phẩm · Xác nhận để thêm vào menu</div>}
                  </div>
                  <button onClick={() => { setImportRows(null); setImportError("") }}
                    style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer"}}>×</button>
                </div>
              </div>

              {importError ? (
                <div style={{padding:"24px 18px",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
                  <div style={{color:"#ff4040",fontSize:12,fontWeight:700,marginBottom:6}}>Lỗi đọc file</div>
                  <div style={{color:"rgba(255,100,100,0.7)",fontSize:10}}>{importError}</div>
                  <button onClick={downloadTemplate} style={{marginTop:16,background:"rgba(62,207,110,0.1)",border:"1px solid rgba(62,207,110,0.3)",borderRadius:10,padding:"8px 16px",color:"#3ecf6e",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Lexend"}}>
                    📋 Tải file mẫu (.csv)
                  </button>
                </div>
              ) : importRows && (
                <>
                  {/* Format hint */}
                  <div style={{margin:"10px 18px 0",background:"rgba(74,143,245,0.06)",border:"1px solid rgba(74,143,245,0.18)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
                    <div style={{color:"#4a8ff5",fontSize:9,fontWeight:700,marginBottom:3}}>📋 Định dạng cột CSV</div>
                    <div style={{color:"rgba(74,143,245,0.7)",fontSize:8,lineHeight:1.6}}>
                      <strong>Tên món</strong> · Mô tả · Giá bán · Giá KM (tuỳ chọn) · Danh mục · Badge (hot/bigsale/bestseller)
                    </div>
                    <button onClick={downloadTemplate} style={{marginTop:5,background:"transparent",border:"none",color:"#4a8ff5",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",textDecoration:"underline",padding:0}}>
                      Tải file mẫu
                    </button>
                  </div>

                  {/* Preview table */}
                  <div style={{flex:1,overflowY:"auto",padding:"10px 18px"}}>
                    {/* Table header */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",gap:6,padding:"6px 8px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:6}}>
                      {["Tên món","Giá","KM","Danh mục"].map(h => (
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
                              {r.badge==="hot"?"🔥 HOT":r.badge==="bigsale"?"💸 BIG SALE":"📈 BÁN CHẠY"}
                            </span>
                          )}
                        </div>
                        <div style={{color:"#FF8C00",fontSize:10,fontWeight:700}}>{r.price.toLocaleString("vi-VN")}đ</div>
                        <div style={{color:r.promoPrice?"#ff4040":"rgba(255,255,255,0.2)",fontSize:10}}>{r.promoPrice ? r.promoPrice.toLocaleString("vi-VN")+"đ" : "—"}</div>
                        <div style={{color:"#6a5a40",fontSize:9}}>{r.category || "—"}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{padding:"12px 18px 28px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:8}}>
                    <button onClick={() => { setImportRows(null); setImportError("") }}
                      style={{flex:1,height:44,borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6a5a40",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Lexend"}}>
                      Hủy
                    </button>
                    <button onClick={confirmImport} disabled={importSaving}
                      style={{flex:2,height:44,borderRadius:12,border:"none",background:"linear-gradient(90deg,#3ecf6e,#2bba5e)",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 3px 16px rgba(62,207,110,0.35)",opacity:importSaving?0.7:1}}>
                      {importSaving ? `⏳ Đang lưu... (${importRows.length} món)` : `✅ Nhập ${importRows.length} sản phẩm`}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ MODAL: Tạo / Sửa nhóm ══ */}
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
                {gEditing ? "✏️ Chỉnh sửa nhóm" : "📋 Tạo nhóm menu mới"}
              </div>

              <FLabel>Tên nhóm *</FLabel>
              <FInput value={gModal.name} onChange={v => setGModal(m => m ? {...m,name:v} : m)} placeholder="VD: Bún, Đồ uống, Món thêm..." />

              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Toggle on={gModal.allDay} onToggle={() => setGModal(m => m ? {...m,allDay:!m.allDay} : m)} />
                <span style={{color:"#b0956a",fontSize:11}}>Phục vụ cả ngày</span>
              </div>

              {!gModal.allDay && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <div>
                    <FLabel>Bắt đầu</FLabel>
                    <input type="time" value={gModal.startHour} onChange={e => setGModal(m => m ? {...m,startHour:e.target.value} : m)}
                      style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:12,padding:"0 10px",colorScheme:"dark"} as React.CSSProperties} />
                  </div>
                  <div>
                    <FLabel>Kết thúc</FLabel>
                    <input type="time" value={gModal.endHour} onChange={e => setGModal(m => m ? {...m,endHour:e.target.value} : m)}
                      style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:12,padding:"0 10px",colorScheme:"dark"} as React.CSSProperties} />
                  </div>
                </div>
              )}

              <button onClick={saveGroup} disabled={!gModal.name.trim()}
                style={{width:"100%",height:46,borderRadius:12,border:"none",background:"linear-gradient(90deg,#FF6B00,#FF8C00)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Lexend",boxShadow:"0 3px 16px rgba(255,107,0,0.4)",opacity:!gModal.name.trim()?0.5:1,position:"relative",overflow:"hidden"}}>
                <ShimmerBar />
                <span style={{position:"relative",zIndex:1}}>{gEditing ? "💾 Lưu thay đổi" : "✅ Tạo nhóm"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ SHEET: Thêm / Sửa món ══ */}
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
                  <div style={{color:"#f8f0e0",fontSize:14,fontWeight:800}}>{pEditing ? "✏️ Chỉnh sửa món" : "🍽️ Thêm món mới"}</div>
                  <button onClick={() => { setPModal(null); setImageFile(null) }}
                    style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#6a5a40",fontSize:16,cursor:"pointer"}}>×</button>
                </div>
              </div>

              {/* Scrollable form */}
              <div style={{flex:1,overflowY:"auto",padding:"14px 18px 8px"}}>

                {/* ─ Ảnh + Tên ─ */}
                <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
                  <div onClick={() => fileRef.current?.click()}
                    style={{width:90,height:90,borderRadius:16,flexShrink:0,background:"rgba(255,107,0,0.06)",border:"2px dashed rgba(255,107,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",position:"relative"}}>
                    {pModal.imagePreview
                      ? <>
                          <img src={pModal.imagePreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{color:"#fff",fontSize:10,fontWeight:700}}>Đổi ảnh</span>
                          </div>
                        </>
                      : <div style={{textAlign:"center"}}>
                          <div style={{fontSize:26,marginBottom:2}}>📷</div>
                          <div style={{color:"#6a5a40",fontSize:8}}>Tải ảnh lên</div>
                        </div>
                    }
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <FLabel>Tên món *</FLabel>
                    <FInput value={pModal.name} onChange={v => setPModal(m => m ? {...m,name:v} : m)} placeholder="VD: Bún bò đặc biệt" />
                    <FLabel>Mô tả ngắn</FLabel>
                    <FInput value={pModal.description} onChange={v => setPModal(m => m ? {...m,description:v} : m)} placeholder="Tuỳ chọn..." />
                  </div>
                </div>

                {/* ─ Giá & Nhóm ─ */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <FLabel>Giá bán *</FLabel>
                    <FInput value={pModal.price > 0 ? String(pModal.price) : ""} type="number"
                      onChange={v => setPModal(m => m ? {...m,price:parseInt(v)||0} : m)} placeholder="VD: 45000" />
                  </div>
                  <div>
                    <FLabel>Nhóm menu</FLabel>
                    <select value={pModal.menuGroupId} onChange={e => setPModal(m => m ? {...m,menuGroupId:e.target.value} : m)}
                      style={{width:"100%",height:42,borderRadius:11,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:pModal.menuGroupId?"#f8f0e0":"#6a5a40",fontSize:11,padding:"0 10px",marginBottom:10,colorScheme:"dark",fontFamily:"Lexend"} as React.CSSProperties}>
                      <option value="" style={{background:"#0e0c09"}}>-- Không chọn --</option>
                      {groups.map(g => <option key={g.id} value={g.id} style={{background:"#0e0c09"}}>{g.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* ─ Giờ bán ─ */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                  <Toggle on={pModal.allDay} onToggle={() => setPModal(m => m ? {...m,allDay:!m.allDay} : m)} />
                  <span style={{color:"#b0956a",fontSize:11}}>Bán cả ngày</span>
                  {!pModal.allDay && (
                    <div style={{display:"flex",gap:6,alignItems:"center",flex:1,minWidth:160}}>
                      <input type="time" value={pModal.startHour} onChange={e => setPModal(m => m ? {...m,startHour:e.target.value} : m)}
                        style={{flex:1,height:34,borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                      <span style={{color:"#6a5a40",fontSize:11}}>–</span>
                      <input type="time" value={pModal.endHour} onChange={e => setPModal(m => m ? {...m,endHour:e.target.value} : m)}
                        style={{flex:1,height:34,borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                    </div>
                  )}
                </div>

                {/* ─ Danh mục (max 3) ─ */}
                <div style={{marginBottom:14}}>
                  <FLabel>Danh mục <span style={{color:"#6a5a40"}}>(chọn tối đa 3 · đã chọn {pModal.categories.length}/3)</span></FLabel>
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
                          {on && "✓ "}{c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ─ Badge / Ghim ─ */}
                <div style={{marginBottom:14}}>
                  <FLabel>Ghim / Badge nổi bật</FLabel>
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

                {/* ─ Size ─ */}
                <SectionBox label="Size" color="#3ecf6e" onAdd={addSize} addLabel="+ Thêm size">
                  {pModal.sizes.map((s, i) => (
                    <div key={s.id} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                      <input value={s.label} onChange={e => setSize(i,"label",e.target.value)} placeholder="Tên size (S/M/L...)"
                        style={{flex:1,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <input value={s.priceDiff > 0 ? String(s.priceDiff) : ""} type="number"
                        onChange={e => setSize(i,"priceDiff",e.target.value)} placeholder="+giá (đ)"
                        style={{width:90,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <button onClick={() => removeSize(i)}
                        style={{width:30,height:30,borderRadius:7,background:"rgba(255,64,64,0.07)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:14,cursor:"pointer"}}>×</button>
                    </div>
                  ))}
                </SectionBox>

                {/* ─ Topping ─ */}
                <SectionBox label="Topping" color="#b464ff" onAdd={addTopping} addLabel="+ Thêm topping">
                  {pModal.toppings.map((t, i) => (
                    <div key={t.id} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                      <input value={t.name} onChange={e => setTopping(i,"name",e.target.value)} placeholder="Tên topping"
                        style={{flex:1,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <input value={t.price > 0 ? String(t.price) : ""} type="number"
                        onChange={e => setTopping(i,"price",e.target.value)} placeholder="Giá thêm (đ)"
                        style={{width:90,height:36,borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:11,padding:"0 10px"}} />
                      <button onClick={() => removeTopping(i)}
                        style={{width:30,height:30,borderRadius:7,background:"rgba(255,64,64,0.07)",border:"1px solid rgba(255,64,64,0.2)",color:"#ff4040",fontSize:14,cursor:"pointer"}}>×</button>
                    </div>
                  ))}
                </SectionBox>

                {/* ─ Khuyến mãi ─ */}
                <div style={{background:"rgba(255,64,64,0.04)",border:"1px solid rgba(255,64,64,0.12)",borderRadius:14,padding:12,marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:pModal.promoEnabled?14:0}}>
                    <Toggle on={pModal.promoEnabled} onToggle={() => setPModal(m => m ? {...m,promoEnabled:!m.promoEnabled} : m)} activeColor="#ff4040" activeBg="rgba(255,64,64,0.2)" activeBorder="rgba(255,64,64,0.4)" />
                    <span style={{color:pModal.promoEnabled?"#ff4040":"#6a5a40",fontSize:11,fontWeight:pModal.promoEnabled?700:400}}>🔥 Bật khuyến mãi cho món này</span>
                  </div>

                  {pModal.promoEnabled && (
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <div>
                          <FLabel>Giá khuyến mãi *</FLabel>
                          <FInput value={pModal.promoPrice ? String(pModal.promoPrice) : ""} type="number"
                            onChange={v => setPModal(m => m ? {...m,promoPrice:parseInt(v)||null} : m)} placeholder="VD: 35000" />
                        </div>
                        <div>
                          <FLabel>Giới hạn / người</FLabel>
                          <FInput value={pModal.promoPerPerson ? String(pModal.promoPerPerson) : ""} type="number"
                            onChange={v => setPModal(m => m ? {...m,promoPerPerson:parseInt(v)||null} : m)} placeholder="VD: 2 lần" />
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <FLabel>Từ ngày</FLabel>
                          <input type="datetime-local" value={pModal.promoStart}
                            onChange={e => setPModal(m => m ? {...m,promoStart:e.target.value} : m)}
                            style={{width:"100%",height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#f8f0e0",fontSize:10,padding:"0 8px",colorScheme:"dark"} as React.CSSProperties} />
                        </div>
                        <div>
                          <FLabel>Đến ngày</FLabel>
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
                  <span style={{position:"relative",zIndex:1}}>{pEditing ? "💾 Lưu thay đổi" : "✅ Thêm vào menu"}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Helper components ──────────────────────────────────────────────────────
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
