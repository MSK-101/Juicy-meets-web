import {
  DashboardData,
  User,
  Video,
  ApiResponse,
  PaginatedResponse,
} from "./admin-types";

// Mock data
const mockDashboardData: DashboardData = {
  stats: {
    views: 12453,
    revenue: 23671,
    activeUsers: 256,
    payingUsers: 2318,
    userRetention: 85,
  },
  chartData: [
    { month: "Jan", swipes: 1200, videoViews: 830, coinsUsed: 500 },
    { month: "Feb", swipes: 1490, videoViews: 950, coinsUsed: 600 },
    { month: "Mar", swipes: 1600, videoViews: 100, coinsUsed: 700 },
    { month: "Apr", swipes: 1100, videoViews: 1250, coinsUsed: 800 },
    { month: "May", swipes: 2900, videoViews: 1400, coinsUsed: 900 },
    { month: "Jun", swipes: 2200, videoViews: 1150, coinsUsed: 1000 },
  ],
  recentUsers: [
    { username: "Smith", email: "s34@gmail.com", coinBalance: 120, lastLogin: "09:30 A.M" },
    { username: "Kavire", email: "kav@gmail.com", coinBalance: 560, lastLogin: "04/24/2025" },
  ],
  topVideos: [
    { name: "Sequence A1", views: 5432 },
    { name: "Pool A", views: 345678 },
  ],
};

// API Functions
export const adminApi = {
  // Dashboard
  getDashboardData: async (): Promise<ApiResponse<DashboardData>> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      data: mockDashboardData,
    };
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

      const response = await fetch(`/api/v1/admin/users?${params}`, {
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
      const response = await fetch(`/api/v1/admin/users/stats`, {
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
    search?: string
  ): Promise<ApiResponse<PaginatedResponse<Video>>> => {
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredVideos = [...mockVideos];

    if (pool) {
      filteredVideos = filteredVideos.filter(video => video.pool === pool);
    }

    if (sequence) {
      filteredVideos = filteredVideos.filter(video => video.sequence === sequence);
    }

    if (search) {
      filteredVideos = filteredVideos.filter(
        video =>
          video.name.toLowerCase().includes(search.toLowerCase()) ||
          video.uploader.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = filteredVideos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

    return {
      success: true,
      data: {
        data: paginatedVideos,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getVideoFilters: async (): Promise<ApiResponse<{ pools: string[]; sequences: string[] }>> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      data: {
        pools: ["A", "B", "C"],
        sequences: ["1", "2", "3"],
      },
    };
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
