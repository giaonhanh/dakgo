# ADD FEATURE PROMPT — Giao Nhanh
> Template cho từng loại feature thường gặp

## Feature: Trang danh sách (list page)
```
[FEATURE] List page: {tên}
URL: /{path}

Data: SELECT từ {table} WHERE {condition} ORDER BY {col}
Items per page: {n} (infinite scroll | pagination)

Card shows: {field1}, {field2}, {field3}
Card action: → /{detail_path}/{id}

Empty state: "{icon} {message}" + CTA "{label}" → /{url}
Loading: Skeleton (3 cards)

Filter bar: {filter options nếu có}
```

## Feature: Form (tạo/sửa)
```
[FEATURE] Form: {tên}
URL: /{path}

Fields:
- {name}: {type} required|optional — validation: {rule}
- {name}: {type} required|optional

Submit: POST|PUT /api/{endpoint}
Success: toast "{message}" + redirect /{url}
Error: toast "{error}" + giữ nguyên form data

Style: GlassCard form · Input focus glow cam · CTA button shimmer
```

## Feature: Modal / Bottom Sheet
```
[FEATURE] Modal: {tên}
Trigger: {button/action}

Content:
- {section 1}
- {section 2}

Actions: {Primary CTA} | {Secondary/Cancel}
Animation: Framer Motion: y: [100%, 0] spring bounce:0.3
Backdrop: rgba(0,0,0,0.7) blur-sm
```

## Feature: Realtime subscription
```
[FEATURE] Realtime: {tên}
Table: {table_name}
Event: INSERT | UPDATE | DELETE | *

Filter: {column}=eq.{value}

On event:
- Update state: {action}
- Show toast: optional
- Play sound: optional (new-order.mp3)

Cleanup: removeChannel on unmount
```

## Feature: Map integration
```
[FEATURE] Map: {tên}
File: src/components/map/{Name}Client.tsx (MUST be Client Component)
Import: dynamic(() => ..., { ssr: false })

Center: {lat}, {lng} (Phước An: 12.7167, 108.0167)
Zoom: {n}
Tile: dark (cartocdn dark_all)

Markers:
- {type}: icon {emoji|custom}, onClick → {action}

Layers:
- Route line: {start} → {end} color var(--acc)
```
