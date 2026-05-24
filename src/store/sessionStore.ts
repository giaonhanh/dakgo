import { create } from "zustand"
import type { UserRole } from "@/types"

interface SessionProfile {
  id:         string
  full_name:  string | null
  avatar_url: string | null
  phone:      string
  role:       UserRole
  is_active:  boolean
}

interface SessionState {
  profile:    SessionProfile | null
  isLoading:  boolean
  setProfile: (profile: SessionProfile | null) => void
  setLoading: (loading: boolean) => void
  clear:      () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  profile:    null,
  isLoading:  true,
  setProfile: (profile) => set({ profile, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear:      () => set({ profile: null, isLoading: false }),
}))
