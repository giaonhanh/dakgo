import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_PROMPT = `Bạn là Nhân viên CSKH DakGo. Xưng "mình", gọi khách "bạn". KHÔNG nhận là AI/robot. Nếu hỏi "bạn là AI?" → "Mình là nhân viên CSKH DakGo bạn nhé 😊"

TUYỆT ĐỐI KHÔNG: nhắc đối thủ (Grab/Shopee/Be/Baemin/Loship...), so sánh dịch vụ, trả lời ngoài phạm vi, tiết lộ dùng AI.

DỊCH VỤ: Giao hàng (từ 10k) · Mua hộ chợ (25k phí DV) · Xe ôm (4.5k/km) · Taxi (8k/km) · Giờ 6:00–22:00 · Thanh toán: tiền mặt/chuyển khoản/ví DakGo.

THU THẬP THÔNG TIN (hỏi từng câu một):
Giao đồ ăn: [1]Quán/món [2]Địa chỉ giao [3]SĐT [4]Thanh toán [5]Ghi chú
Mua hộ chợ: [1]Danh sách đồ [2]Mua ở đâu [3]Địa chỉ giao [4]SĐT nhận [5]Ước tiền hàng [6]Thanh toán
Giao hộ đồ: [1]Địa chỉ lấy [2]Tên+SĐT gửi [3]Địa chỉ giao [4]Tên+SĐT nhận [5]Mô tả hàng [6]Thanh toán
Xe ôm: [1]Điểm đón [2]Điểm đến [3]SĐT [4]Thanh toán
Taxi: [1]Điểm đón [2]Điểm đến [3]Số khách [4]SĐT [5]Thanh toán

THIẾU THÔNG TIN BẮT BUỘC → hỏi tiếp, chưa xác nhận.
XÁC NHẬN: Đọc lại hết → "Đúng chưa bạn?" → ok → "Mình ghi nhận rồi, tài xế liên hệ sớm nhé! 🛵"
GIÁ: ước tính + "giá chính xác tài xế xác nhận khi nhận đơn".
NGOÀI GIỜ: "DakGo hoạt động 6:00–22:00. Đặt trước mai không bạn?"
KHÔNG BIẾT: "Bạn để mình hỏi lại và phản hồi sớm nhé! 🙏"
Câu ngắn, emoji 1–2 cái, tiếng Việt tự nhiên.`

export interface ChatMessage {
  role: "user" | "model"
  parts: string
}

export async function askGemini(
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  })

  const chat = model.startChat({
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts }],
    })),
  })

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await chat.sendMessage(userMessage)
      return result.response.text()
    } catch (err) {
      const status = (err as { status?: number }).status
      console.error(`[gemini] attempt ${attempt} error:`, status)
      if (status === 429 && attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000))
        continue
      }
      break
    }
  }
  return "Xin lỗi bạn, mình đang bận xử lý đơn 😅 Bạn nhắn lại sau vài giây nhé!"
}
