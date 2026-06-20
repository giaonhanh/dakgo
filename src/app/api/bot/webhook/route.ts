import { processMessage, processLocation, handleLocationRefused } from "@/lib/bot/processor"
import { getState } from "@/lib/bot/storage"

const FB_PAGE_TOKEN   = process.env.FB_PAGE_ACCESS_TOKEN!
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!

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

export async function POST(req: Request) {
  const body = await req.json()
  if (body.object !== "page") return Response.json({ ok: false }, { status: 404 })
  await handleEvents(body)
  return Response.json({ ok: true })
}

async function handleEvents(body: Record<string, unknown>) {
  const entries = (body.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? []

    for (const event of messaging) {
      const senderId = (event.sender as { id: string })?.id
      if (!senderId) continue

      const message = event.message as {
        text?: string
        is_echo?: boolean
        attachments?: Array<{
          type: string
          payload: { coordinates?: { lat: number; long: number } }
        }>
      } | undefined

      if (!message || message.is_echo) continue

      try {
        // Khách share vị trí
        const locationAttachment = message.attachments?.find(a => a.type === "location")
        if (locationAttachment?.payload?.coordinates) {
          const { lat, long: lng } = locationAttachment.payload.coordinates
          const reply = await processLocation(senderId, lat, lng)
          await sendFbMessage(senderId, reply)
          continue
        }

        // Khách gửi text
        if (!message.text) continue
        const text = message.text.trim()

        // Nếu đang chờ share vị trí mà khách gửi text → bước B
        const state = await getState(senderId)
        if (state === "awaiting_location") {
          const reply = await handleLocationRefused(senderId)
          if (reply) { await sendFbMessage(senderId, reply); continue }
        }

        const reply = await processMessage(senderId, text)
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
