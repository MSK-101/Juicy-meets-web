import {
  DashboardData,
  User,
  Video,
  ApiResponse,
  PaginatedResponse,
} from "./admin-types";

// Get API base URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// API Functions
export const adminApi = {
  // Dashboard
  getDashboardData: async (token?: string): Promise<ApiResponse<DashboardData>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  },

  // Users
  getUsers: async (
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
    token?: string
  ): Promise<ApiResponse<PaginatedResponse<User>>> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (status && status !== "all") {
        params.append('status', status);
      }

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`${API_BASE_URL}/admin/users?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  getUserStats: async (token?: string): Promise<ApiResponse<{ registered: number; inactive: number; newUsers: number }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  },

  // Videos
  getVideos: async (
    page: number = 1,
    limit: number = 10,
    pool?: string,
    sequence?: string,
    search?: string,
    token?: string
  ): Promise<ApiResponse<PaginatedResponse<Video>>> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (pool) {
        params.append('pool', pool);
      }

      if (sequence) {
        params.append('sequence', sequence);
      }

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`${API_BASE_URL}/admin/videos?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }
  },

  getVideoFilters: async (token?: string): Promise<ApiResponse<{ pools: string[]; sequences: string[] }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/filters`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching video filters:', error);
      throw error;
    }
  },

  // Authentication
  login: async (email: string, password: string): Promise<ApiResponse<{ token: string }>> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (email === "admin@juicymeets.com" && password === "admin123") {
      return {
        success: true,
        data: { token: "mock-admin-token" },
      };
    } else {
      throw new Error("Invalid credentials");
    }
  },
};
