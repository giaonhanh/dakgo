/**
 * Tạo file mẫu import menu với dropdown validation thật (dùng exceljs).
 * Chạy: node scripts/generate-menu-template.mjs
 * Output: public/template_nhap_menu_giao_nhanh.xlsx
 */
import ExcelJS from "exceljs"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT = path.join(__dirname, "../public/template_nhap_menu_giao_nhanh.xlsx")

const CATEGORIES = [
  "Bún - Phở - Mì",
  "Cơm - Cơm hộp",
  "Cà phê - Trà sữa",
  "Gà rán - FastFood",
  "Bánh mì - Sandwich",
  "Ăn vặt - Vỉa hè",
  "Nhậu - Bia hơi",
  "Chay - Healthy",
  "Lẩu - Nướng - BBQ",
  "Bánh - Tráng miệng",
  "Hải sản - Đặc sản",
  "Khác",
]

const HEADERS = [
  "SĐT Quán *",
  "Danh mục 1 *",
  "Danh mục 2",
  "Danh mục 3",
  "Nhóm menu",
  "Tên Món *",
  "Mô Tả",
  "Giá Bán * (đ)",
  "Size và Giá",
  "Topping và Giá",
]

const SAMPLE_ROWS = [
  ["0901234567", "Cơm - Cơm hộp", "Gà rán - FastFood", "", "Cơm", "Cơm gà nướng", "Cơm gà nướng mật ong thơm ngon", 45000, "Nhỏ:0, Lớn:10000", "Thêm trứng:5000"],
  ["0901234567", "Cơm - Cơm hộp", "", "", "Cơm", "Cơm sườn bì chả", "Đầy đủ topping", 50000, "", ""],
  ["0901234567", "Cà phê - Trà sữa", "", "", "Đồ uống", "Cà phê sữa đá", "Phin truyền thống", 25000, "M:0, L:5000", "Thêm đường:0"],
]

async function main() {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Giao Nhanh"
  wb.lastModifiedBy = "Giao Nhanh System"
  wb.created = new Date()
  wb.modified = new Date()

  // ── Sheet 1: Danh sách món ──────────────────────────────────────────────────
  const ws = wb.addWorksheet("📋 Danh sách món", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  // Cột widths
  ws.columns = [
    { key: "A", width: 16 },  // SĐT
    { key: "B", width: 22 },  // Cat 1
    { key: "C", width: 22 },  // Cat 2
    { key: "D", width: 22 },  // Cat 3
    { key: "E", width: 18 },  // Nhóm menu
    { key: "F", width: 28 },  // Tên món
    { key: "G", width: 32 },  // Mô tả
    { key: "H", width: 14 },  // Giá
    { key: "I", width: 24 },  // Size
    { key: "J", width: 24 },  // Topping
  ]

  // Header row
  const headerRow = ws.addRow(HEADERS)
  headerRow.height = 24
  headerRow.eachCell((cell, colNum) => {
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF6B00" },
    }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false }
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFFFD580" } },
    }
  })

  // Sample rows
  for (const rowData of SAMPLE_ROWS) {
    const row = ws.addRow(rowData)
    row.height = 20
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 9, color: { argb: "FF000000" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      }
      cell.alignment = { vertical: "middle" }
    })
  }

  // ── Dropdown validation cho B, C, D (rows 2→2000) ─────────────────────────
  const catFormula = `"${CATEGORIES.join(",")}"`

  for (let r = 2; r <= 2000; r++) {
    const cellB = ws.getCell(`B${r}`)
    const cellC = ws.getCell(`C${r}`)
    const cellD = ws.getCell(`D${r}`)

    const validation = {
      type: "list",
      allowBlank: true,
      formulae: [catFormula],
      showDropDown: false,           // false = hiện mũi tên dropdown
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Danh mục không hợp lệ",
      error: "Vui lòng chọn từ danh sách",
      showInputMessage: true,
      promptTitle: "Chọn danh mục",
      prompt: "Chọn một trong các danh mục có sẵn",
    }

    cellB.dataValidation = validation
    cellC.dataValidation = validation
    cellD.dataValidation = validation
  }

  // ── Sheet 2: Hướng dẫn ────────────────────────────────────────────────────
  const guide = wb.addWorksheet("📖 Hướng dẫn")
  guide.columns = [{ key: "A", width: 80 }]

  const guideLines = [
    ["📋 HƯỚNG DẪN NHẬP MENU - GIAO NHANH"],
    [""],
    ["CẤU TRÚC FILE (10 cột):"],
    ["A - SĐT Quán *      : Số điện thoại đăng ký quán (lặp mỗi dòng). Hệ thống tự tìm quán theo SĐT."],
    ["B - Danh mục 1 *    : Chọn từ dropdown (bắt buộc)."],
    ["C - Danh mục 2      : Chọn từ dropdown (tuỳ chọn - để trống nếu không có)."],
    ["D - Danh mục 3      : Chọn từ dropdown (tuỳ chọn - để trống nếu không có)."],
    ["E - Nhóm menu       : Tên nhóm hiển thị trong trang quán (VD: Cơm, Bún, Đồ uống)."],
    ["F - Tên Món *       : Tên sản phẩm (bắt buộc)."],
    ["G - Mô Tả           : Mô tả ngắn (tuỳ chọn)."],
    ["H - Giá Bán * (đ)  : Giá bán lẻ, nhập số nguyên (bắt buộc)."],
    ["I - Size và Giá     : VD: Nhỏ:0, Vừa:5000, Lớn:10000 (để trống nếu không có size)."],
    ["J - Topping và Giá  : VD: Thêm trứng:5000, Phô mai:8000 (để trống nếu không có)."],
    [""],
    ["LƯU Ý:"],
    ["• Dòng đầu là tiêu đề — KHÔNG xóa hoặc sửa."],
    ["• Mỗi dòng = 1 sản phẩm."],
    ["• Cột B bắt buộc chọn từ danh sách sổ xuống."],
    ["• SĐT phải trùng với SĐT đã đăng ký trên hệ thống Giao Nhanh."],
    ["• Một file có thể chứa nhiều quán (nhiều SĐT khác nhau)."],
    ["• Giá nhập bằng đồng (không cần chữ 'đ' hay dấu phẩy)."],
    [""],
    ["DANH MỤC HỢP LỆ:"],
    ...CATEGORIES.map((c, i) => [`  ${i + 1}. ${c}`]),
  ]

  for (const [line] of guideLines) {
    const row = guide.addRow([line])
    if (line?.startsWith("📋") || line?.startsWith("CẤU TRÚC") || line?.startsWith("LƯU Ý") || line?.startsWith("DANH MỤC")) {
      row.getCell(1).font = { name: "Arial", bold: true, size: 11, color: { argb: "FFFF6B00" } }
    } else {
      row.getCell(1).font = { name: "Arial", size: 10, color: { argb: "FFD4B896" } }
    }
  }

  // ── Ghi file ──────────────────────────────────────────────────────────────
  const dir = path.dirname(OUTPUT)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  await wb.xlsx.writeFile(OUTPUT)
  console.log(`✅ Tạo xong: ${OUTPUT}`)
  console.log(`   Sheets: ${wb.worksheets.map(s => s.name).join(", ")}`)
  console.log(`   Dropdown: B2:D2000 (${CATEGORIES.length} danh mục)`)
}

main().catch(e => { console.error(e); process.exit(1) })
