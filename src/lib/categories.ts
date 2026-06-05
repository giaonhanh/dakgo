// Danh mục cửa hàng — nguồn sự thật duy nhất, dùng ở mọi nơi
// Đồng bộ: merchant/register, merchant/profile, admin/merchants, homepage carousel

export const SHOP_CATEGORIES = [
  { value: "bun-pho",    label: "Bún · Phở · Mì",       emoji: "🍜", color: "rgba(255,107,0,0.15)"   },
  { value: "com-hop",    label: "Cơm · Cơm hộp",         emoji: "🍱", color: "rgba(62,207,110,0.12)"  },
  { value: "ca-phe",     label: "Cà phê · Trà sữa",      emoji: "☕", color: "rgba(255,64,64,0.12)"   },
  { value: "ga-ran",     label: "Gà rán · FastFood",      emoji: "🍗", color: "rgba(255,179,71,0.12)"  },
  { value: "banh-mi",    label: "Bánh mì · Sandwich",     emoji: "🥪", color: "rgba(245,197,66,0.12)"  },
  { value: "an-vat",     label: "Ăn vặt · Vỉa hè",       emoji: "🍢", color: "rgba(74,143,245,0.12)"  },
  { value: "mon-nhau",   label: "Nhậu · Bia hơi",         emoji: "🍺", color: "rgba(180,100,255,0.12)" },
  { value: "an-chay",    label: "Chay · Healthy",         emoji: "🥗", color: "rgba(62,207,110,0.10)"  },
  { value: "lau-nuong",  label: "Lẩu · Nướng · BBQ",     emoji: "🍲", color: "rgba(255,64,64,0.10)"   },
  { value: "banh-ngot",  label: "Bánh · Tráng miệng",    emoji: "🎂", color: "rgba(74,143,245,0.10)"  },
  { value: "hai-san",    label: "Hải sản · Đặc sản",     emoji: "🦐", color: "rgba(74,143,245,0.14)"  },
  { value: "khac",       label: "Khác",                   emoji: "🏪", color: "rgba(255,255,255,0.06)" },
] as const

export type ShopCategoryValue = typeof SHOP_CATEGORIES[number]["value"]

export function getCategoryByValue(value: string) {
  return SHOP_CATEGORIES.find(c => c.value === value) ?? SHOP_CATEGORIES[SHOP_CATEGORIES.length - 1]
}

// Legacy mapping — chuyển đổi giá trị cũ sang mới
const LEGACY_MAP: Record<string, ShopCategoryValue> = {
  "Bún/Phở":  "bun-pho",
  "Cơm hộp":  "com-hop",
  "Cà phê":   "ca-phe",
  "Gà rán":   "ga-ran",
  "Bánh mì":  "banh-mi",
  "Ăn vặt":   "an-vat",
  "Món nhậu": "mon-nhau",
  "Đồ uống":  "ca-phe",
  "Pizza":    "ga-ran",
  "Bánh/Kem": "banh-ngot",
  "Hải sản":  "hai-san",
  "Lẩu":      "lau-nuong",
  "Khác":     "khac",
}

export function normalizeCategoryValue(raw: string): ShopCategoryValue {
  if (SHOP_CATEGORIES.some(c => c.value === raw)) return raw as ShopCategoryValue
  return LEGACY_MAP[raw] ?? "khac"
}
