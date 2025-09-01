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

// Backend response structure
export interface AdminLoginResponse {
  success: boolean;
  message: string;
  data: {
    admin: Admin;
    token: string;
  };
}

// Frontend expected structure (what we extract from backend)
export interface AdminAuthData {
  admin: Admin;
  token: string;
}

// Service object with all admin auth-related API calls
export const adminAuthService = {
  // Admin Authentication
  login: async (credentials: AdminLoginRequest): Promise<AdminAuthData> => {
    try {
      const response = await api.post("/admin/auth/login", credentials) as AdminLoginResponse;
      console.log("Admin login response:", response);

      // Check if response has the expected structure
      if (response?.success && response?.data?.admin && response?.data?.token) {
        return {
          admin: response.data.admin,
          token: response.data.token
        };
      } else {
        console.error("Unexpected response format:", response);
        throw new Error(response?.message || "Invalid response format from server");
      }
    } catch (error) {
      console.error("Admin login error:", error);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.delete("/admin/auth/logout");
    } catch (error) {
      console.error("Admin logout error:", error);
      throw error;
    }
  },

  getCurrentAdmin: async (): Promise<Admin> => {
    try {
      const response = await api.get("/admin/auth/me") as {
        success: boolean;
        data: { admin: Admin };
      };

      if (response?.success && response?.data?.admin) {
        return response.data.admin;
      } else {
        throw new Error("Failed to get current admin");
      }
    } catch (error) {
      console.error("Get current admin error:", error);
      throw error;
    }
  },
};
