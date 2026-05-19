"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Power, MapPin, Package, Star, TrendingUp } from "lucide-react";

export default function DriverDashboard() {
  const [online, setOnline] = useState(false);

  return (
    <div className="min-h-screen pb-8" style={{ background: "#080806" }}>
      <header
        className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14"
        style={{
          background: "rgba(8,8,6,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,107,0,0.08)",
        }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tài xế</p>
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Nguyễn Văn A</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setOnline((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm"
          style={{
            background: online ? "rgba(62,207,110,0.15)" : "rgba(255,255,255,0.08)",
            border: online ? "1px solid rgba(62,207,110,0.4)" : "1px solid rgba(255,255,255,0.12)",
            color: online ? "var(--green)" : "var(--text-muted)",
          }}
        >
          <Power size={14} />
          {online ? "Đang hoạt động" : "Ngoại tuyến"}
        </motion.button>
      </header>

      <main className="max-w-md mx-auto pt-14 px-4">
        <div
          className="w-full rounded-2xl mt-4 flex items-center justify-center"
          style={{ height: 280, background: "var(--glass)", border: "1px solid var(--border-2)" }}
        >
          <div className="text-center">
            <div style={{ fontSize: 56 }}>🗺️</div>
            <p className="text-sm mt-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
              Bản đồ Krông Pắc
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {online ? "Đang tìm đơn gần bạn..." : "Bật trạng thái để nhận đơn"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { Icon: Package,    label: "Đơn hôm nay", value: "12",    color: "var(--acc)" },
            { Icon: TrendingUp, label: "Thu nhập",     value: "245k",  color: "var(--green)" },
            { Icon: Star,       label: "Đánh giá",     value: "4.9 ★", color: "var(--yellow)" },
          ].map(({ Icon, label, value, color }) => (
            <div
              key={label}
              className="p-3 rounded-2xl text-center"
              style={{ background: "var(--glass)", border: "1px solid var(--border-2)" }}
            >
              <Icon size={18} style={{ color, margin: "0 auto 4px" }} />
              <p className="text-base font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
            </div>
          ))}
        </div>

        {!online && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-2xl text-center"
            style={{ background: "rgba(255,107,0,0.06)", border: "1px solid var(--border)" }}
          >
            <MapPin size={24} style={{ color: "var(--acc)", margin: "0 auto 8px" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Bật trạng thái để nhận đơn
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Hệ thống sẽ tự động gửi đơn gần bạn
            </p>
          </motion.div>
        )}

        <p className="text-center text-[10px] mt-8" style={{ color: "var(--text-muted)" }}>
          Dashboard tài xế · Giao Nhanh v1.0.0
        </p>
      </main>
    </div>
  );
}
