# WORKFLOW GUIDE — Giao Nhanh AI System
> Hướng dẫn sử dụng hệ thống AI workflow hàng ngày

## Cấu trúc thư mục
```
AI-System/
├── agents/
│   ├── master-context.md    ← LUÔN load đầu tiên (300 tokens)
│   ├── qa-agent.md          ← Load khi review/check code
│   └── responsive-agent.md  ← Load khi test UI layout
├── context/
│   ├── component-checklist.md  ← Checklist đầy đủ cho component
│   ├── api-routes.md           ← Reference tất cả API endpoints
│   └── phase-tracker.md        ← Trạng thái hiện tại của dự án
├── prompts/
│   ├── new-session.md    ← Template bắt đầu session mới
│   ├── update-ui.md      ← Template tạo/sửa UI component
│   ├── add-feature.md    ← Template cho các loại feature
│   └── test-checkout.md  ← Flow test đặt hàng end-to-end
├── mockups/
│   ├── page-flows.md  ← Sơ đồ điều hướng
│   └── ui-specs.md    ← ASCII mockup từng page
├── reports/
│   └── workflow-guide.md  ← File này
└── screenshots/           ← Lưu screenshot khi bug report
```

---

## Daily Workflow

### Bắt đầu session mới
1. Copy prompt từ `prompts/new-session.md`
2. Điền task cụ thể vào `{mô tả task}`
3. Paste vào Claude → bắt đầu làm

### Tạo component mới
1. Load `master-context.md`
2. Dùng template từ `prompts/update-ui.md`
3. Sau khi tạo xong → chạy qa-agent checklist
4. Test viewport 375px, 390px

### Fix bug
1. Screenshot bug → lưu vào `screenshots/`
2. Dùng template "Fix UI bug" từ `prompts/update-ui.md`
3. Attach screenshot path vào prompt

### Trước khi commit
```
1. QA check: qa-agent.md checklist
2. Responsive check: responsive-agent.md
3. Update phase-tracker.md
```

---

## Token optimization rules

### Rule 1: Progressive loading
```
Session ngắn (< 1 task):  master-context.md ONLY
Session dài (nhiều tasks): master-context + phase-tracker
Code review session:       master-context + qa-agent + component-checklist
```

### Rule 2: Reference, không lặp
```
❌ SAI: "Dùng màu #FF6B00 cam cho button..."
✅ ĐÚNG: "Dùng --acc var cho button (xem master-context.md)"
```

### Rule 3: Batch operations
```
❌ SAI: 3 prompts riêng cho 3 components
✅ ĐÚNG: 1 prompt "Tạo 3 components: ProductCard, ShopCard, CategoryChip"
```

### Rule 4: Output constraints
```
Khi không cần giải thích:
"Output: code only, no explanation, no comments"

Khi cần ngắn:
"Output: diff only, show changed lines"
```

### Rule 5: Scope explicit
```
"Chỉ sửa file src/components/home/NearbyShops.tsx"
"Không tạo file mới"
"Không sửa types/index.ts"
```

---

## Antigravity-specific tips

### Context window management
- File này đã tối ưu để mỗi agent file < 500 tokens
- master-context.md ~ 300 tokens (đủ fit vào context limit)
- Không load toàn bộ CLAUDE.md vào mỗi prompt — quá dài

### Reusable patterns
Mọi pattern UI đã extract vào `prompts/update-ui.md`:
- GlassCard variants
- CTA Button với shimmer
- Price display gradient
- Section header

### Component-based workflow
Mỗi component = 1 file riêng = 1 unit test
Không viết component dài > 200 lines — split ra

---

## Lệnh Git workflow
```bash
# Feature mới
git checkout -b feat/shop-page
# ... code ...
git add src/app/(customer)/shop/[shopId]/
git commit -m "feat(customer): add shop page with product grid"

# Bug fix
git checkout -b fix/cart-voucher-validation
git commit -m "fix(cart): validate voucher expiry before applying"

# Update AI system
git add AI-System/
git commit -m "docs(ai): update phase tracker + add responsive agent"
```
