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
  pool_id?: number;
  sequence_id?: number;
  videos_watched_in_current_sequence?: number;
  sequence_total_videos?: number;
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

  // Pool and Sequence methods
  getPoolId: () => number | undefined;
  getSequenceId: () => number | undefined;
  getVideosWatched: () => number | undefined;
  getSequenceTotalVideos: () => number | undefined;
  setPoolId: (poolId: number) => void;
  setSequenceId: (sequenceId: number) => void;
  setVideosWatched: (count: number) => void;
  setSequenceTotalVideos: (total: number) => void;
  setPoolAndSequence: (poolId: number, sequenceId: number) => void;
  setSequenceInfo: (sequenceId: number, videosWatched: number, totalVideos: number) => void;
  resetSequenceProgress: () => void;

  // New methods for local sequence management
  incrementLocalVideoCount: () => void;
  isStaffUser: () => boolean;
  shouldSyncWithBackend: () => boolean;
}

export const useAuthStore = create<UserState>()(
  persist(
    (set, get) => ({
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

      // Pool and Sequence methods
      getPoolId: () => get().user?.pool_id,

      getSequenceId: () => get().user?.sequence_id,

      getVideosWatched: () => get().user?.videos_watched_in_current_sequence,

      getSequenceTotalVideos: () => get().user?.sequence_total_videos,

      setPoolId: (poolId: number) =>
        set((state) => ({
          user: state.user ? { ...state.user, pool_id: poolId } : null,
        })),

      setSequenceId: (sequenceId: number) =>
        set((state) => ({
          user: state.user ? { ...state.user, sequence_id: sequenceId } : null,
        })),

      setVideosWatched: (count: number) =>
        set((state) => ({
          user: state.user ? { ...state.user, videos_watched_in_current_sequence: count } : null,
        })),

      setSequenceTotalVideos: (total: number) =>
        set((state) => ({
          user: state.user ? { ...state.user, sequence_total_videos: total } : null,
        })),

      setPoolAndSequence: (poolId: number, sequenceId: number) =>
        set((state) => ({
          user: state.user ? { ...state.user, pool_id: poolId, sequence_id: sequenceId } : null,
        })),

      setSequenceInfo: (sequenceId: number, videosWatched: number, totalVideos: number) =>
        set((state) => ({
          user: state.user ? {
            ...state.user,
            sequence_id: sequenceId,
            videos_watched_in_current_sequence: videosWatched,
            sequence_total_videos: totalVideos
          } : null,
        })),

      resetSequenceProgress: () =>
        set((state) => ({
          user: state.user ? {
            ...state.user,
            videos_watched_in_current_sequence: 0
          } : null,
        })),

      // New methods for local sequence management
      incrementLocalVideoCount: () =>
        set((state) => ({
          user: state.user ? {
            ...state.user,
            videos_watched_in_current_sequence: (state.user.videos_watched_in_current_sequence || 0) + 1
          } : null,
        })),

      isStaffUser: () => get().user?.role === 'staff',

      shouldSyncWithBackend: () => {
        const user = get().user;
        // Staff users always sync with backend, app users sync after successful matches
        return user?.role === 'staff';
      },
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

// Pool and Sequence convenience hooks
export const useGetPoolId = () => useAuthStore((state) => state.getPoolId);
export const useGetSequenceId = () => useAuthStore((state) => state.getSequenceId);
export const useGetVideosWatched = () => useAuthStore((state) => state.getVideosWatched);
export const useGetSequenceTotalVideos = () => useAuthStore((state) => state.getSequenceTotalVideos);
export const useSetPoolId = () => useAuthStore((state) => state.setPoolId);
export const useSetSequenceId = () => useAuthStore((state) => state.setSequenceId);
export const useSetVideosWatched = () => useAuthStore((state) => state.setVideosWatched);
export const useSetSequenceTotalVideos = () => useAuthStore((state) => state.setSequenceTotalVideos);
export const useSetPoolAndSequence = () => useAuthStore((state) => state.setPoolAndSequence);
export const useSetSequenceInfo = () => useAuthStore((state) => state.setSequenceInfo);
export const useResetSequenceProgress = () => useAuthStore((state) => state.resetSequenceProgress);

// New convenience hooks for local sequence management
export const useIncrementLocalVideoCount = () => useAuthStore((state) => state.incrementLocalVideoCount);
export const useIsStaffUser = () => useAuthStore((state) => state.isStaffUser);
export const useShouldSyncWithBackend = () => useAuthStore((state) => state.shouldSyncWithBackend);
