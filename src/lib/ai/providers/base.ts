// AI Provider Adapter Interface
// Đổi provider: chỉ cần thêm 1 class, không sửa pipeline

import type { AIExtraction } from '../types'

export interface AIProvider {
  /** Extract structured order data from natural language. Returns strict JSON. */
  extract(message: string, contextSummary: string): Promise<AIExtraction>
  /** Provider name, for logging */
  readonly name: string
}

export const EXTRACTION_SCHEMA = `{
  "items": [{ "rawName": "string", "quantity": number, "note": string|null }],
  "phone": string|null,
  "address": string|null,
  "intent": "ORDER"|"FIND"|"CANCEL"|"TRACK"|"OTHER"|null
}`

export const EXTRACTION_RULES = `
Quy tắc bắt buộc:
- Trả về CHỈ JSON, không có text, không markdown, không giải thích
- quantity mặc định 1 nếu không nói rõ, tối đa 20
- rawName: giữ nguyên như user gõ kể cả lỗi chính tả
- phone: chuỗi số, định dạng VN (0xxx...), 10-11 số
- address: địa chỉ đầy đủ như user nói
- note: ghi chú riêng cho món (ít đường, không cay...)
- intent: ORDER=đặt hàng, FIND=tìm quán/món, CANCEL=hủy, TRACK=theo dõi đơn, OTHER=khác
- Nếu không có gì: {"items":[],"phone":null,"address":null,"intent":"OTHER"}`
