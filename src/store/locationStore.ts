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
}

export const useLocationStore = create<LocationState>((set) => ({
  lat:         null,
  lng:         null,
  address:     "",
  ready:       false,
  denied:      false,
  promptShown: false,
  lastUpdated: 0,

  setLocation:    (lat, lng, address) =>
    set({ lat, lng, address, ready: true, denied: false, lastUpdated: Date.now() }),
  setDenied:      () => set({ ready: true, denied: true }),
  setPromptShown: () => set({ promptShown: true }),
}))
