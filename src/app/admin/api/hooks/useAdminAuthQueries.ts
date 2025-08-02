import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminAuthService,
  AdminLoginRequest,
} from "../services/adminAuthService";
import { useSetAdmin, useClearAdmin } from "../../store/adminAuth";

// Query key factory for consistent caching
export const adminAuthKeys = {
  all: ["adminAuth"] as const,
  current: () => [...adminAuthKeys.all, "current"] as const,
};

// Query hooks (for fetching data)
export const useCurrentAdmin = () => {
  return useQuery({
    queryKey: adminAuthKeys.current(),
    queryFn: adminAuthService.getCurrentAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Mutation hooks (for changing data)
export const useAdminLogin = () => {
  const setAdmin = useSetAdmin();

  return useMutation({
    mutationFn: (credentials: AdminLoginRequest) => adminAuthService.login(credentials),
    onSuccess: (response) => {
      // Update Zustand store with admin data and token
      setAdmin({ ...response.admin, token: response.token });
    },
    onError: (error) => {
      console.error("Admin login failed:", error);
    },
  });
};

export const useAdminLogout = () => {
  const clearAdmin = useClearAdmin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminAuthService.logout,
    onSuccess: () => {
      // Clear admin from store
      clearAdmin();
      // Clear all cached data
      queryClient.clear();
    },
    onError: () => {
      // Even if logout fails on server, clear local state
      clearAdmin();
      queryClient.clear();
    },
  });
};
