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
  // Slug cũ
  "bun-pho":   "bun-pho",
  "com-hop":   "com-hop",
  "ca-phe":    "ca-phe",
  "ga-ran":    "ga-ran",
  "banh-mi":   "banh-mi",
  "an-vat":    "an-vat",
  "mon-nhau":  "mon-nhau",
  "an-chay":   "an-chay",
  "lau-nuong": "lau-nuong",
  "banh-ngot": "banh-ngot",
  "hai-san":   "hai-san",
  // Chuỗi tiếng Việt đầy đủ
  "Bún/Phở":       "bun-pho",
  "Bún · Phở · Mì":"bun-pho",
  "Bún Phở Mì":    "bun-pho",
  "Bún":           "bun-pho",
  "Phở":           "bun-pho",
  "Mì":            "bun-pho",
  "Hủ tiếu":       "bun-pho",
  "Cơm hộp":       "com-hop",
  "Cơm · Cơm hộp": "com-hop",
  "Cơm":           "com-hop",
  "Cơm tấm":       "com-hop",
  "Cà phê":        "ca-phe",
  "Cà phê · Trà sữa":"ca-phe",
  "Cafe":          "ca-phe",
  "Coffee":        "ca-phe",
  "Trà sữa":       "ca-phe",
  "Đồ uống":       "ca-phe",
  "Nước uống":     "ca-phe",
  "Gà rán":        "ga-ran",
  "Gà rán · FastFood":"ga-ran",
  "FastFood":      "ga-ran",
  "Pizza":         "ga-ran",
  "Burger":        "ga-ran",
  "Bánh mì":       "banh-mi",
  "Bánh mì · Sandwich":"banh-mi",
  "Sandwich":      "banh-mi",
  "Ăn vặt":        "an-vat",
  "Ăn vặt · Vỉa hè":"an-vat",
  "Vỉa hè":        "an-vat",
  "Chè":           "an-vat",
  "Món nhậu":      "mon-nhau",
  "Nhậu · Bia hơi":"mon-nhau",
  "Nhậu":          "mon-nhau",
  "Bia":           "mon-nhau",
  "Bia hơi":       "mon-nhau",
  "Chay":          "an-chay",
  "Chay · Healthy":"an-chay",
  "Healthy":       "an-chay",
  "Lẩu":           "lau-nuong",
  "Nướng":         "lau-nuong",
  "BBQ":           "lau-nuong",
  "Lẩu · Nướng · BBQ":"lau-nuong",
  "Bánh/Kem":      "banh-ngot",
  "Bánh":          "banh-ngot",
  "Bánh ngọt":     "banh-ngot",
  "Tráng miệng":   "banh-ngot",
  "Bánh · Tráng miệng":"banh-ngot",
  "Hải sản":       "hai-san",
  "Hải sản · Đặc sản":"hai-san",
  "Đặc sản":       "hai-san",
  "Khác":          "khac",
  "khac":          "khac",
  "":              "khac",
}

export function normalizeCategoryValue(raw: string): ShopCategoryValue {
  if (!raw) return "khac"
  if (SHOP_CATEGORIES.some(c => c.value === raw)) return raw as ShopCategoryValue
  return LEGACY_MAP[raw.trim()] ?? "khac"
}
