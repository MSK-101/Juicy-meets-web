import { api } from "../baseAPI";
import type { User } from "@/store/auth";

// Type definitions for requests/responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  email: string;
}

export interface RegisterResponse {
  user: User;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

// Service object with all auth-related API calls
export const authService = {
  // Authentication
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post("/login", { user: credentials }) as { data: LoginResponse };
    return response.data; // Extract data from the response wrapper
  },

  logout: (): Promise<void> => api.delete("/logout") as Promise<void>,

  register: async (credentials: RegisterRequest): Promise<RegisterResponse> => {
    const response = await api.post("/users", { user: credentials }) as { data: RegisterResponse };
    return response.data; // Extract data from the response wrapper
  },

  forgotPassword: async (request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
    const response = await api.post("/password-recovery/forgot", request) as ForgotPasswordResponse;
    return response;
  },

  // Profile management
  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get("/users/me") as { data: { user: User } };
    return response.data; // Extract data from the response wrapper
  },
};
