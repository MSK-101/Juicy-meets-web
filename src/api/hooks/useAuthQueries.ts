import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authService,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
} from "../services/authService";
import { useSetUser, useClearUser } from "@/store/auth";

// Query key factory for consistent caching
export const authKeys = {
  all: ["auth"] as const,
  current: () => [...authKeys.all, "current"] as const,
};

// Query hooks (for fetching data)
export const useCurrentUser = () => {
  return useQuery({
    queryKey: authKeys.current(),
    queryFn: authService.getCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Mutation hooks (for changing data)
export const useLogin = () => {
  const setUser = useSetUser();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: (response) => {
      // Update Zustand store with user data and token
      setUser({ ...response.user, token: response.token });
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: (credentials: RegisterRequest) => authService.register(credentials),
    onError: (error) => {
      console.error("Registration failed:", error);
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (request: ForgotPasswordRequest) => authService.forgotPassword(request),
    onError: (error) => {
      console.error("Forgot password failed:", error);
    },
  });
};

export const useLogout = () => {
  const clearUser = useClearUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      // Clear user from store
      clearUser();
      // Clear all cached data
      queryClient.clear();
    },
    onError: () => {
      // Even if logout fails on server, clear local state
      clearUser();
      queryClient.clear();
    },
  });
};
