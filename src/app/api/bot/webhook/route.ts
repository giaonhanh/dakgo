import { processMessage, processLocation, handleLocationRefused, processPostback } from "@/lib/bot/processor"
import type { BotResponse, FBCard, QuickReply, ReceiptTemplateResponse } from "@/lib/bot/cards"

const FB_PAGE_TOKEN   = process.env.FB_PAGE_ACCESS_TOKEN!
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!

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
    console.error("[fb] send error:", err.slice(0, 200))
  }
}

// Gửi text (có thể kèm quick reply chips)
async function sendText(recipientId: string, text: string, quickReplies?: QuickReply[]) {
  const message: Record<string, unknown> = { text }
  if (quickReplies?.length) message.quick_replies = quickReplies
  await fbPost({ recipient: { id: recipientId }, message, messaging_type: "RESPONSE" })
}

// Gửi card carousel (Generic Template)
async function sendCards(recipientId: string, elements: FBCard[], intro?: string) {
  if (intro) await sendText(recipientId, intro)
  if (!elements.length) return
  await fbPost({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: elements.map(el => ({
            title:     el.title,
            subtitle:  el.subtitle,
            image_url: el.image_url,
            buttons:   el.buttons,
          })),
        },
      },
    },
    messaging_type: "RESPONSE",
  })
}

// Button Template — nút to hơn quick replies, không tự mất
async function sendButtonTemplate(
  recipientId: string,
  text: string,
  buttons: Array<{ type: string; title: string; payload?: string; url?: string }>,
) {
  await fbPost({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "button", text, buttons },
      },
    },
    messaging_type: "RESPONSE",
  })
}

// Receipt Template — hóa đơn đẹp cho đơn đồ ăn
async function sendReceiptTemplate(recipientId: string, r: ReceiptTemplateResponse) {
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ"

  const addressParts = r.delivery_address
    ? r.delivery_address.split(",").map(s => s.trim())
    : []

  await fbPost({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type:  "receipt",
          recipient_name: r.recipient_name,
          order_number:   r.order_number,
          currency:       "VND",
          payment_method: r.payment_method,
          timestamp:      r.timestamp ?? Math.floor(Date.now() / 1000),
          elements: r.elements.map(el => ({
            title:     el.title,
            quantity:  el.quantity,
            price:     el.price / 1000,  // receipt template dùng đơn vị nhỏ hơn (k)
            currency:  "VND",
            subtitle:  el.subtitle,
            image_url: el.image_url,
          })),
          address: addressParts.length >= 2 ? {
            street_1: addressParts[0],
            city:     addressParts[1] ?? "Phước An",
            state:    "Đắk Lắk",
            country:  "VN",
            postal_code: "630000",
          } : undefined,
          summary: {
            subtotal:      r.subtotal / 1000,
            shipping_cost: r.shipping_cost / 1000,
            total_cost:    r.total_cost / 1000,
          },
        },
      },
    },
    messaging_type: "RESPONSE",
  })
}

async function sendWebviewButton(recipientId: string, text: string, buttonTitle: string, url: string, quickReplies?: QuickReply[]) {
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
      ...(quickReplies?.length ? { quick_replies: quickReplies } : {}),
    },
    messaging_type: "RESPONSE",
  })
}

async function sendBotResponse(recipientId: string, response: BotResponse | string) {
  if (typeof response === "string") {
    await sendText(recipientId, response)
    return
  }

  switch (response.type) {
    case "cards":
      await sendCards(recipientId, response.elements, response.intro)
      break

    case "button_template":
      await sendButtonTemplate(recipientId, response.text, response.buttons)
      break

    case "receipt_template":
      await sendReceiptTemplate(recipientId, response as ReceiptTemplateResponse)
      // Sau receipt gửi thêm text + quick reply để user dễ thao tác tiếp
      await sendText(
        recipientId,
        "🛵 Tài xế sẽ nhận đơn và liên hệ bạn sớm!\n🙏 Cảm ơn đã dùng DakGo",
        [
          { content_type: "text", title: "🔄 Đặt thêm", payload: "NEW_ORDER" },
          { content_type: "text", title: "📞 Hỗ trợ",   payload: "ESCALATE" },
        ],
      )
      break

    case "webview_button":
      await sendWebviewButton(recipientId, response.text, response.buttonTitle, response.url)
      break

    case "text_with_webview":
      await sendText(recipientId, response.content)
      await sendWebviewButton(recipientId, "", response.buttonTitle, response.url, response.quick_replies)
      break

    case "text":
    default:
      await sendText(recipientId, (response as { content: string }).content, (response as { quick_replies?: QuickReply[] }).quick_replies)
      break
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
          quick_reply?: { payload: string }
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

        // Quick reply — dùng payload thay vì text (tránh emoji/title gây nhầm)
        if (message.quick_reply?.payload) {
          const reply = await processPostback(senderId, message.quick_reply.payload)
          await sendBotResponse(senderId, reply)
          continue
        }

        if (!message.text) continue
        const text = message.text.trim()

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
