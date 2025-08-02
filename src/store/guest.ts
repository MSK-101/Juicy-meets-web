import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuestPreferences {
  age?: number;
  gender?: number;
  interestedIn?: number;
  location?: string;
}

interface GuestState {
  preferences: GuestPreferences;
  _hasHydrated: boolean;
  setPreferences: (preferences: Partial<GuestPreferences>) => void;
  clearPreferences: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set) => ({
      preferences: {},
      _hasHydrated: false,
      setPreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences },
      })),
      clearPreferences: () => set({ preferences: {} }),
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
    }),
    {
      name: "juicy-meets-guest-storage",
      partialize: (state) => ({
        preferences: state.preferences,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
