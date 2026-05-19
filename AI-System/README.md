# AI-System — Giao Nhanh
> Production-ready AI workflow cho app delivery Phước An

## Quick Start

### Session mới → copy prompt này:
```
Load: AI-System/agents/master-context.md

Task: {mô tả task}
Proceed.
```

### Tạo UI component → copy prompt này:
```
Load: AI-System/agents/master-context.md

[UI-CREATE] {ComponentName}
Path: src/components/{folder}/
Props: {props}
Design: GlassCard · dark glassmorphism · --acc cam
Output: TSX only, strict TS, no comments
```

---

## File map (load theo nhu cầu)

| File | Khi nào load | ~Tokens |
|------|-------------|---------|
| `agents/master-context.md` | **LUÔN** | ~300 |
| `context/phase-tracker.md` | Bắt đầu session | ~200 |
| `agents/qa-agent.md` | Review code | ~250 |
| `agents/responsive-agent.md` | Test UI | ~200 |
| `context/component-checklist.md` | Deep review | ~300 |
| `context/api-routes.md` | Build API | ~200 |
| `prompts/update-ui.md` | Tạo/sửa UI | ~250 |
| `prompts/add-feature.md` | Feature mới | ~200 |
| `prompts/test-checkout.md` | Test flow | ~300 |
| `mockups/ui-specs.md` | Design reference | ~400 |
| `mockups/page-flows.md` | Navigation | ~200 |

**Max recommended per session: master-context + 2-3 files = ~900 tokens overhead**

---

## Agents

### QA Agent — `agents/qa-agent.md`
Kiểm tra TypeScript, màu sắc, mobile, accessibility, performance

### Responsive Agent — `agents/responsive-agent.md`
Test 375px → 1280px, phát hiện overflow, touch targets, safe area

---

## Workflow nhanh

```
Sáng: Load master-context + phase-tracker → pick task → code
Code: Load update-ui.md template → generate component
Review: Load qa-agent.md → chạy checklist
Deploy: Load responsive-agent.md → test 375px → commit
```

---

_Maintained by: AI-System workflow | Stack: Next.js 15 + Supabase + Tailwind_
