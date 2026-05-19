# UPDATE UI PROMPT — Giao Nhanh
> Prompt chuẩn để update/tạo mới UI component. Token-optimized.

## Cách dùng
1. Load `master-context.md` trước
2. Copy prompt bên dưới, điền `{}` placeholders
3. Paste vào Claude

---

## Template: Tạo component mới
```
[UI-CREATE] {ComponentName}
Path: src/components/{folder}/{ComponentName}.tsx

Props: {prop1}: {type}, {prop2}: {type}

Design:
- Container: GlassCard · {size}
- Colors: --acc cam · --bg-secondary
- Animation: {none|framer|css-shimmer|spring}

Data: {static|props|supabase query}

Output: Full TSX component, no comments, strict TS
```

## Template: Update component hiện có
```
[UI-UPDATE] {ComponentName}
File: {path}
Lines: {n}-{m}

Change:
- FROM: {mô tả hiện tại}
- TO: {mô tả muốn}

Constraint: giữ nguyên animation, chỉ đổi {layout|color|data}
```

## Template: Fix UI bug
```
[UI-FIX] {ComponentName}
Bug: {mô tả}
Screenshot: AI-System/screenshots/{name}.png

Expected: {behavior mong muốn}
Viewport: {375px|390px}

Fix only the bug. No refactor.
```

---

## Design patterns tái sử dụng

### GlassCard variants
```tsx
// Standard
<div className="bg-[var(--glass)] border border-[var(--border)] rounded-[14px] backdrop-blur-[12px]">

// Accent (cam nhạt)
<div className="bg-[rgba(255,107,0,0.07)] border border-[var(--border)] rounded-[14px]">

// Strong accent
<div className="bg-[rgba(255,107,0,0.07)] border border-[var(--border-strong)] rounded-[14px]">
```

### CTA Button
```tsx
<button className="relative overflow-hidden rounded-[14px] h-[48px] w-full
  bg-gradient-to-r from-[#FF6B00] via-[#FF8C00] to-[#FFB347]
  text-white font-bold active:scale-[0.97] transition-transform">
  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
    animate-[shimmer_2.5s_infinite] w-[35%]" />
  <span className="relative z-10">{children}</span>
</button>
```

### Price display
```tsx
<span className="bg-gradient-to-r from-[#FF6B00] to-[#FFB347] bg-clip-text text-transparent font-bold">
  {formatPrice(price)}
</span>
```

### Section header
```tsx
<div className="flex items-center justify-between mb-3">
  <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
  <button className="text-[11px] text-[var(--acc)]">Xem tất cả →</button>
</div>
```
