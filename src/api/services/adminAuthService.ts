import { api } from "../baseAPI";

// Type definitions for admin requests/responses
export interface Admin {
  id: number;
  email: string;
  role: string | null;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  admin: Admin;
  token: string;
}

// Service object with all admin auth-related API calls
export const adminAuthService = {
  // Admin Authentication
  login: async (credentials: AdminLoginRequest): Promise<AdminLoginResponse> => {
    const response = await api.post("/admin/auth/login", credentials);
    console.log("Admin login response:", response);

    // Check if response has the expected structure
    if (response && response.success && response.data) {
      return response.data;
    } else {
      console.error("Unexpected response format:", response);
      throw new Error("Invalid response format from server");
    }
  },

  logout: (): Promise<void> => api.delete("/admin/auth/logout") as Promise<void>,

  getCurrentAdmin: async (): Promise<{ admin: Admin }> => {
    const response = await api.get("/admin/auth/me") as { success: boolean; data: { admin: Admin } };
    return response.data;
  },
};
