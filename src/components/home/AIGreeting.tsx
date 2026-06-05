'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Weather { temp: number; code: number; rain: number }
type WKey = 'rain' | 'storm' | 'hot' | 'cold' | 'cool' | 'sunny' | 'cloudy'
type Pair = [string, string] // [prefix, highlighted food/drink]

// ── Weather classification ─────────────────────────────────────────────────────
function wClass(w: Weather): WKey {
  if (w.code >= 95 || w.rain > 5)              return 'storm'
  if (w.rain > 0.3 || (w.code >= 51 && w.code <= 82)) return 'rain'
  if (w.temp >= 34)                             return 'hot'
  if (w.temp <= 21)                             return 'cold'
  if (w.temp <= 27)                             return 'cool'
  if (w.code <= 1)                              return 'sunny'
  return 'cloudy'
}

const W_ICON: Record<WKey, string> = {
  rain: '🌧️', storm: '⛈️', hot: '🌡️',
  cold: '🥶', cool: '🌤️', sunny: '☀️', cloudy: '⛅',
}
const W_LABEL: Record<WKey, string> = {
  rain:   'Đang mưa',
  storm:  'Có dông',
  hot:    'Nắng nóng',
  cold:   'Se lạnh',
  cool:   'Mát dịu',
  sunny:  'Nắng đẹp',
  cloudy: 'Có mây',
}

// ── Suggestion pools ──────────────────────────────────────────────────────────
const TIME: Record<string, Pair[]> = {
  dawn: [ // 0–5h
    ['Thức khuya rồi, nạp năng lượng nhẹ với', 'mì gói trứng hoặc cháo lòng'],
    ['Đêm khuya bụng réo? Gọi ngay', 'bánh mì pate hoặc xôi nóng'],
    ['Giờ này cần gì ấm bụng, thử', 'súp gà hoặc cháo hành'],
    ['Khuya rồi vẫn chưa ngủ, ăn thêm', 'bánh bao chiên hoặc chả giò'],
    ['Đêm khuya xem phim cần snack, gọi', 'gà rán hoặc khoai tây chiên'],
    ['Mãi thức khuya, nạp tí năng lượng với', 'mì tôm hoặc cháo cá'],
    ['Đêm khuya cần gì comfort, có ngay', 'cháo gà hoặc phở bò nóng'],
    ['Thức để làm bài hay xem phim? Ăn thêm', 'bánh mì thịt hoặc xôi lạp xưởng'],
  ],
  early_morning: [ // 5–7h
    ['Sáng sớm tinh mơ, khai vị ngày mới với', 'phở nóng hoặc bún bò'],
    ['Trời còn mát, tranh thủ ăn sáng', 'hủ tiếu hoặc mì wonton'],
    ['Sáng sớm cần năng lượng, gọi luôn', 'cháo trắng heo quay hoặc bánh cuốn'],
    ['Khai vị ngày mới thật ngon với', 'bún riêu hoặc miến gà'],
    ['Đặt ngay để kịp ăn trước khi bận, hôm nay thử', 'xôi ngũ sắc hoặc bánh bao nhân thịt'],
    ['Sáng ra nạp ngay năng lượng với', 'cơm tấm sườn bì hoặc bánh mì pate'],
    ['Bắt đầu ngày mới từ bữa ăn sáng ngon', 'phở gà hoặc bún mọc'],
    ['Sáng sớm mát mẻ, hợp nhất là', 'xôi gà hoặc bánh mì trứng ốp la'],
  ],
  morning: [ // 7–10h
    ['Giờ vàng ăn sáng, hôm nay thử', 'phở bò hoặc bún bò Huế'],
    ['Bữa sáng ngon là có cả ngày vui, gợi ý', 'hủ tiếu Nam Vang hoặc mì xào'],
    ['Sáng sáng cần gì no lâu, chọn', 'cơm tấm sườn hoặc bánh ướt'],
    ['Ăn sáng chuẩn, ngày mới đầy năng lượng với', 'xôi gà hoặc bánh mì thịt nướng'],
    ['Đặt ăn sáng ngay để không bị trễ, hôm nay có', 'bánh mì ốp la hoặc cháo đậu xanh'],
    ['Bữa sáng chuẩn chỉnh cần có', 'cà phê sữa đá và bánh mì'],
    ['Sáng ngon miệng khởi động ngày mới với', 'bún bò hoặc phở gà'],
    ['Khai vị sáng với món yêu thích, hôm nay đặt', 'xôi lạp xưởng hoặc bánh cuốn'],
    ['Hôm nay ăn sáng gì đây? Gợi ý', 'cơm gà hoặc bún thịt nướng'],
    ['Sáng ra cần gì no bền, thử ngay', 'bánh mì chả cá hoặc mì bò kho'],
  ],
  mid_morning: [ // 10–11h
    ['Giữa buổi hơi đói, điểm tâm nhẹ với', 'bánh ngọt hoặc trà sữa'],
    ['Cơn đói giữa sáng ập đến, cần ngay', 'snack hoặc bánh mì kẹp'],
    ['Hơi đói bụng giữa buổi, gọi thêm', 'chè hoặc sữa chua trái cây'],
    ['Giữa sáng cần giải lao, thử', 'cà phê và bánh quy'],
    ['Hơi buồn miệng, gọi luôn', 'kem hoặc nước ép trái cây'],
    ['Bụng réo giữa sáng? Giải quyết nhanh với', 'bánh bao hoặc chè đậu'],
    ['Chút gì lót dạ cho tới trưa, có ngay', 'bánh ngọt hoặc bắp luộc'],
    ['Buổi sáng sắp qua, còn chưa ăn? Đặt luôn', 'xôi chiên hoặc bánh tiêu nhân đậu'],
  ],
  noon: [ // 11–13h
    ['Đúng giờ vàng bữa trưa, hôm nay ăn', 'cơm bình dân hoặc bún bò'],
    ['Trưa rồi! Nhanh tay đặt', 'cơm hộp gà hoặc cơm sườn'],
    ['Bữa trưa văn phòng chuẩn nhất là', 'cơm văn phòng hoặc bún thịt nướng'],
    ['Trưa đói mà ngại ra ngoài? Đặt ngay', 'cơm gà xối mỡ hoặc mì xào giòn'],
    ['Giờ cao điểm bữa trưa, đặt trước kịp ăn', 'phở bò hoặc hủ tiếu xào'],
    ['Trưa này cần gì ngon và no, thử', 'cơm tấm ba món hoặc bún hải sản'],
    ['Bữa trưa bổ dưỡng cần có', 'cơm canh chua cá hoặc bún mắm'],
    ['Đặt ngay kẻo hết suất, hôm nay có', 'cơm niêu hoặc cơm chiên dương châu'],
    ['Trưa nhanh, gọi món chắc bụng nhất là', 'cơm rang hoặc mì trứng'],
    ['Trưa bổ sung năng lượng với', 'cơm thập cẩm hoặc phở đặc biệt'],
  ],
  afternoon: [ // 13–15h
    ['Sau bữa trưa cần tráng miệng nhẹ, thử', 'chè thưng hoặc sữa chua'],
    ['Buổi chiều lơ mơ, cần tỉnh táo với', 'cà phê đá hoặc trà chanh'],
    ['Sau trưa hơi buồn ngủ, kích thích với', 'nước ép cam hoặc sinh tố bơ'],
    ['Tráng miệng sau trưa với', 'kem tươi hoặc chè đậu xanh'],
    ['Chiều về ngại ra ngoài, gọi luôn', 'café sữa đá hoặc trà tắc'],
    ['Bụng đang muốn gì ngọt ngọt? Thử', 'bánh ngọt hoặc yaourt dâu'],
    ['Sau giờ ăn trưa muốn gì giải nhiệt, có ngay', 'nước mía hoặc đá xay trái cây'],
    ['Chiều chớm ngủ, tỉnh táo nhanh với', 'espresso hoặc trà xanh đá'],
  ],
  late_afternoon: [ // 15–17h
    ['Chiều mát gọi gì uống nào, thử', 'trà sữa hoặc trà chanh mật ong'],
    ['Giờ này cần bổ sung năng lượng với', 'nước ép hoặc smoothie trái cây'],
    ['Chiều về cần gì thơm thơm, gợi ý', 'trà sữa kem phô mai hoặc cà phê'],
    ['Hết giờ làm, thưởng cho mình ngay', 'trà đào cam sả hoặc nước ép dưa hấu'],
    ['Chiều chiều nhâm nhi gì thì hợp, thử', 'chè trân châu hoặc kem tươi'],
    ['Chút snack chiều để nạp năng lượng, có ngay', 'khoai tây chiên hoặc gà rán'],
    ['Chiều về cần thứ gì vừa uống vừa đi, gợi ý', 'nước chanh muối hoặc trà đá'],
    ['Giải lao chiều với thức uống yêu thích', 'hồng trà sữa hoặc matcha latte'],
    ['Buổi chiều mát, gọi gì giải khát nhỉ', 'boba trà sữa hoặc đá xay xoài'],
  ],
  dusk: [ // 17–19h
    ['Chiều tà nhẹ nhàng, thưởng thức ly', 'cà phê dừa hoặc nước ép tươi'],
    ['Chiều muộn đang muốn ăn gì? Gợi ý', 'bánh mì thịt nướng hoặc xôi chiên'],
    ['Sắp giờ tối, lót dạ nhẹ với', 'bắp nướng hoặc khoai lang hầm dừa'],
    ['Chiều tối hơi đói, điểm xuyến ngay', 'bánh tráng trộn hoặc nem chua rán'],
    ['Hoàng hôn xuống, cần gì warm-up, thử', 'súp cua hoặc chè nóng'],
    ['Trước bữa tối, nhâm nhi gì nhẹ nhàng', 'gỏi cuốn hoặc bánh tráng phơi sương'],
    ['Chiều xuống cần gì ngon ngon, gọi ngay', 'bánh xèo hoặc nem cuốn tươi'],
    ['Chiều tà mát dịu, uống gì ngon nào', 'cà phê trứng hoặc nước sâm bí đao'],
  ],
  evening: [ // 19–22h
    ['Tối nay tụ họp gia đình với', 'lẩu Thái hoặc nướng BBQ'],
    ['Bữa tối thư giãn sau ngày dài, chọn', 'bún bò Huế hoặc phở đặc biệt'],
    ['Tối cuối tuần cần gì hoành tráng, thử', 'lẩu hải sản hoặc bò né'],
    ['Tối nay đặt gì ăn cùng cả nhà, có ngay', 'cơm gia đình hoặc gà nướng'],
    ['Bữa tối chuẩn nhất hôm nay là', 'bún hải sản hoặc cháo hải sản'],
    ['Tối nay thử cái gì mới lạ đi', 'bánh xèo hoặc nem lụi nướng'],
    ['Tối về đói bụng rồi, nhanh tay gọi', 'cơm tối hoặc hủ tiếu bò kho'],
    ['Bữa tối ngon cùng gia đình, đặt ngay', 'gà rán hoặc pizza phô mai'],
    ['Kết thúc ngày bằng bữa tối ngon lành với', 'cơm niêu hoặc mực xào sa tế'],
    ['Tối nay không muốn nấu, đặt luôn', 'lẩu nấm hoặc cơm chiên dương châu'],
  ],
  night: [ // 22–24h
    ['Tối muộn còn thèm gì, đặt luôn', 'mì bò kho hoặc cháo lòng'],
    ['Đêm xuống rồi, còn thức thì ăn thêm', 'bánh mì pate hoặc xôi gà'],
    ['Đêm tối nhâm nhi gì đây, thử', 'ốc hút hoặc bò viên'],
    ['Đêm khuya cần gì ấm bụng, có ngay', 'cháo bào ngư hoặc súp gà'],
    ['Tối muộn còn làm việc? Nạp năng lượng với', 'pizza hoặc gà rán'],
    ['Đêm xuống cần gì comfort food, gọi ngay', 'cơm chiên hoặc mì bò kho'],
    ['Đêm tối xem phim cần snack, thử', 'gà rán hoặc khoai tây chiên'],
    ['Muộn rồi nhưng vẫn đói, giải quyết với', 'bánh bao chiên hoặc chả giò'],
  ],
}

const WEATHER_POOL: Record<WKey, Pair[]> = {
  rain: [
    ['Trời mưa rồi, đặt về nhà cho tiện, có ngay', 'lẩu Thái hoặc cháo nóng'],
    ['Mưa to đừng ra ngoài, gọi về ngay', 'bún bò nóng hoặc phở bò'],
    ['Ngày mưa hợp nhất là ăn', 'lẩu ếch hoặc súp nóng hổi'],
    ['Trời mưa lạnh cần gì ấm bụng, đặt luôn', 'cháo gà hoặc hủ tiếu bò kho'],
    ['Mưa rào rồi, đừng ướt, gọi ngay', 'mì trứng hoặc cháo hải sản'],
    ['Trời mưa là phải ăn', 'lẩu hoặc cơm nóng canh chua'],
    ['Hôm nay mưa, ở nhà thưởng thức', 'gà kho gừng hoặc canh bí đỏ'],
    ['Mưa suốt ngày, kéo chăn đặt ngay', 'lẩu Thái hoặc cháo tím'],
    ['Mưa mà vẫn đói, đặt ngay không lo ướt', 'phở bò đặc biệt hoặc bún riêu'],
  ],
  storm: [
    ['Dông gió nguy hiểm, ở nhà đặt an toàn hơn, gợi ý', 'cháo nóng hoặc mì trứng'],
    ['Trời dông đừng ra ngoài, gọi về ngay', 'lẩu gia đình hoặc phở đặc biệt'],
    ['Bão nhỏ bên ngoài, ấm bụng bên trong với', 'cháo gà gừng hoặc bún bò nóng'],
    ['Dông tố rồi, ở nhà an toàn ăn', 'lẩu tôm hoặc cơm nóng'],
    ['Trời xấu quá, đặt về nhà thôi, hôm nay có', 'súp xương hoặc cháo đậu xanh nóng'],
  ],
  hot: [
    ['Nóng quá rồi, giải nhiệt ngay với', 'chè đá hoặc nước ép dưa hấu'],
    ['Trời nóng bức, bổ sung nước với', 'sinh tố bơ hoặc nước sâm bí đao'],
    ['Nắng gắt, cần gì mát lạnh? Có ngay', 'kem tươi hoặc đá xay trái cây'],
    ['Nóng nực thế này chỉ muốn uống', 'trà đá chanh hoặc nước mía siêu mát'],
    ['Nhiệt độ cao quá, giải nhiệt với', 'chè bưởi hoặc nước chanh muối'],
    ['Trời nóng không muốn ăn nặng, thử', 'gỏi cuốn hoặc bánh tráng trộn'],
    ['Hôm nay oi bức, chỉ muốn', 'đá bào hoặc sinh tố xoài'],
    ['Nóng như thiêu đốt, giải khát ngay với', 'nước ép cam hoặc soda chanh'],
  ],
  cold: [
    ['Trời se lạnh, hợp nhất với', 'lẩu nóng hoặc súp cua'],
    ['Lạnh rồi, ủ ấm bằng', 'cháo gà hoặc phở bò nóng hổi'],
    ['Se se lạnh thích ăn gì? Gợi ý ngay', 'bún bò Huế hoặc mì bò kho'],
    ['Trời lạnh mà ăn lẩu thì tuyệt, đặt ngay', 'lẩu Thái hoặc lẩu hải sản'],
    ['Gió lạnh thổi về, cần gì sưởi ấm, thử', 'canh chua cá hoặc bún riêu cua'],
    ['Nhiệt độ xuống thấp, đặt ngay', 'lẩu ếch hoặc cháo nóng'],
    ['Lạnh se se thích ăn gì ấm? Hôm nay có', 'súp xương hoặc mì bò hầm'],
    ['Trời se lạnh nhâm nhi', 'cà phê nóng hoặc trà gừng mật ong'],
  ],
  cool: [
    ['Trời mát dịu, thích hợp ăn', 'bún bò hoặc phở tái'],
    ['Thời tiết dễ chịu, đặt gì ngon nào', 'cơm gà hoặc bún thịt nướng'],
    ['Khí hậu mát mẻ hôm nay, thưởng thức', 'cà phê sữa và bánh mì'],
    ['Mát trời mà đặt gì đây? Gợi ý', 'gà nướng hoặc cơm rang hải sản'],
    ['Thời tiết như này ăn gì cũng ngon, thử', 'bánh xèo hoặc nem nướng'],
    ['Mát mẻ dễ ăn, gọi ngay', 'hủ tiếu Nam Vang hoặc bún hải sản'],
  ],
  sunny: [
    ['Nắng đẹp hôm nay, ăn gì tươi mát nào', 'salad hoặc gỏi cuốn tươi'],
    ['Ngày nắng đẹp hợp với', 'bún bò hoặc cơm tấm ngoài trời'],
    ['Trời nắng năng động, cần gì nạp lực', 'cơm gà hoặc bánh mì thịt nướng'],
    ['Nắng đẹp thế này mà ăn trong nhà thì phải thật ngon', 'bò né hoặc cơm niêu đặc biệt'],
    ['Trời quang mây tạnh, đặt gì hoành tráng đi', 'lẩu hải sản hoặc gà rán nguyên con'],
  ],
  cloudy: [
    ['Trời mây mát dịu, hôm nay thử', 'phở đặc biệt hoặc bún bò'],
    ['Có mây nhưng không mưa, tranh thủ đặt', 'cơm rang hoặc mì xào giòn'],
    ['Trời mây mà ngồi ăn gì ngon thì hợp', 'bánh xèo hoặc bún mắm'],
    ['Hôm nay trời mây, ăn gì nhẹ nhẹ', 'bánh cuốn hoặc gỏi cuốn'],
  ],
}

const WEEKEND_POOL: Pair[] = [
  ['Cuối tuần rồi, thư giãn và thưởng thức', 'lẩu gia đình hoặc BBQ'],
  ['Weekend mà, chiều cả nhà với', 'gà rán bucket hoặc pizza gia đình'],
  ['Cuối tuần xứng đáng ăn ngon hơn, thử', 'hải sản tươi hoặc thịt nướng'],
  ['Thứ 7 Chủ nhật mà, đặt gì hoành tráng', 'lẩu hải sản hoặc buffet nướng'],
  ['Cuối tuần cùng gia đình ăn', 'lẩu nấm hoặc cơm niêu đặc biệt'],
  ['Cuối tuần không nấu, đặt hết đi', 'gà nguyên con hoặc cá hấp xì dầu'],
]

const SEASON_POOL: Record<'cool' | 'hot', Pair[]> = {
  cool: [
    ['Mùa se lạnh này, hợp nhất là', 'lẩu nóng hoặc súp kem bắp'],
    ['Thời tiết mát, gọi ngay', 'cháo gà hầm hoặc phở đặc biệt'],
    ['Mùa này ăn gì cũng ngon, thử', 'bún bò kho hoặc mì hải sản nóng'],
  ],
  hot: [
    ['Mùa nắng nóng, cần giải nhiệt với', 'nước ép tươi hoặc kem dừa'],
    ['Mùa hè rực lửa, thử ngay', 'chè thập cẩm hoặc đá bào sầu riêng'],
    ['Mùa nắng cần gì mát, đặt ngay', 'sinh tố hoặc chè khúc bạch'],
  ],
}

// ── Time slot ─────────────────────────────────────────────────────────────────
function timeKey(h: number): string {
  if (h < 5)  return 'dawn'
  if (h < 7)  return 'early_morning'
  if (h < 10) return 'morning'
  if (h < 11) return 'mid_morning'
  if (h < 13) return 'noon'
  if (h < 15) return 'afternoon'
  if (h < 17) return 'late_afternoon'
  if (h < 19) return 'dusk'
  if (h < 22) return 'evening'
  return 'night'
}

const TIME_LABEL: Record<string, string> = {
  dawn:          'Đêm khuya',
  early_morning: 'Sáng sớm',
  morning:       'Buổi sáng',
  mid_morning:   'Giữa sáng',
  noon:          'Giờ ăn trưa',
  afternoon:     'Buổi chiều',
  late_afternoon:'Chiều tà',
  dusk:          'Chiều muộn',
  evening:       'Buổi tối',
  night:         'Đêm muộn',
}

const TIME_ICON: Record<string, string> = {
  dawn:          '🌙',
  early_morning: '🌅',
  morning:       '☀️',
  mid_morning:   '🌤️',
  noon:          '🌞',
  afternoon:     '🌤️',
  late_afternoon:'🌇',
  dusk:          '🌆',
  evening:       '🌃',
  night:         '🌙',
}

// ── Random pick ───────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function buildPool(h: number, day: number, month: number, wk: WKey | null): Pair[] {
  const tKey = timeKey(h)
  const isWeekend = day === 0 || day === 6
  const isCoolSeason = month >= 11 || month <= 3
  const pool: Pair[] = []
  pool.push(...TIME[tKey])
  if (wk) pool.push(...WEATHER_POOL[wk])
  if (isWeekend) pool.push(...WEEKEND_POOL)
  pool.push(...SEASON_POOL[isCoolSeason ? 'cool' : 'hot'])
  return pool
}

// ── Suggestion dedup via localStorage ────────────────────────────────────────
// Lưu các key đã dùng trong hôm nay và hôm qua để không lặp lại
const LS_KEY = "ai_suggestions_used"
type HistoryEntry = { date: string; keys: string[] }

function todayStr() { return new Date().toISOString().split("T")[0] }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") } catch { return [] }
}

function getUsedKeys(): Set<string> {
  const t = todayStr(), y = yesterdayStr()
  const hist = loadHistory()
  const keys: string[] = []
  hist.forEach(h => { if (h.date === t || h.date === y) keys.push(...h.keys) })
  return new Set(keys)
}

function markUsed(key: string) {
  const t = todayStr(), y = yesterdayStr()
  const hist = loadHistory().filter(h => h.date === t || h.date === y)
  const entry = hist.find(h => h.date === t)
  if (entry) { if (!entry.keys.includes(key)) entry.keys.push(key) }
  else hist.push({ date: t, keys: [key] })
  try { localStorage.setItem(LS_KEY, JSON.stringify(hist)) } catch {}
}

function pickUnique(pool: Pair[]): Pair {
  const used = getUsedKeys()
  const available = pool.filter(p => !used.has(p[0]))
  return available.length > 0 ? pick(available) : pick(pool)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIGreeting() {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [suggestion, setSuggestion] = useState<Pair | null>(null)

  const now = new Date()
  const h   = now.getHours()
  const day = now.getDay()
  const mon = now.getMonth() + 1
  const tKey = timeKey(h)

  // Pick initial suggestion from time pool immediately (no flicker)
  useEffect(() => {
    const chosen = pickUnique(TIME[tKey])
    setSuggestion(chosen)
  }, [tKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real weather (Open-Meteo, no API key)
  useEffect(() => {
    async function fetchWeather(lat: number, lng: number) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&timezone=auto&forecast_days=1`
        const res  = await fetch(url)
        const json = await res.json()
        const cur  = json.current
        const w: Weather = {
          temp: Math.round(cur.temperature_2m),
          code: cur.weather_code,
          rain: cur.precipitation ?? 0,
        }
        setWeather(w)
        // Re-pick from full pool (weather-aware), mark as used
        const pool = buildPool(h, day, mon, wClass(w))
        const chosen = pickUnique(pool)
        markUsed(chosen[0])
        setSuggestion(chosen)
      } catch {
        // Weather failed → mark the time-based suggestion as used
        setSuggestion(prev => { if (prev) markUsed(prev[0]); return prev })
      }
    }

    // Cố định tọa độ Phước An, Krông Pắc, Đắk Lắk
    fetchWeather(12.6453, 108.0956)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wk     = weather ? wClass(weather) : null
  const wIcon  = wk ? W_ICON[wk]  : null
  const wLabel = wk ? W_LABEL[wk] : null

  return (
    <section className="mb-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Time label + weather badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            {TIME_LABEL[tKey]} {TIME_ICON[tKey]}
          </p>
          <AnimatePresence>
            {wIcon && wLabel && weather && (
              <motion.span
                key="weather-badge"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '2px 9px',
                  fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600,
                }}
              >
                {wIcon} {wLabel} · {weather.temp}°C
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Headline */}
        <p className="font-black leading-tight mb-3" style={{ color: 'var(--text-primary)', fontSize: 22 }}>
          Hôm nay bạn{' '}
          <span style={{
            background: 'linear-gradient(135deg, #FF6B00, #FFB347)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            muốn ăn gì?
          </span>
        </p>

        {/* AI suggestion box */}
        <AnimatePresence mode="wait">
          {suggestion && (
            <motion.div
              key={suggestion[0]}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: 'rgba(180,100,255,0.06)',
                border: '1px solid rgba(180,100,255,0.2)',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
              <p className="flex-1 text-[11px] leading-snug" style={{ color: '#C4B5FD' }}>
                {suggestion[0]}{' '}
                <strong style={{ color: '#D884FF' }}>{suggestion[1]}</strong>
              </p>
              <span style={{ color: 'rgba(180,100,255,0.6)', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>›</span>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </section>
  )
}
