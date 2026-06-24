import { create } from "zustand"

interface LocationState {
  lat:          number | null
  lng:          number | null
  address:      string
  ready:        boolean   // true sau khi request xong (dù thành công hay không)
  denied:       boolean   // user từ chối GPS
  promptShown:  boolean   // đã hiện custom permission UI chưa
  lastUpdated:  number    // timestamp ms của lần lấy GPS gần nhất

  setLocation:     (lat: number, lng: number, address: string) => void
  setDenied:       () => void
  setPromptShown:  () => void
  resetDenied:     () => void
}

const LS_KEY = "gps_prompt_shown"

function readPromptShown(): boolean {
  if (typeof window === "undefined") return false
  try { return !!localStorage.getItem(LS_KEY) } catch { return false }
}

export const useLocationStore = create<LocationState>((set) => ({
  lat:         null,
  lng:         null,
  address:     "",
  ready:       false,
  denied:      false,
  promptShown: readPromptShown(),
  lastUpdated: 0,

  setLocation:    (lat, lng, address) =>
    set({ lat, lng, address, ready: true, denied: false, lastUpdated: Date.now() }),
  setDenied:      () => set({ ready: true, denied: true }),
  resetDenied:    () => set({ denied: false, ready: false }),
  setPromptShown: () => {
    try { localStorage.setItem(LS_KEY, "1") } catch {}
    set({ promptShown: true })
  },
}))
