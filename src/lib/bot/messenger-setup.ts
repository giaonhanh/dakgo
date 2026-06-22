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
  // Gửi 1 request duy nhất — get_started + persistent_menu cùng lúc
  const result = await fbProfilePost({
    get_started: { payload: "GET_STARTED" },
    greeting: [
      {
        locale: "default",
        text:   "Chào {{user_first_name}}! 👋\nMình là trợ lý ảo của DakGo — giao đồ ăn · Giao Hộ · Mua hộ · Xe ôm · Taxi tại xã Krông Pắc 🛵\n\nBấm Bắt đầu để đặt dịch vụ nhé!",
      },
      {
        locale: "vi_VN",
        text:   "Chào {{user_first_name}}! 👋\nMình là trợ lý ảo của DakGo — giao đồ ăn · Giao Hộ · Mua hộ · Xe ôm · Taxi tại xã Krông Pắc 🛵\n\nBấm Bắt đầu để đặt dịch vụ nhé!",
      },
    ],
    ice_breakers: [
      { question: "🍜 Tôi muốn đặt đồ ăn",      payload: "SERVICE:food" },
      { question: "🛵 Đặt xe ôm hoặc taxi",       payload: "SERVICE:motorbike" },
      { question: "📦 Giao hộ / Mua hộ",          payload: "SERVICE:deliver_for_me" },
      { question: "📞 Liên hệ nhân viên hỗ trợ",  payload: "ESCALATE" },
    ],
    persistent_menu: [{
      locale:                  "default",
      composer_input_disabled: false,
      call_to_actions: [
        { type: "postback", title: "🛵 Đặt dịch vụ",    payload: "SHOW_MENU" },
        { type: "postback", title: "🔄 Đặt lại đơn cũ", payload: "REORDER" },
        { type: "postback", title: "📞 Liên hệ hỗ trợ", payload: "ESCALATE" },
      ],
    }],
  }, pageToken)

  return { result }
}
