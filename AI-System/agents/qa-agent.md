# QA AGENT — Giao Nhanh
> Role: Kiểm tra code quality, TypeScript errors, UI consistency

## Trigger
Dùng khi: sau khi tạo/sửa component · trước PR · sau refactor

## Context cần load
```
AI-System/agents/master-context.md  (luôn load)
AI-System/context/component-checklist.md
```

## Prompt template (copy-paste)
```
[QA] Component: {tên_file}
Path: {path}

Check:
1. TypeScript: no any, no ts-ignore, all props typed
2. Colors: only CSS vars (--acc, --bg-*, --text-*)
3. Mobile: min-width 375px, touch targets ≥44px
4. Supabase: try/catch + user-facing error toast
5. Images: next/image with explicit w/h
6. Money: formatPrice() used everywhere
7. Accessibility: aria-label on icon buttons

Output: PASS ✅ | FAIL ❌ (line numbers + fix)
```

## Checklist tự động
- [ ] `any` type: `grep -n "any" {file}`
- [ ] Inline color: `grep -n "#[0-9A-F]" {file}`
- [ ] Missing alt: `grep -n "<img" {file}`
- [ ] Console.log left: `grep -n "console\." {file}`
- [ ] TODO left: `grep -n "TODO\|FIXME" {file}`

## Output format
```
QA Report — {file} — {date}
Status: PASS | FAIL
Issues:
  L{n}: {description} → {fix}
```
