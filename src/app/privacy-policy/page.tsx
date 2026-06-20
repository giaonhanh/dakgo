export const metadata = { title: "Chính sách quyền riêng tư — DakGo" }

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Chính sách quyền riêng tư</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Cập nhật lần cuối: 20/06/2026 — DakGo Krông Pắc</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>1. Thông tin chúng tôi thu thập</h2>
      <p>Khi bạn sử dụng dịch vụ DakGo (ứng dụng, website, Messenger chatbot), chúng tôi có thể thu thập:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Họ tên, số điện thoại, địa chỉ giao hàng</li>
        <li>Lịch sử đặt hàng và giao dịch</li>
        <li>Vị trí GPS (khi bạn cho phép) để tính phí vận chuyển</li>
        <li>Nội dung tin nhắn gửi đến Fanpage DakGo qua Messenger</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>2. Mục đích sử dụng</h2>
      <p>Thông tin thu thập chỉ được dùng để:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Xử lý và giao đơn hàng của bạn</li>
        <li>Liên hệ xác nhận đơn, thông báo trạng thái</li>
        <li>Hỗ trợ khách hàng qua chatbot Messenger</li>
        <li>Cải thiện chất lượng dịch vụ</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>3. Messenger Chatbot</h2>
      <p>
        Khi bạn nhắn tin với DakGo qua Facebook Messenger, nội dung hội thoại được lưu trữ an toàn
        để hỗ trợ trả lời tự động và cải thiện dịch vụ. Chúng tôi <strong>không</strong> chia sẻ
        nội dung tin nhắn với bên thứ ba.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>4. Chia sẻ thông tin</h2>
      <p>
        Chúng tôi <strong>không bán</strong> thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ với
        tài xế DakGo (số điện thoại, địa chỉ) để thực hiện đơn hàng.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>5. Bảo mật dữ liệu</h2>
      <p>
        Dữ liệu được lưu trữ trên hệ thống bảo mật Supabase (PostgreSQL) với mã hóa SSL.
        Chúng tôi áp dụng các biện pháp bảo mật phù hợp để bảo vệ thông tin của bạn.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>6. Quyền của bạn</h2>
      <p>Bạn có quyền:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu cá nhân</li>
        <li>Từ chối nhận thông báo khuyến mãi</li>
        <li>Yêu cầu ngừng xử lý dữ liệu</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>7. Liên hệ</h2>
      <p>
        Mọi thắc mắc về quyền riêng tư, vui lòng liên hệ:<br />
        📧 hongmy.daklak@gmail.com<br />
        📱 035 447 4474<br />
        📍 Phước An, Krông Pắc, Đắk Lắk
      </p>
    </div>
  )
}
