import { saveMessage, setState } from "@/lib/bot/storage"

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

export async function POST(req: Request) {
  try {
    const { sender_id, address } = await req.json()
    if (!sender_id || !address) {
      return Response.json({ ok: false, error: "Missing params" }, { status: 400 })
    }

    // Lưu địa chỉ vào history như thể khách tự nhập
    await saveMessage(sender_id, "user", address)
    await setState(sender_id, "ordering")

    // Gửi xác nhận + hỏi SĐT
    const reply = `📍 Địa chỉ giao: ${address}\n\n📞 Bạn cho mình số điện thoại để tài xế liên hệ nhé!`
    await saveMessage(sender_id, "model", reply)
    await sendFbText(sender_id, reply)

    return Response.json({ ok: true })
  } catch (err) {
    console.error("[bot/address] error:", err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
