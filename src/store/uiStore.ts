import { create } from "zustand"

export type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id:      string
  type:    ToastType
  message: string
}

interface UiState {
  toasts:      Toast[]
  isLoading:   boolean
  activeModal: string | null

  showToast:   (message: string, type?: ToastType) => void
  hideToast:   (id: string) => void
  setLoading:  (loading: boolean) => void
  openModal:   (name: string) => void
  closeModal:  () => void
}

export const useUiStore = create<UiState>((set) => ({
  toasts:      [],
  isLoading:   false,
  activeModal: null,

  showToast: (message, type = "info") => {
    const id = crypto.randomUUID()
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500)
  },

  hideToast:  (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
  openModal:  (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
}))
