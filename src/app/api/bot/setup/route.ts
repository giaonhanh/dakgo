import { setupMessengerProfile } from "@/lib/bot/messenger-setup"

// GET /api/bot/setup?token=SETUP_SECRET → thiết lập Messenger Profile
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("token")
  if (secret !== process.env.BOT_SETUP_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await setupMessengerProfile(process.env.FB_PAGE_ACCESS_TOKEN!)
    return Response.json({ ok: true, result })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
