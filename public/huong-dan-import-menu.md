# Hướng dẫn tạo file Excel để import menu vào Giao Nhanh Krông Pắc

## Định dạng file
- **Loại file**: `.xlsx` (Excel) hoặc `.csv`
- **Sheet**: Sheet đầu tiên
- **Dòng đầu**: Có thể có tiêu đề cột hoặc không — hệ thống tự nhận biết

---

## Cấu trúc cột (theo thứ tự từ trái sang phải)

| Cột | Tên cột | Bắt buộc | Mô tả |
|-----|---------|----------|-------|
| A | **Menu** | Không | Nhóm nội bộ của món trong thực đơn. VD: `Món chính`, `Khai vị`, `Nước uống`, `Tráng miệng`. Dùng để phân nhóm hiển thị trong quán. |
| B | **Tên món** | **Có** | Tên đầy đủ của món ăn. VD: `Bún bò Huế`, `Cà phê sữa đá` |
| C | **Mô tả** | Không | Mô tả ngắn về món. VD: `Bún bò đặc biệt, nước dùng đậm đà` |
| D | **Giá bán** | **Có** | Giá bán ra (đơn vị: đồng). Chỉ nhập số, không cần dấu chấm hay chữ "đ". VD: `35000` |
| E | **Giá khuyến mãi** | Không | Giá sau khi giảm — phải **nhỏ hơn** Giá bán. Để trống nếu không có KM. VD: `25000` |
| F | **Badge** | Không | Nhãn nổi bật trên ảnh món. Chỉ chấp nhận 4 giá trị: `hot` · `bigsale` · `bestseller` · `new`. Để trống nếu không cần. |
| G | **Đang bán** | Không | Trạng thái hiển thị. Nhập `có` / `yes` / `1` để hiện, để trống hoặc `không` để ẩn. Mặc định: **có** |
| H | **Giờ từ** | Không | Chỉ hiện món từ giờ này. Định dạng `HH:mm`. VD: `06:00`. Để trống = bán cả ngày. |
| I | **Giờ đến** | Không | Ngừng hiện món sau giờ này. Định dạng `HH:mm`. VD: `10:00`. Để trống = bán cả ngày. |
| J | **Sizes** | Không | Các kích cỡ, cách nhau bằng dấu phẩy. Định dạng: `TênSize:Giá`. VD: `Nhỏ:20000,Vừa:25000,Lớn:30000` |
| K | **Toppings** | Không | Các topping, cách nhau bằng dấu chấm phẩy `;`. Định dạng: `TênTopping:Giá`. VD: `Thêm trứng:5000;Thêm thịt:10000` |

---

## Ví dụ file Excel mẫu

| Menu | Tên món | Mô tả | Giá bán | Giá KM | Badge | Đang bán | Giờ từ | Giờ đến | Sizes | Toppings |
|------|---------|-------|---------|--------|-------|----------|--------|---------|-------|----------|
| Món chính | Bún bò Huế | Nước dùng đậm đà, thịt bắp | 35000 | | hot | có | | | | |
| Món chính | Bún riêu cua | | 30000 | 25000 | bigsale | có | | | | |
| Món chính | Cơm sườn bì | Cơm tấm đặc biệt | 45000 | | | có | | | | |
| Khai vị | Chả giò | 3 cái / phần | 20000 | | | có | | | | |
| Nước uống | Cà phê sữa đá | | 25000 | | bestseller | có | 06:00 | 11:00 | Nhỏ:20000,Lớn:25000 | Thêm đường:0;Ít đá:0 |
| Nước uống | Trà đá | | 5000 | | | có | | | | |
| Tráng miệng | Chè đậu xanh | | 15000 | | new | có | 14:00 | 20:00 | | |

---

## Lưu ý quan trọng

### Giá
- Chỉ nhập **số nguyên**, không có dấu phân cách. VD: `35000` ✅ — `35.000` ❌
- Giá khuyến mãi phải **nhỏ hơn** giá bán thì mới hiện badge giảm giá

### Badge
| Giá trị | Hiển thị |
|---------|---------|
| `hot` | 🔥 HOT |
| `bigsale` | ⚡ BIG SALE |
| `bestseller` | ⭐ BÁN CHẠY |
| `new` | ✨ MỚI |

### Giờ bán (Giờ từ / Giờ đến)
- Dùng khi muốn món chỉ hiện vào khung giờ nhất định (VD: điểm tâm chỉ bán buổi sáng)
- Để **cả hai ô trống** = bán cả ngày (phổ biến nhất)
- Hỗ trợ qua đêm: VD `Giờ từ: 20:00` · `Giờ đến: 02:00`

### Sizes (kích cỡ)
- Định dạng: `TênSize:Giá` — cách nhau bằng dấu **phẩy**
- VD: `S:20000,M:25000,L:30000`
- Nếu không có kích cỡ: để trống

### Toppings
- Định dạng: `TênTopping:Giá` — cách nhau bằng dấu **chấm phẩy**
- VD: `Thêm trứng:5000;Thêm thịt:10000;Không hành:0`
- Topping miễn phí: để giá là `0`

---

## Cột Menu — gợi ý nhóm phổ biến

| Loại quán | Gợi ý nhóm Menu |
|-----------|----------------|
| Bún/Phở/Mì | Bún, Phở, Mì, Hủ tiếu, Nước uống |
| Cơm | Cơm, Món phụ, Súp, Nước uống |
| Cà phê | Cà phê, Trà, Sinh tố, Bánh ngọt |
| Nhậu | Khai vị, Món nướng, Lẩu, Bia & Nước |
| FastFood | Burger, Gà, Khoai tây, Nước uống |
| Ăn vặt | Món mặn, Món ngọt, Đồ uống |

---

## Câu hỏi thường gặp

**Q: File có cần đúng thứ tự cột không?**  
A: **Có.** Hệ thống đọc theo vị trí cột (A, B, C...), không đọc theo tên tiêu đề.

**Q: Dòng đầu tiên có phải là tiêu đề không?**  
A: Không bắt buộc. Nếu dòng đầu có chữ "tên/món/menu/category" thì hệ thống tự bỏ qua. Nếu không có tiêu đề, bắt đầu nhập dữ liệu từ dòng 1.

**Q: Tối đa bao nhiêu món một lần import?**  
A: Không giới hạn, nhưng khuyến nghị dưới 200 món/lần để dễ kiểm tra.

**Q: Import có ghi đè món cũ không?**  
A: Không. Import chỉ **thêm mới** — không xoá hay sửa món đã có.
