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
    persistent_menu: [{
      locale:                  "default",
      composer_input_disabled: false,
      call_to_actions: [
        {
          type:  "nested",
          title: "🛵 Đặt dịch vụ",
          call_to_actions: [
            { type: "postback", title: "🍜 Đặt đồ ăn", payload: "SERVICE:food" },
            { type: "postback", title: "📦 Giao hộ",    payload: "SERVICE:deliver_for_me" },
            { type: "postback", title: "🛒 Mua hộ",     payload: "SERVICE:buy_for_me" },
            { type: "postback", title: "🛵 Xe ôm",      payload: "SERVICE:motorbike" },
            { type: "postback", title: "🚕 Taxi",        payload: "SERVICE:taxi" },
          ],
        },
        { type: "postback", title: "🔄 Đặt lại đơn cũ", payload: "REORDER" },
        { type: "postback", title: "📞 Liên hệ hỗ trợ", payload: "ESCALATE" },
      ],
    }],
  }, pageToken)

  return { result }
}
