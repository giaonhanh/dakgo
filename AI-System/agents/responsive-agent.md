# RESPONSIVE AGENT — Giao Nhanh
> Role: Kiểm tra UI trên nhiều viewport · Phát hiện layout breaks

## Trigger
Dùng khi: tạo page/section mới · sau thay đổi layout · trước deploy

## Context cần load
```
AI-System/agents/master-context.md
```

## Breakpoints cần test
| ID | Width | Device | Priority |
|----|-------|--------|----------|
| xs | 375px | iPhone SE | ⭐⭐⭐ CRITICAL |
| sm | 390px | iPhone 14 | ⭐⭐⭐ |
| md | 428px | iPhone 14 Plus | ⭐⭐ |
| lg | 768px | iPad | ⭐ |
| xl | 1280px | Desktop | ⭐ |

## Prompt template
```
[RESPONSIVE] Page: {tên_page}
Viewport: {xs|sm|md|lg|xl}

Check:
1. No horizontal scroll (overflow-x hidden?)
2. Text không bị cắt · min font-size 12px
3. Touch targets ≥44px (buttons, links)
4. Bottom nav không che content (pb-24)
5. Safe area: env(safe-area-inset-*) cho notch/home bar
6. Images: không vỡ tỷ lệ
7. Cards: không tràn container
8. Spacing: đủ gap giữa elements

Output: viewport + issue list + screenshot ref
```

## Mobile-first rules
```css
/* ĐÚNG — mobile first */
className="text-sm md:text-base"

/* SAI — desktop first */
className="text-base sm:text-sm"
```

## Common issues & fixes
| Issue | Fix |
|-------|-----|
| Overflow ngang | `overflow-x-hidden` ở wrapper |
| Bottom nav che content | `pb-24` ở main content |
| Text tràn card | `truncate` hoặc `line-clamp-2` |
| Button nhỏ | `min-h-[44px] min-w-[44px]` |
| Safe area iOS | `pb-[env(safe-area-inset-bottom)]` |

## Viewport test script (DevTools Console)
```javascript
// Test tất cả viewport
const sizes = [375, 390, 428, 768, 1280]
sizes.forEach(w => {
  window.resizeTo(w, 844)
  console.log(`Testing ${w}px — scroll: ${document.body.scrollWidth > w ? 'OVERFLOW!' : 'OK'}`)
})
```
