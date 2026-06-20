import { processMessage } from "@/lib/bot/processor"

const FB_PAGE_TOKEN  = process.env.FB_PAGE_ACCESS_TOKEN!
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!

// Gửi tin nhắn về Facebook Messenger
async function sendFbMessage(recipientId: string, text: string) {
  await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FB_PAGE_TOKEN}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  })
}

// Facebook verify webhook
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get("hub.mode")
  const token     = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === FB_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// Nhận tin nhắn từ Facebook
export async function POST(req: Request) {
  const body = await req.json()

  if (body.object !== "page") {
    return Response.json({ ok: false }, { status: 404 })
  }

  // Xử lý bất đồng bộ — trả 200 ngay để FB không retry
  void handleEvents(body)

  return Response.json({ ok: true })
}

async function handleEvents(body: Record<string, unknown>) {
  const entries = (body.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? []

    for (const event of messaging) {
      const senderId = (event.sender as { id: string })?.id
      const message  = event.message as { text?: string; is_echo?: boolean } | undefined

      // Bỏ qua echo (tin do page tự gửi) và tin không có text
      if (!senderId || !message?.text || message.is_echo) continue

      try {
        const reply = await processMessage(senderId, message.text.trim())
        await sendFbMessage(senderId, reply)
      } catch (err) {
        console.error("[bot/webhook] error:", err)
        await sendFbMessage(
          senderId,
          "Xin lỗi bạn, mình gặp sự cố nhỏ 😅 Bạn thử nhắn lại sau ít phút nhé!",
        )
      }
    }
  }
}
