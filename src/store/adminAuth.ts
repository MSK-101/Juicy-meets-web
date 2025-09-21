import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Admin } from "@/api/services/adminAuthService";

interface AdminState {
  admin: Admin | null;
  token: string | null;
  isLoading: boolean;
  hasHydrated: boolean;

  // Actions
  setAdmin: (admin: Admin, token: string) => void;
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
      token: null,
      isLoading: false,
      hasHydrated: false,

      // Actions
                     setAdmin: (admin: Admin, token: string) => {
                 
                 set({ admin, token, isLoading: false });
               },

      updateAdmin: (updates: Partial<Admin>) =>
        set((state) => ({
          admin: state.admin ? { ...state.admin, ...updates } : null,
        })),

      clearAdmin: () => {
        // Clear admin from store
        set({ admin: null, token: null, isLoading: false });
        // Clear all localStorage data related to admin authentication
        try {
          localStorage.removeItem('juicy-meets-admin-auth-storage');
          localStorage.removeItem('juicyMeetsAdmin');
          localStorage.removeItem('juicyMeetsAdminToken');
          
        } catch (error) {
          
        }
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
    }),
    {
      name: "juicy-meets-admin-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ admin: state.admin, token: state.token }),
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
export const useAdminToken = () => {
  const token = useAdminAuthStore((state) => state.token);
  return token;
};
