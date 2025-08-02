import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Admin } from "../api/services/adminAuthService";

interface AdminState {
  admin: Admin | null;
  isLoading: boolean;
  hasHydrated: boolean;

  // Actions
  setAdmin: (admin: Admin) => void;
  updateAdmin: (updates: Partial<Admin>) => void;
  clearAdmin: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAdminAuthStore = create<AdminState>()(
  persist(
    (set) => ({
      // Initial state
      admin: null,
      isLoading: false,
      hasHydrated: false,

      // Actions
      setAdmin: (admin: Admin) => set({ admin, isLoading: false }),

      updateAdmin: (updates: Partial<Admin>) =>
        set((state) => ({
          admin: state.admin ? { ...state.admin, ...updates } : null,
        })),

      clearAdmin: () => set({ admin: null, isLoading: false }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
    }),
    {
      name: "juicy-meets-admin-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ admin: state.admin }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Convenience hooks
export const useSetAdmin = () => useAdminAuthStore((state) => state.setAdmin);
export const useClearAdmin = () => useAdminAuthStore((state) => state.clearAdmin);
export const useUpdateAdmin = () => useAdminAuthStore((state) => state.updateAdmin);
export const useAdmin = () => useAdminAuthStore((state) => state.admin);
