import { processMessage, processLocation, handleLocationRefused, processPostback } from "@/lib/bot/processor"
import { getState } from "@/lib/bot/storage"
import type { BotResponse, FBCard } from "@/lib/bot/cards"

const FB_PAGE_TOKEN   = process.env.FB_PAGE_ACCESS_TOKEN!
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!

// Gửi tin nhắn text
async function sendText(recipientId: string, text: string) {
  await fbPost({
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  })
}

// Gửi card carousel (Generic Template)
async function sendCards(recipientId: string, elements: FBCard[], intro?: string) {
  // Gửi text intro trước
  if (intro) await sendText(recipientId, intro)

  // Gửi carousel
  await fbPost({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: elements.map(el => ({
            title: el.title,
            subtitle: el.subtitle,
            image_url: el.image_url,
            buttons: el.buttons,
          })),
        },
      },
    },
    messaging_type: "RESPONSE",
  })
}

async function fbPost(body: unknown) {
  const res = await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FB_PAGE_TOKEN}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error("[fb] send error:", err)
  }
}

async function sendWebviewButton(recipientId: string, text: string, buttonTitle: string, url: string) {
  if (text) await sendText(recipientId, text)
  await fbPost({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "👇 Nhấn nút bên dưới để xác định vị trí:",
          buttons: [{
            type: "web_url",
            url,
            title: buttonTitle,
            webview_height_ratio: "compact",
            messenger_extensions: false,
          }],
        },
      },
    },
    messaging_type: "RESPONSE",
  })
}

async function sendBotResponse(recipientId: string, response: BotResponse | string) {
  if (typeof response === "string") {
    await sendText(recipientId, response)
    return
  }
  if (response.type === "cards") {
    await sendCards(recipientId, response.elements, response.intro)
  } else if (response.type === "webview_button") {
    await sendWebviewButton(recipientId, response.text, response.buttonTitle, response.url)
  } else {
    await sendText(recipientId, response.content)
  }
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

      try {
        // Postback — khách click nút "Đặt ngay" / "Xem menu"
        if (event.postback) {
          const payload = (event.postback as { payload: string }).payload
          const reply = await processPostback(senderId, payload)
          await sendBotResponse(senderId, reply)
          continue
        }

        const message = event.message as {
          text?: string
          is_echo?: boolean
          attachments?: Array<{
            type: string
            payload: { coordinates?: { lat: number; long: number } }
          }>
        } | undefined

        if (!message || message.is_echo) continue

        // Khách share vị trí
        const locationAttachment = message.attachments?.find(a => a.type === "location")
        if (locationAttachment?.payload?.coordinates) {
          const { lat, long: lng } = locationAttachment.payload.coordinates
          const reply = await processLocation(senderId, lat, lng)
          await sendBotResponse(senderId, reply)
          continue
        }

        if (!message.text) continue
        const text = message.text.trim()

        // Đang chờ share vị trí mà khách gửi text → bước B
        const state = await getState(senderId)
        if (state === "awaiting_location") {
          const reply = await handleLocationRefused(senderId)
          if (reply) { await sendBotResponse(senderId, reply); continue }
        }

        const reply = await processMessage(senderId, text)
        await sendBotResponse(senderId, reply)

      } catch (err) {
        console.error("[bot/webhook] error:", err)
        await sendText(
          senderId,
          "Xin lỗi bạn, mình gặp sự cố nhỏ 😅 Bạn thử nhắn lại sau ít phút nhé!",
        )
      }
    }
  }
}
