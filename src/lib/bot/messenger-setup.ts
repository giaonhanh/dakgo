/**
 * Messenger Profile Setup — gọi 1 lần qua /api/bot/setup
 * Thiết lập: Persistent Menu · Get Started · Greeting Text
 */

const FB_API = "https://graph.facebook.com/v21.0/me/messenger_profile"

async function fbProfilePost(body: unknown, token: string) {
  const res = await fetch(FB_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

export async function setupMessengerProfile(pageToken: string) {
  const results: Record<string, unknown> = {}

  // ── 1. Greeting text (hiện trước nút Get Started) ──────────────────────────
  results.greeting = await fbProfilePost({
    greeting: [
      {
        locale: "vi_VN",
        text:   "Chào mừng đến DakGo 🛵\nGiao hàng · Mua hộ · Xe ôm · Taxi tại Phước An",
      },
      {
        locale: "default",
        text:   "Chào mừng đến DakGo 🛵 — Phước An, Krông Pắc",
      },
    ],
  }, pageToken)

  // ── 2. Get Started button (nút đầu tiên khi mở chat) ──────────────────────
  results.getStarted = await fbProfilePost({
    get_started: { payload: "GET_STARTED" },
  }, pageToken)

  // ── 3. Persistent Menu (3 dòng hamburger ≡ luôn hiện) ─────────────────────
  results.persistentMenu = await fbProfilePost({
    persistent_menu: [{
      locale:                "default",
      composer_input_disabled: false,
      call_to_actions: [
        {
          type:  "nested",
          title: "🛵 Đặt dịch vụ",
          call_to_actions: [
            { type: "postback", title: "🍜 Đặt đồ ăn",  payload: "SERVICE:food" },
            { type: "postback", title: "📦 Giao hộ",     payload: "SERVICE:deliver_for_me" },
            { type: "postback", title: "🛒 Mua hộ",      payload: "SERVICE:buy_for_me" },
            { type: "postback", title: "🛵 Xe ôm",        payload: "SERVICE:motorbike" },
            { type: "postback", title: "🚕 Taxi",          payload: "SERVICE:taxi" },
          ],
        },
        {
          type:    "postback",
          title:   "🔄 Đặt lại đơn cũ",
          payload: "REORDER",
        },
        {
          type:    "postback",
          title:   "📞 Liên hệ hỗ trợ",
          payload: "ESCALATE",
        },
      ],
    }],
  }, pageToken)

  return results
}
