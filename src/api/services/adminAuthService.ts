import { adminApi } from "../adminBaseAPI";

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
      const response = await adminApi.post("/admin/auth/login", credentials) as AdminLoginResponse;

      // Check if response has the expected structure
      if (response?.success && response?.data?.admin && response?.data?.token) {
        return {
          admin: response.data.admin,
          token: response.data.token
        };
      } else {
        throw new Error(response?.message || "Invalid response format from server");
      }
    } catch (error) {
      
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await adminApi.delete("/admin/auth/logout");
    } catch (error) {
      
      throw error;
    }
  },

  getCurrentAdmin: async (): Promise<Admin> => {
    try {
      const response = await adminApi.get("/admin/auth/me") as {
        success: boolean;
        data: { admin: Admin };
      };

      if (response?.success && response?.data?.admin) {
        return response.data.admin;
      } else {
        throw new Error("Failed to get current admin");
      }
    } catch (error) {
      
      throw error;
    }
  },

  // Admin Management
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    try {
      const response = await adminApi.put("/admin/auth/change_password", {
        old_password: oldPassword,
        new_password: newPassword
      }) as {
        success: boolean;
        message?: string;
      };

      if (!response?.success) {
        throw new Error(response?.message || "Failed to change password");
      }
    } catch (error) {
      
      throw error;
    }
  },

  getAdmins: async (): Promise<Admin[]> => {
    try {
      const response = await adminApi.get("/admin/admins") as {
        success: boolean;
        data: { admins: Admin[] };
      };

      if (response?.success && response?.data?.admins) {
        return response.data.admins;
      } else {
        throw new Error("Failed to get admins");
      }
    } catch (error) {
      
      throw error;
    }
  },

  createAdmin: async (email: string, password: string): Promise<Admin> => {
    try {
      const response = await adminApi.post("/admin/admins", {
        admin: {
          email,
          password,
          password_confirmation: password
        }
      }) as {
        success: boolean;
        data: { admin: Admin };
      };

      if (response?.success && response?.data?.admin) {
        return response.data.admin;
      } else {
        throw new Error("Failed to create admin");
      }
    } catch (error) {
      
      throw error;
    }
  },

  deleteAdmin: async (adminId: number): Promise<void> => {
    try {
      const response = await adminApi.delete(`/admin/admins/${adminId}`) as {
        success: boolean;
        message?: string;
      };

      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete admin");
      }
    } catch (error) {
      
      throw error;
    }
  },
};
