"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

const SECTIONS = [
  {
    id: "commission",
    icon: "💰",
    title: "Hoa hồng & Phí dịch vụ",
    color: "#FF8C00",
    bg: "rgba(255,107,0,0.08)",
    bd: "rgba(255,107,0,0.2)",
    items: [
      {
        q: "Tỷ lệ hoa hồng là bao nhiêu?",
        a: "Goi thu hoa hồng từ 10%–20% trên doanh thu thực nhận tùy theo loại hình và thỏa thuận ban đầu. Tỷ lệ cụ thể được ghi rõ trong hợp đồng đối tác.",
      },
      {
        q: "Hoa hồng được tính trên cơ sở nào?",
        a: "Hoa hồng được tính trên giá trị tiền hàng (subtotal), không bao gồm phí ship. Ví dụ: đơn 100.000đ với hoa hồng 15% → quán nhận 85.000đ.",
      },
      {
        q: "Có phí đăng ký hay phí tháng không?",
        a: "Hiện tại KHÔNG có phí đăng ký và KHÔNG có phí tháng cố định. Goi chỉ thu hoa hồng khi có đơn hàng thành công.",
      },
      {
        q: "Phí ship ai thu?",
        a: "Phí ship do tài xế thu trực tiếp từ khách hàng. Quán không cần quan tâm đến phần này.",
      },
    ],
  },
  {
    id: "payment",
    icon: "🏦",
    title: "Thanh toán & Dòng tiền",
    color: "#4a8ff5",
    bg: "rgba(74,143,245,0.08)",
    bd: "rgba(74,143,245,0.2)",
    items: [
      {
        q: "Quán nhận tiền như thế nào?",
        a: "Đơn thanh toán tiền mặt (COD): tài xế thu tiền khách → trừ hoa hồng → chuyển khoản cho quán vào cuối ngày hoặc theo chu kỳ thỏa thuận.",
      },
      {
        q: "Chu kỳ quyết toán?",
        a: "Quyết toán hàng tuần (thứ 6 hàng tuần) hoặc khi số dư tích lũy đạt 500.000đ trở lên. Admin sẽ liên hệ xác nhận trước khi chuyển.",
      },
      {
        q: "Đơn hủy có bị tính hoa hồng không?",
        a: "KHÔNG. Chỉ các đơn có trạng thái 'Đã giao' mới bị tính hoa hồng. Đơn bị hủy bất kỳ lý do gì đều không tính phí.",
      },
      {
        q: "Tra cứu doanh thu ở đâu?",
        a: "Vào mục Doanh thu trong menu để xem chi tiết từng đơn, tổng hoa hồng đã thu và số dư cần quyết toán theo ngày/tuần.",
      },
    ],
  },
  {
    id: "orders",
    icon: "📦",
    title: "Quy định xử lý đơn hàng",
    color: "#3ecf6e",
    bg: "rgba(62,207,110,0.08)",
    bd: "rgba(62,207,110,0.2)",
    items: [
      {
        q: "Thời gian xác nhận đơn?",
        a: "Quán cần xác nhận đơn trong vòng 3 phút kể từ khi nhận thông báo. Nếu không phản hồi, hệ thống sẽ tự động hủy đơn và thông báo cho khách.",
      },
      {
        q: "Từ chối đơn có bị phạt không?",
        a: "Từ chối quá 3 đơn liên tiếp trong 1 giờ mà không có lý do hợp lệ có thể bị tạm khóa nhận đơn trong 2 giờ. Vui lòng tắt trạng thái 'Đang mở' khi không thể nhận đơn.",
      },
      {
        q: "Đơn bị khiếu nại xử lý thế nào?",
        a: "Admin sẽ liên hệ cả quán và khách để xác minh. Nếu lỗi từ phía quán (thiếu món, sai món), quán có thể bị hoàn tiền một phần cho khách.",
      },
      {
        q: "Thời gian hoạt động cần đăng ký không?",
        a: "Quán tự cập nhật giờ mở/đóng trong phần Hồ sơ. Hệ thống sẽ không nhận đơn ngoài giờ đã đăng ký. Đừng quên tắt trạng thái 'Đang mở' khi hết ca.",
      },
    ],
  },
  {
    id: "quality",
    icon: "⭐",
    title: "Chất lượng & Đánh giá",
    color: "#f5c542",
    bg: "rgba(245,197,66,0.08)",
    bd: "rgba(245,197,66,0.2)",
    items: [
      {
        q: "Đánh giá ảnh hưởng gì đến quán?",
        a: "Rating trung bình ≥ 4.0 sao: quán được ưu tiên hiển thị trong kết quả tìm kiếm. Rating < 3.5 sao kéo dài 7 ngày: admin sẽ liên hệ hỗ trợ cải thiện.",
      },
      {
        q: "Làm sao tăng đánh giá?",
        a: "Đảm bảo món ăn đúng với ảnh, đóng gói kỹ, chuẩn bị đúng giờ. Khách sẽ được nhắc đánh giá sau khi nhận hàng.",
      },
      {
        q: "Quán có thể phản hồi đánh giá không?",
        a: "Hiện tại chưa hỗ trợ phản hồi công khai. Nếu có đánh giá không trung thực, liên hệ admin qua Zalo để xem xét.",
      },
    ],
  },
  {
    id: "rules",
    icon: "📋",
    title: "Điều khoản & Cam kết",
    color: "#b464ff",
    bg: "rgba(180,100,255,0.08)",
    bd: "rgba(180,100,255,0.2)",
    items: [
      {
        q: "Điều kiện để được duyệt lên sàn?",
        a: "Cửa hàng phải có địa chỉ rõ ràng tại khu vực Phước An – Krông Pắc, ảnh thực tế, menu cập nhật giá đúng và số điện thoại liên hệ hoạt động.",
      },
      {
        q: "Trường hợp nào bị tạm đình chỉ?",
        a: "Vi phạm an toàn thực phẩm, lừa dối khách (ảnh không đúng thực tế), từ chối xử lý khiếu nại chính đáng, hoặc tỷ lệ hủy đơn > 30% trong tuần.",
      },
      {
        q: "Goi có cam kết gì với quán?",
        a: "Minh bạch doanh thu theo thời gian thực, không tăng hoa hồng đột ngột (báo trước 30 ngày), hỗ trợ kỹ thuật trong giờ hành chính và ưu tiên giải quyết khiếu nại trong 24h.",
      },
      {
        q: "Muốn ngừng hợp tác?",
        a: "Liên hệ admin báo trước 7 ngày. Đảm bảo hoàn thành tất cả đơn đang xử lý và quyết toán công nợ trước khi ngừng.",
      },
    ],
  },
]

function AccordionItem({
  q, a, index, isOpen, onToggle, accentColor,
}: {
  q: string; a: string; index: number; isOpen: boolean
  onToggle: () => void; accentColor: string
}) {
  return (
    <div style={{
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "flex-start", gap: 10,
        padding: "13px 0", background: "none", border: "none", cursor: "pointer",
        textAlign: "left",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
          background: isOpen ? `${accentColor}22` : "rgba(255,255,255,0.05)",
          border: `1px solid ${isOpen ? accentColor + "55" : "rgba(255,255,255,0.08)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, color: isOpen ? accentColor : "#6a5a40", fontWeight: 700,
          transition: "all .2s",
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, color: "#f8f0e0", fontSize: 12.5, fontWeight: 600, lineHeight: 1.45 }}>
          {q}
        </div>
        <div style={{
          color: isOpen ? accentColor : "#6a5a40", fontSize: 16, flexShrink: 0,
          transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", marginTop: 1,
        }}>
          ›
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              paddingLeft: 30, paddingBottom: 13, color: "#b0956a",
              fontSize: 11.5, lineHeight: 1.65,
            }}>
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MerchantPoliciesPage() {
  const router = useRouter()
  const [openItem, setOpenItem] = useState<string | null>(null)

  const toggle = (key: string) => setOpenItem(prev => prev === key ? null : key)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#080806;font-family:'Lexend',sans-serif}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,0,0.25);border-radius:2px}
      `}</style>

      <div style={{ minHeight: "100dvh", background: "#080806", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "rgba(8,8,6,0.95)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{
              width: 34, height: 34, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, cursor: "pointer", color: "#f8f0e0",
            }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 16, fontWeight: 700 }}>Quy tắc & Chính sách</div>
              <div style={{ color: "#6a5a40", fontSize: 9.5, marginTop: 1 }}>Điều khoản hợp tác Goi</div>
            </div>
            <div style={{
              background: "rgba(62,207,110,0.1)", border: "1px solid rgba(62,207,110,0.25)",
              borderRadius: 8, padding: "4px 10px",
              color: "#3ecf6e", fontSize: 9.5, fontWeight: 700,
            }}>
              v1.0
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 16px 0" }}>

          {/* Banner */}
          <div style={{
            background: "linear-gradient(135deg,#0d0a00,#1a1000)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 16, padding: "14px 16px", marginBottom: 20,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -20, right: -20, width: 100, height: 100,
              background: "radial-gradient(circle,rgba(255,107,0,0.12) 0%,transparent 65%)",
            }} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>📜</div>
            <div style={{ color: "#FF8C00", fontSize: 13, fontWeight: 700, marginBottom: 5, position: "relative" }}>
              Đối tác Goi
            </div>
            <div style={{ color: "#b0956a", fontSize: 10.5, lineHeight: 1.6, position: "relative" }}>
              Đọc kỹ các chính sách dưới đây để đảm bảo hợp tác suôn sẻ và minh bạch.
              Mọi thắc mắc liên hệ admin qua Zalo.
            </div>
          </div>

          {/* Sections */}
          {SECTIONS.map(section => (
            <div key={section.id} style={{ marginBottom: 14 }}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: section.bg, border: `1px solid ${section.bd}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>
                  {section.icon}
                </div>
                <div style={{ color: section.color, fontSize: 11, fontWeight: 700, letterSpacing: ".3px" }}>
                  {section.title}
                </div>
              </div>

              {/* Accordion card */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14, padding: "0 14px",
              }}>
                {section.items.map((item, i) => (
                  <AccordionItem
                    key={i}
                    index={i}
                    q={item.q}
                    a={item.a}
                    isOpen={openItem === `${section.id}-${i}`}
                    onToggle={() => toggle(`${section.id}-${i}`)}
                    accentColor={section.color}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Contact block */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "16px",
            display: "flex", alignItems: "center", gap: 14, marginTop: 6,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: "rgba(74,143,245,0.1)", border: "1px solid rgba(74,143,245,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>💬</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#f8f0e0", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                Cần hỗ trợ thêm?
              </div>
              <div style={{ color: "#6a5a40", fontSize: 10.5, lineHeight: 1.5 }}>
                Liên hệ admin qua Zalo hoặc gọi trực tiếp trong giờ hành chính (7h–21h hàng ngày).
              </div>
            </div>
            <a
              href="https://zalo.me/0354474474"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 10, border: "none",
                background: "linear-gradient(90deg,#0068FF,#0052cc)",
                color: "#fff", fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 5,
                textDecoration: "none", cursor: "pointer",
              }}
            >
              <span>💬</span> Zalo
            </a>
          </div>

          {/* Footer note */}
          <div style={{ textAlign: "center", marginTop: 20, color: "#6a5a40", fontSize: 9.5, lineHeight: 1.6 }}>
            Cập nhật lần cuối: tháng 6/2026<br />
            Goi — Phước An, Krông Pắc, Đắk Lắk
          </div>

        </div>
      </div>
    </>
  )
}
