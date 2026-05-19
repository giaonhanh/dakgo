# COMPONENT CHECKLIST — Giao Nhanh
> Load cùng qa-agent.md để review component

## Pre-build checklist (trước khi code)
- [ ] Props interface đầy đủ trong `src/types/index.ts`?
- [ ] Component đặt đúng folder? (`ui/` | `home/` | `shop/` | `navigation/`)
- [ ] Cần `'use client'` không? (hooks, browser API, event handlers)
- [ ] Data fetch ở Server Component được không? (performance)

## TypeScript checklist
- [ ] Không có `any` — dùng `unknown` hoặc type cụ thể
- [ ] Props interface export nếu dùng ở nơi khác
- [ ] Event handlers typed: `(e: React.MouseEvent<HTMLButtonElement>)`
- [ ] Supabase response typed: `const { data }: { data: Product[] | null }`

## Styling checklist
- [ ] Chỉ dùng CSS vars: `var(--acc)`, `var(--bg-primary)`, etc.
- [ ] Không hardcode màu: `#FF6B00` → dùng `var(--acc)` hoặc Tailwind token
- [ ] Mobile-first: `text-sm` → `md:text-base` (không ngược lại)
- [ ] Touch target: button/link `min-h-[44px]`
- [ ] Scroll containers: `overflow-x-auto scrollbar-none`

## Animation checklist
- [ ] Phức tạp (layout shift, spring): Framer Motion
- [ ] Đơn giản (pulse, shimmer, radar): CSS `@keyframes` trong globals.css
- [ ] `layoutId` unique toàn app (tránh conflict)
- [ ] `whileTap={{ scale: 0.97 }}` cho buttons

## Data/Async checklist
- [ ] Loading state (Skeleton component)
- [ ] Error state (toast + retry hoặc empty state)
- [ ] Empty state (illustration + CTA)
- [ ] Mọi Supabase call có `try/catch`
- [ ] Không leak subscription (cleanup trong `useEffect` return)

## Performance checklist
- [ ] `next/image` cho mọi ảnh content
- [ ] `dynamic import ssr:false` cho Leaflet
- [ ] `useMemo` / `useCallback` nếu props qua nhiều re-renders
- [ ] Không fetch data trong client component nếu Server Component làm được

## Accessibility checklist
- [ ] `aria-label` cho icon-only buttons
- [ ] `alt` text cho images (`alt=""` nếu decorative)
- [ ] Focus visible styles không bị ẩn
