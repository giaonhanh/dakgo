// Layer 0: Text Normalizer — chuẩn hóa input trước khi vào pipeline
// Grok hiểu tiếng Việt không dấu rất tốt; layer này xử lý ký tự/viết tắt mà Grok dễ nhầm

export function normalizeInput(raw: string): string {
  let s = raw.trim()

  // ── 1. Collapse whitespace ───────────────────────────────────────────────────
  s = s.replace(/\s+/g, ' ')

  // ── 2. Bảo vệ "Xk" (giá tiền) trước khi xử lý viết tắt ──────────────────────
  // Đánh dấu tạm: "10k" → "10K__PRICE" rồi khôi phục sau
  s = s.replace(/(\d+)\s*k\b/gi, '$1K__PRICE')

  // ── 3. Viết tắt phổ biến (word boundary để tránh thay trong từ) ──────────────
  const abbr: [RegExp, string][] = [
    [/\bko\b/gi,   'không'],
    [/\bkh\b/gi,   'không'],
    [/\bk\b/gi,    'không'],      // safe vì đã bảo vệ "Xk" ở trên
    [/\bkp\b/gi,   'không phải'],
    [/\bdc\b/gi,   'được'],
    [/\bđc\b/gi,   'được'],
    [/\bvs\b/gi,   'với'],
    [/\bmk\b/gi,   'mình'],
    [/\bmình\b/gi, 'mình'],
    [/\bbh\b/gi,   'bây giờ'],
    [/\bck\b/gi,   'chuyển khoản'],
    [/\bsdt\b/gi,  'số điện thoại'],
    [/\bsđt\b/gi,  'số điện thoại'],
    [/\bđt\b/gi,   'điện thoại'],
    [/\bship\b/gi, 'giao'],
    [/\bít\b/gi,   'ít'],         // "it cay" → "ít cay" (không dấu thường gặp)
  ]
  for (const [re, rep] of abbr) s = s.replace(re, rep)

  // ── 4. Số chữ → số (hỗ trợ đặt đơn bằng giọng/gõ nhanh) ───────────────────
  const numWords: [RegExp, string][] = [
    [/\bmột\b/gi,   '1'],
    [/\bhai\b/gi,   '2'],
    [/\bba\b/gi,    '3'],
    [/\bbốn\b/gi,   '4'],
    [/\bnăm\b/gi,   '5'],
    [/\bsáu\b/gi,   '6'],
    [/\bbảy\b/gi,   '7'],
    [/\btám\b/gi,   '8'],
    [/\bchín\b/gi,  '9'],
    [/\bmười\b/gi,  '10'],
  ]
  for (const [re, rep] of numWords) s = s.replace(re, rep)

  // ── 5. Ký tự đặc biệt ─────────────────────────────────────────────────────
  s = s.replace(/[+&]/g, ' và ')
  s = s.replace(/[;]/g, ' ')     // dấu phẩy GIỮ LẠI vì dùng trong địa chỉ

  // ── 6. Khôi phục giá tiền ──────────────────────────────────────────────────
  s = s.replace(/(\d+)K__PRICE/g, '$1k')

  // ── 7. Collapse lại ────────────────────────────────────────────────────────
  return s.replace(/\s+/g, ' ').trim()
}
