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
                 console.log("Setting admin in store:", {
                   admin: admin.email,
                   token: token ? `${token.substring(0, 20)}...` : 'missing',
                   fullToken: token
                 });
                 set({ admin, token, isLoading: false });
               },

      updateAdmin: (updates: Partial<Admin>) =>
        set((state) => ({
          admin: state.admin ? { ...state.admin, ...updates } : null,
        })),

      clearAdmin: () => set({ admin: null, token: null, isLoading: false }),

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
  console.log("Getting admin token:", token ? `${token.substring(0, 20)}...` : 'missing');
  return token;
};
