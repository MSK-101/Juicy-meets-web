// Dashboard Types
export interface DashboardStats {
  views: number;
  revenue: number;
  activeUsers: number;
  payingUsers: number;
  userRetention: number;
}

export interface ChartData {
  month: string;
  swipes: number;
  videoViews: number;
  coinsUsed: number;
}

export interface RecentUser {
  username: string;
  email: string;
  coinBalance: number;
  lastLogin: string;
}

export interface TopVideo {
  name: string;
  views: number;
}

export interface DashboardData {
  stats: DashboardStats;
  chartData: ChartData[];
  recentUsers: RecentUser[];
  topVideos: TopVideo[];
}

// Users Types
export interface User {
  id: string;
  username: string;
  email: string;
  coinPurchased: number;
  deposits: number;
  totalSpent: string;
  lastLogin: string;
  status: 'active' | 'inactive' | 'banned' | 'pending';
}

export interface UserStats {
  registered: number;
  inactive: number;
  newUsers: number;
}

export interface UsersData {
  users: User[];
  stats: UserStats;
}

// Videos Types
export interface Video {
  id: string;
  name: string;
  uploader: string;
  gender: 'M' | 'F';
  sequence: string;
  pool: string;
  swipeCount: number;
  viewCount: number;
  uploaded: string;
}

export interface VideosData {
  videos: Video[];
  pools: string[];
  sequences: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
