import { processMessage } from "@/lib/bot/processor"
import type { BotResponse, FBCard, QuickReply, ReceiptTemplateResponse } from "@/lib/bot/cards"

const FB_PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!

async function fbPost(body: unknown) {
  const res = await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FB_PAGE_TOKEN}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error("[bot/address] fb send error:", await res.text().catch(() => ""))
}

async function sendText(recipientId: string, text: string, quickReplies?: QuickReply[]) {
  const message: Record<string, unknown> = { text }
  if (quickReplies?.length) message.quick_replies = quickReplies
  await fbPost({ recipient: { id: recipientId }, message, messaging_type: "RESPONSE" })
}

async function sendBotResponse(recipientId: string, response: BotResponse) {
  switch (response.type) {
    case "text":
      await sendText(recipientId, response.content, response.quick_replies)
      break

    case "button_template":
      await fbPost({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: { template_type: "button", text: response.text, buttons: response.buttons },
          },
        },
        messaging_type: "RESPONSE",
      })
      break

    case "cards":
      if (response.intro) await sendText(recipientId, response.intro)
      if (response.elements?.length) {
        await fbPost({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements: (response.elements as FBCard[]).map(el => ({
                  title: el.title, subtitle: el.subtitle,
                  image_url: el.image_url, buttons: el.buttons,
                })),
              },
            },
          },
          messaging_type: "RESPONSE",
        })
      }
      break

    case "text_with_webview":
      await sendText(recipientId, response.content)
      await fbPost({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "👇 Nhấn nút bên dưới để xác định vị trí:",
              buttons: [{ type: "web_url", url: response.url, title: response.buttonTitle, webview_height_ratio: "compact" }],
            },
          },
          ...(response.quick_replies?.length ? { quick_replies: response.quick_replies } : {}),
        },
        messaging_type: "RESPONSE",
      })
      break

    default:
      await sendText(recipientId, (response as { content?: string }).content ?? "Đã nhận địa chỉ!")
  }
}

export async function POST(req: Request) {
  try {
    const { sender_id, address } = await req.json()
    if (!sender_id || !address) {
      return Response.json({ ok: false, error: "Missing params" }, { status: 400 })
    }

    // Xử lý địa chỉ qua state machine chuẩn — tự lưu vào collected_data đúng field
    const response = await processMessage(sender_id, address)
    await sendBotResponse(sender_id, response)

    return Response.json({ ok: true })
  } catch (err) {
    console.error("[bot/address] error:", err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
