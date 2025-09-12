import {
  DashboardData,
  User,
  Video,
  ApiResponse,
  PaginatedResponse,
} from "./admin-types";
import { adminApi } from "../api/adminBaseAPI";

// API Functions
export const adminApiFunctions = {
  // Dashboard
  getDashboardData: async (): Promise<ApiResponse<DashboardData>> => {
    try {
      const data = await adminApi.get<ApiResponse<DashboardData>>('/admin/dashboard');
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
    search?: string
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

      const data = await adminApi.get<ApiResponse<PaginatedResponse<User>>>(`/admin/users?${params}`);
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  getUserStats: async (): Promise<ApiResponse<{ registered: number; inactive: number; newUsers: number }>> => {
    try {
      const data = await adminApi.get<ApiResponse<{ registered: number; inactive: number; newUsers: number }>>('/admin/users/stats');
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
    search?: string
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

      const data = await adminApi.get<ApiResponse<PaginatedResponse<Video>>>(`/admin/videos?${params}`);
      return data;
    } catch (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }
  },

  getVideoFilters: async (): Promise<ApiResponse<{ pools: string[]; sequences: string[] }>> => {
    try {
      const data = await adminApi.get<ApiResponse<{ pools: string[]; sequences: string[] }>>('/admin/videos/filters');
      return data;
    } catch (error) {
      console.error('Error fetching video filters:', error);
      throw error;
    }
  },

  // Authentication
  login: async (email: string, password: string): Promise<ApiResponse<{ token: string }>> => {
    try {
      const data = await adminApi.post<ApiResponse<{ token: string }>>('/admin/auth/login', {
        email,
        password
      });
      return data;
    } catch (error) {
      console.error('Error during admin login:', error);
      throw error;
    }
  },
};
