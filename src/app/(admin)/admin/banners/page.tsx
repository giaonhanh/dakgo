"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import AdminShell from "@/components/admin/AdminShell"

interface Banner {
  id: string
  title: string
  subtitle: string | null
  image_url: string | null
  link_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  is_active: true,
  sort_order: 0,
}

const fire = (msg: string, ok = true) => {
  const el = document.createElement("div")
  el.textContent = msg
  Object.assign(el.style, {
    position: "fixed", top: "70px", left: "50%", transform: "translateX(-50%)",
    background: ok ? "rgba(62,207,110,0.12)" : "rgba(255,64,64,0.12)",
    border: `1px solid ${ok ? "rgba(62,207,110,0.3)" : "rgba(255,64,64,0.3)"}`,
    color: ok ? "#3ecf6e" : "#ff4040",
    padding: "8px 18px", borderRadius: 10, fontSize: 12, fontWeight: 600,
    fontFamily: "Lexend, sans-serif", zIndex: 9999, whiteSpace: "nowrap",
    backdropFilter: "blur(8px)",
  })
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2400)
}

export default function AdminBannersPage() {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [banners,   setBanners]   = useState<Banner[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<"create" | "edit" | null>(null)
  const [editing,   setEditing]   = useState<Banner | null>(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [delId,     setDelId]     = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("banners")
      .select("id,title,subtitle,image_url,link_url,is_active,sort_order,created_at")
      .order("sort_order", { ascending: true })
    setBanners((data ?? []) as Banner[])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, sort_order: banners.length })
    setModal("create")
  }

  const openEdit = (b: Banner) => {
    setEditing(b)
    setForm({
      title:      b.title,
      subtitle:   b.subtitle ?? "",
      image_url:  b.image_url ?? "",
      link_url:   b.link_url ?? "",
      is_active:  b.is_active,
      sort_order: b.sort_order,
    })
    setModal("edit")
  }

  const closeModal = () => { setModal(null); setEditing(null) }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const ext  = file.name.split(".").pop() ?? "jpg"
    const path = `banners/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("banners").upload(path, file, { upsert: true })
    if (error) { fire("Upload thất bại: " + error.message, false); setUploading(false); return }
    const { data: urlData } = supabase.storage.from("banners").getPublicUrl(path)
    setForm(f => ({ ...f, image_url: urlData.publicUrl }))
    setUploading(false)
    fire("✅ Upload ảnh thành công")
  }

  const handleSave = async () => {
    if (!form.title.trim()) { fire("Nhập tiêu đề banner", false); return }
    setSaving(true)
    const payload = {
      title:      form.title.trim(),
      subtitle:   form.subtitle.trim() || null,
      image_url:  form.image_url.trim() || null,
      link_url:   form.link_url.trim() || null,
      is_active:  form.is_active,
      sort_order: form.sort_order,
    }

    if (modal === "edit" && editing) {
      const { error } = await supabase.from("banners").update(payload).eq("id", editing.id)
      if (error) { fire("Lỗi: " + error.message, false) }
      else { fire("✅ Đã cập nhật banner"); closeModal(); await load() }
    } else {
      const { error } = await supabase.from("banners").insert(payload)
      if (error) { fire("Lỗi: " + error.message, false) }
      else { fire("✅ Đã tạo banner mới"); closeModal(); await load() }
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("banners").delete().eq("id", id)
    if (error) { fire("Lỗi xóa: " + error.message, false); return }
    setBanners(p => p.filter(b => b.id !== id))
    setDelId(null)
    fire("Đã xóa banner")
  }

  const toggleActive = async (b: Banner) => {
    await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id)
    setBanners(p => p.map(x => x.id === b.id ? { ...x, is_active: !x.is_active } : x))
  }

  const moveOrder = async (id: string, dir: -1 | 1) => {
    const idx = banners.findIndex(b => b.id === id)
    const next = idx + dir
    if (next < 0 || next >= banners.length) return
    const a = banners[idx], b = banners[next]
    await Promise.all([
      supabase.from("banners").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("banners").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    await load()
  }

  const f = (k: keyof typeof form, v: string | boolean | number) =>
    setForm(p => ({ ...p, [k]: v }))

  return (
    <AdminShell
      pageTitle="🖼️ Quản lý Banner"
      pageSubtitle={loading ? "Đang tải..." : `${banners.length} banner`}
      actions={
        <button onClick={openCreate}
          style={{ width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#FF6B00,#FF8C00)",
            border: "none", color: "#fff", fontSize: 20, fontWeight: 800,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(255,107,0,0.4)" }}>+</button>
      }
    >
      <div style={{ padding: "14px 16px 100px", overflowY: "auto", height: "100%" }}>

        {/* Hướng dẫn */}
        <div style={{ background: "rgba(74,143,245,0.07)", border: "1px solid rgba(74,143,245,0.18)",
          borderRadius: 12, padding: "10px 14px", marginBottom: 16,
          color: "#6a5a40", fontSize: 10, lineHeight: 1.7 }}>
          💡 Banner hiển thị trên trang chủ khi không có <strong style={{ color: "#f8f0e0" }}>voucher Flash Sale</strong>.
          Kéo thứ tự để ưu tiên. Banner có ảnh sẽ hiển thị fullwidth. Kích thước tốt nhất: <strong style={{ color: "#f8f0e0" }}>1080 × 346px</strong> (tỉ lệ 3:1) hoặc GIF động. Nội dung quan trọng đặt giữa ảnh.
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 80, borderRadius: 14, background: "rgba(255,255,255,0.04)",
              marginBottom: 10, animation: "pulse 1.5s infinite" }} />
          ))
        ) : banners.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
            <div style={{ color: "#6a5a40", fontSize: 13 }}>Chưa có banner nào</div>
            <div style={{ color: "#6a5a40", fontSize: 10, marginTop: 6 }}>
              Bấm + để tạo banner đầu tiên
            </div>
          </div>
        ) : banners.map((b, idx) => (
          <motion.div key={b.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${b.is_active ? "rgba(62,207,110,0.2)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>

            {/* Preview ảnh */}
            {b.image_url && (
              <div style={{ height: 90, overflow: "hidden", position: "relative" }}>
                <img src={b.image_url} alt={b.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0,
                  background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6))" }} />
              </div>
            )}

            <div style={{ padding: "10px 13px", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Thứ tự */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                <button onClick={() => moveOrder(b.id, -1)} disabled={idx === 0}
                  style={{ width: 22, height: 22, borderRadius: 6, border: "none", cursor: idx === 0 ? "default" : "pointer",
                    background: "rgba(255,255,255,0.06)", color: "#6a5a40", fontSize: 11,
                    opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => moveOrder(b.id, 1)} disabled={idx === banners.length - 1}
                  style={{ width: 22, height: 22, borderRadius: 6, border: "none",
                    cursor: idx === banners.length - 1 ? "default" : "pointer",
                    background: "rgba(255,255,255,0.06)", color: "#6a5a40", fontSize: 11,
                    opacity: idx === banners.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>

              {/* Thông tin */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#f8f0e0", fontSize: 12, fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.title}
                </div>
                {b.subtitle && (
                  <div style={{ color: "#6a5a40", fontSize: 9, marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.subtitle}
                  </div>
                )}
                {b.link_url && (
                  <div style={{ color: "#4a8ff5", fontSize: 9, marginTop: 2 }}>
                    🔗 {b.link_url}
                  </div>
                )}
                <div style={{ display: "flex", gap: 5, marginTop: 5, alignItems: "center" }}>
                  <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                    background: b.is_active ? "rgba(62,207,110,0.12)" : "rgba(255,255,255,0.06)",
                    color: b.is_active ? "#3ecf6e" : "#6a5a40",
                    border: `1px solid ${b.is_active ? "rgba(62,207,110,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                    {b.is_active ? "● Hiển thị" : "○ Ẩn"}
                  </span>
                  <span style={{ color: "#6a5a40", fontSize: 8 }}>#{idx + 1}</span>
                  {!b.image_url && (
                    <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4,
                      background: "rgba(255,179,71,0.1)", color: "#FFB347",
                      border: "1px solid rgba(255,179,71,0.2)" }}>Chưa có ảnh</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleActive(b)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer",
                    background: b.is_active ? "rgba(62,207,110,0.1)" : "rgba(255,255,255,0.06)",
                    color: b.is_active ? "#3ecf6e" : "#6a5a40", fontSize: 15 }}>
                  {b.is_active ? "👁" : "🙈"}
                </button>
                <button onClick={() => openEdit(b)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer",
                    background: "rgba(74,143,245,0.1)", color: "#4a8ff5", fontSize: 14 }}>✏️</button>
                <button onClick={() => setDelId(b.id)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer",
                    background: "rgba(255,64,64,0.08)", color: "#ff4040", fontSize: 14 }}>🗑</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Modal tạo/sửa ── */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 60, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c09",
                borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,107,0,0.2)",
                zIndex: 61, maxHeight: "92dvh", display: "flex", flexDirection: "column" }}>

              {/* Header */}
              <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#FF8C00", fontSize: 15, fontWeight: 800 }}>
                    {modal === "create" ? "✨ Tạo banner mới" : "✏️ Chỉnh sửa banner"}
                  </div>
                  <button onClick={closeModal}
                    style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "#6a5a40", fontSize: 18, cursor: "pointer" }}>×</button>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

                {/* Upload ảnh */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 8 }}>Ảnh banner (GIF/JPG/PNG/WebP)</div>

                  {form.image_url ? (
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <img src={form.image_url} alt="preview"
                        style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10 }} />
                      <button onClick={() => f("image_url", "")}
                        style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 7,
                          background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: 13, cursor: "pointer" }}>×</button>
                    </div>
                  ) : (
                    <div onClick={() => fileRef.current?.click()}
                      style={{ height: 90, borderRadius: 10, border: "2px dashed rgba(255,107,0,0.3)",
                        background: "rgba(255,107,0,0.04)", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 6, marginBottom: 8 }}>
                      {uploading ? (
                        <div style={{ color: "#FF8C00", fontSize: 11 }}>⏳ Đang tải lên...</div>
                      ) : (
                        <>
                          <span style={{ fontSize: 24 }}>📤</span>
                          <span style={{ color: "#6a5a40", fontSize: 10 }}>Bấm để chọn ảnh</span>
                          <span style={{ color: "#6a5a40", fontSize: 9 }}>1000×500px (tỉ lệ 2:1) · GIF động OK · &lt;2MB</span>
                        </>
                      )}
                    </div>
                  )}

                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f2 = e.target.files?.[0]; if (f2) handleUpload(f2) }} />

                  {/* Hoặc nhập URL */}
                  <div style={{ color: "#6a5a40", fontSize: 9, marginBottom: 4 }}>Hoặc nhập URL ảnh trực tiếp</div>
                  <input value={form.image_url} onChange={e => f("image_url", e.target.value)}
                    placeholder="https://..."
                    style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#f0eaff", fontSize: 11 }} />
                </div>

                {/* Tiêu đề */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Tiêu đề <span style={{ color: "#ff4040" }}>*</span></div>
                  <input value={form.title} onChange={e => f("title", e.target.value)}
                    placeholder="VD: Ưu đãi cuối tuần"
                    style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#f0eaff", fontSize: 12 }} />
                </div>

                {/* Mô tả */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Mô tả phụ (tùy chọn)</div>
                  <input value={form.subtitle} onChange={e => f("subtitle", e.target.value)}
                    placeholder="VD: Giảm đến 50% cho tất cả đơn hàng"
                    style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#f0eaff", fontSize: 12 }} />
                </div>

                {/* Link */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Link khi bấm (tùy chọn)</div>
                  <input value={form.link_url} onChange={e => f("link_url", e.target.value)}
                    placeholder="/nearby-shops hoặc https://..."
                    style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#f0eaff", fontSize: 12 }} />
                </div>

                {/* Sort order + Active */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Thứ tự hiển thị</div>
                    <input type="number" value={form.sort_order} min={0}
                      onChange={e => f("sort_order", parseInt(e.target.value) || 0)}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#f0eaff", fontSize: 12 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#6a5a40", fontSize: 10, marginBottom: 6 }}>Trạng thái</div>
                    <button onClick={() => f("is_active", !form.is_active)}
                      style={{ width: "100%", height: 42, borderRadius: 9, border: "none", cursor: "pointer",
                        fontFamily: "Lexend", fontSize: 11, fontWeight: 700,
                        background: form.is_active ? "rgba(62,207,110,0.12)" : "rgba(255,255,255,0.06)",
                        color: form.is_active ? "#3ecf6e" : "#6a5a40" }}>
                      {form.is_active ? "● Hiển thị" : "○ Ẩn"}
                    </button>
                  </div>
                </div>

                <button onClick={handleSave} disabled={saving}
                  style={{ width: "100%", height: 48, borderRadius: 13, border: "none",
                    background: saving ? "rgba(255,107,0,0.3)" : "linear-gradient(90deg,#FF6B00,#FF8C00)",
                    color: "#fff", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "Lexend", boxShadow: saving ? "none" : "0 4px 20px rgba(255,107,0,0.35)" }}>
                  {saving ? "⏳ Đang lưu..." : modal === "create" ? "✅ Tạo banner" : "✅ Lưu thay đổi"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Confirm xóa ── */}
      <AnimatePresence>
        {delId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDelId(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 70, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                background: "#0e0c09", borderRadius: 18, border: "1px solid rgba(255,64,64,0.25)",
                padding: "22px 20px", zIndex: 71, width: 280, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
              <div style={{ color: "#f8f0e0", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Xóa banner này?</div>
              <div style={{ color: "#6a5a40", fontSize: 11, marginBottom: 18 }}>Không thể khôi phục sau khi xóa.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDelId(null)}
                  style={{ flex: 1, height: 42, borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "#b0956a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Lexend" }}>
                  Hủy
                </button>
                <button onClick={() => handleDelete(delId)}
                  style={{ flex: 1, height: 42, borderRadius: 11, border: "none",
                    background: "rgba(255,64,64,0.15)", color: "#ff4040", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "Lexend" }}>
                  Xóa
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminShell>
  )
}
