import { buildShopCards } from "@/lib/bot/cards"
import { saveLocation, setState } from "@/lib/bot/storage"

const FB_PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!

async function sendFbText(recipientId: string, text: string) {
  await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FB_PAGE_TOKEN}` },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  })
}

async function sendFbTemplate(recipientId: string, elements: unknown[], intro: string) {
  if (intro) await sendFbText(recipientId, intro)
  if (elements.length === 0) return
  await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FB_PAGE_TOKEN}` },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: { template_type: "generic", elements },
        },
      },
      messaging_type: "RESPONSE",
    }),
  })
}

export async function POST(req: Request) {
  try {
    const { sender_id, lat, lng, keyword } = await req.json()
    if (!sender_id || !lat || !lng) {
      return Response.json({ ok: false, error: "Missing params" }, { status: 400 })
    }

    // Lưu vị trí
    await saveLocation(sender_id, lat, lng)
    await setState(sender_id, "ordering")

    // Tìm quán gần nhất (page 0 = 2 quán đầu)
    const cards = await buildShopCards(keyword ?? "đồ ăn", 0)

    if (!cards || cards.elements.length === 0) {
      await sendFbText(
        sender_id,
        `😔 Mình chưa tìm thấy quán nào đang mở gần bạn có "${keyword}".\nBạn muốn thử món/quán khác không?`,
      )
      return Response.json({ ok: true })
    }

    await sendFbTemplate(sender_id, cards.elements, cards.intro)
    return Response.json({ ok: true })

  } catch (err) {
    console.error("[bot/location] error:", err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
