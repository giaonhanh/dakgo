# NEW SESSION PROMPT — Giao Nhanh
> Paste prompt này vào đầu mỗi session mới để khởi động nhanh

## Prompt (copy toàn bộ)
```
Load context: AI-System/agents/master-context.md
Load tracker: AI-System/context/phase-tracker.md

Current task: {mô tả task của bạn}

Rules reminder:
- TypeScript strict, no any
- Colors: CSS vars only
- Mobile-first (375px)
- Supabase: try/catch + toast

Proceed.
```

---

## Prompt tạo page mới
```
Load: AI-System/agents/master-context.md

Create page: {URL path}
Role: customer | driver | merchant | admin

Sections needed:
1. {section 1}
2. {section 2}
3. {section 3}

Data sources:
- {table/API 1}
- {table/API 2}

UI style: match FloatingBottomMenu.tsx dark glassmorphism
Output: complete page.tsx + any sub-components needed
```

## Prompt fix bug
```
Load: AI-System/agents/master-context.md

Bug in: {file path}
Error: {error message hoặc mô tả}
Steps to reproduce: {steps}

Fix only the bug. No refactor. Show diff.
```

## Prompt review trước deploy
```
Load: AI-System/agents/master-context.md
Load: AI-System/agents/qa-agent.md
Load: AI-System/agents/responsive-agent.md

Review files changed in last commit.
Run all checklists.
Output: GO | NO-GO with issues list.
```

---

## Token-saving tips
1. **Load only what you need**: master-context luôn load, còn lại chỉ khi cần
2. **Batch requests**: "Tạo 3 components sau trong 1 lần: A, B, C"
3. **Reference don't repeat**: "Dùng pattern như FloatingBottomMenu.tsx"
4. **Scope rõ ràng**: "Chỉ sửa file này, không sửa file khác"
5. **Output format**: "Chỉ output code, không giải thích"
