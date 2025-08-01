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

const mockUsers: User[] = [
  {
    id: "1",
    username: "Silva",
    email: "s34@gmail.com",
    coinPurchased: 120,
    deposits: 2,
    totalSpent: "Bi-Direct",
    lastLogin: "06/7/2025",
    status: "active",
  },
  {
    id: "2",
    username: "Kavia",
    email: "kav@gmail.com",
    coinPurchased: 560,
    deposits: 4,
    totalSpent: "In-Search",
    lastLogin: "04/24/2025",
    status: "active",
  },
  {
    id: "3",
    username: "Silva",
    email: "s34@gmail.com",
    coinPurchased: 120,
    deposits: 2,
    totalSpent: "Bi-Direct",
    lastLogin: "06/7/2025",
    status: "inactive",
  },
  {
    id: "4",
    username: "Kavia",
    email: "kav@gmail.com",
    coinPurchased: 560,
    deposits: 4,
    totalSpent: "In-Search",
    lastLogin: "04/24/2025",
    status: "banned",
  },
];

const mockVideos: Video[] = [
  {
    id: "1",
    name: "Video",
    uploader: "Robert Smith",
    gender: "M",
    sequence: "A1",
    pool: "A",
    swipeCount: 80,
    viewCount: 67,
    uploaded: "06/7/2025",
  },
  {
    id: "2",
    name: "Video",
    uploader: "Theressa Kay",
    gender: "F",
    sequence: "B2",
    pool: "B",
    swipeCount: 50,
    viewCount: 45,
    uploaded: "04/24/2025",
  },
  {
    id: "3",
    name: "Video 1",
    uploader: "William May",
    gender: "M",
    sequence: "A1",
    pool: "A",
    swipeCount: 23,
    viewCount: 76,
    uploaded: "06/7/2025",
  },
  {
    id: "4",
    name: "Video",
    uploader: "Meka Siky",
    gender: "F",
    sequence: "B3",
    pool: "B",
    swipeCount: 50,
    viewCount: 45,
    uploaded: "04/24/2025",
  },
];

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
    search?: string
  ): Promise<ApiResponse<PaginatedResponse<User>>> => {
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredUsers = [...mockUsers];

    if (status && status !== "all") {
      filteredUsers = filteredUsers.filter(user => user.status === status);
    }

    if (search) {
      filteredUsers = filteredUsers.filter(
        user =>
          user.username.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = filteredUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return {
      success: true,
      data: {
        data: paginatedUsers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getUserStats: async (): Promise<ApiResponse<{ registered: number; inactive: number; newUsers: number }>> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      data: {
        registered: 5000,
        inactive: 200,
        newUsers: 163,
      },
    };
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
