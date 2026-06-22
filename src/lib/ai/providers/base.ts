// AI Provider Adapter Interface
// Đổi provider: chỉ cần thêm 1 class, không sửa pipeline

import type { AIExtraction } from '../types'

export interface AIProvider {
  extract(message: string, contextSummary: string): Promise<AIExtraction>
  readonly name: string
}

export const EXTRACTION_SCHEMA = `{
  "items": [{ "name": "string", "quantity": number, "modifiers": string[] }],
  "shopName": string|null,
  "phone": string|null,
  "address": string|null,
  "intent": "ORDER"|"FIND"|"CANCEL"|"TRACK"|"OTHER"|null,
  "confidence": number
}`

export const EXTRACTION_RULES = `
QUY TẮC (bắt buộc, không ngoại lệ):
- Chỉ trả về JSON, không có text, không markdown
- Hiểu tiếng Việt không dấu, viết tắt, sai chính tả thoải mái
- "mi cay" = "mỳ cay", "my" = "mỳ", "bo" = "bò", "com" = "cơm", "pho" = "phở", "bun" = "bún", "ga" = "gà"
- "lam hoa" / "lam hoà" = tên quán Lâm Hoà
- items[].name: tên món chuẩn hóa có dấu nếu đoán được, hoặc giữ nguyên
- items[].modifiers: mảng ghi chú cho món — ít cay, không hành, ít đường, cấp 2...
- quantity mặc định 1, tối đa 20
- shopName: tên quán nếu user đề cập
- phone: chuỗi số VN (0xxx, 10–11 số)
- address: địa chỉ giao hàng đầy đủ như user nói
- confidence: 0.0–1.0 — mức chắc chắn của extraction (cao nếu đủ thông tin, thấp nếu mơ hồ)
- Không có gì: {"items":[],"shopName":null,"phone":null,"address":null,"intent":"OTHER","confidence":0}`
