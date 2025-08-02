import { api } from "@/api/baseAPI";

// Type definitions for admin requests/responses
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  admin: Admin;
  token: string;
}

export interface Admin {
  id: number;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminMeResponse {
  admin: Admin;
}

// Service object with all admin auth-related API calls
export const adminAuthService = {
  // Admin Authentication
  login: async (credentials: AdminLoginRequest): Promise<AdminLoginResponse> => {
    const response = await api.post("/admin/auth/login", credentials) as { data: AdminLoginResponse };
    return response.data;
  },

  logout: (): Promise<void> => api.delete("/admin/auth/logout") as Promise<void>,

  getCurrentAdmin: async (): Promise<AdminMeResponse> => {
    const response = await api.get("/admin/auth/me") as { data: AdminMeResponse };
    return response.data;
  },
};
