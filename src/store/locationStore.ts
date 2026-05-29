import { create } from "zustand"

interface LocationState {
  lat:     number | null
  lng:     number | null
  address: string          // địa chỉ đã reverse geocode, VD: "Phước An, Krông Pắc"
  ready:   boolean         // true sau khi đã request GPS (dù thành công hay thất bại)
  denied:  boolean         // true nếu user từ chối GPS

  setLocation: (lat: number, lng: number, address: string) => void
  setDenied:   () => void
  setReady:    () => void
}

export const useLocationStore = create<LocationState>((set) => ({
  lat:     null,
  lng:     null,
  address: "",
  ready:   false,
  denied:  false,

  setLocation: (lat, lng, address) => set({ lat, lng, address, ready: true, denied: false }),
  setDenied:   ()                  => set({ ready: true, denied: true }),
  setReady:    ()                  => set({ ready: true }),
}))
