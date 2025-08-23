import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface User {
  id: number;
  email: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  interested_in?: 'male' | 'female' | 'other';
  provider?: string;
  oauth_user: boolean;
  confirmed: boolean;
  confirmed_at?: string;
  profile_completed: boolean;
  role: 'user' | 'staff' | 'admin';
  user_status: 'pending' | 'active' | 'suspended';
  coin_balance: number;
  created_at: string;
  updated_at: string;
  token?: string; // JWT token for API requests
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  hasHydrated: boolean;

  // Actions
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<UserState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isLoading: false,
      hasHydrated: false,

      // Actions
      setUser: (user: User) => set({ user, isLoading: false }),

      updateUser: (updates: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearUser: () => set({ user: null, isLoading: false }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
    }),
    {
      name: "juicy-meets-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Convenience hooks
export const useSetUser = () => useAuthStore((state) => state.setUser);
export const useClearUser = () => useAuthStore((state) => state.clearUser);
export const useUpdateUser = () => useAuthStore((state) => state.updateUser);
export const useUser = () => useAuthStore((state) => state.user);
