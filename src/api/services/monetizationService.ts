import { adminApi } from '../adminBaseAPI';

// Types
export interface CoinPackage {
  id: string;
  name: string;
  price: number;
  coins_count: number;
  price_per_coin: number;
  description?: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCoinPackageRequest {
  name: string;
  price: number;
  coins_count: number;
  description?: string;
  active?: boolean;
  sort_order?: number;
}

export interface UpdateCoinPackageRequest {
  name?: string;
  price?: number;
  coins_count?: number;
  description?: string;
  active?: boolean;
  sort_order?: number;
}

export interface Transaction {
  id: string;
  user_email: string;
  package_name: string;
  coins_count: number;
  price: number;
  purchased_at: string;
  payment_status: string;
}

export interface MonetizationStats {
  total_revenue: number;
  monthly_revenue: number;
  total_packages: number;
  total_purchases: number;
  total_transactions: number;
  most_popular_package?: string;
  revenue_per_package: number;
}

export interface ChartData {
  name: string;
  revenue: number;
  sales: number;
}

export interface MonetizationData {
  stats: MonetizationStats;
  coin_packages: CoinPackage[];
  transactions: Transaction[];
  chart_data: ChartData[];
}

// API endpoints
const ENDPOINTS = {
  coinPackages: '/admin/coin_packages',
  monetization: '/admin/monetization',
} as const;

// Service functions
export const monetizationService = {
  // Coin Packages CRUD
  async getCoinPackages(): Promise<CoinPackage[]> {
    const response = await adminApi.get<{ coin_packages: CoinPackage[] }>(ENDPOINTS.coinPackages);
    return response.coin_packages;
  },

  async getCoinPackage(id: string): Promise<CoinPackage> {
    const response = await adminApi.get<{ coin_package: CoinPackage }>(`${ENDPOINTS.coinPackages}/${id}`);
    return response.coin_package;
  },

  async createCoinPackage(data: CreateCoinPackageRequest): Promise<{ success: boolean; message: string; coin_package: CoinPackage }> {
    const response = await adminApi.post<{ success: boolean; message: string; coin_package: CoinPackage }>(
      ENDPOINTS.coinPackages,
      { coin_package: data }
    );
    return response;
  },

  async updateCoinPackage(id: string, data: UpdateCoinPackageRequest): Promise<{ success: boolean; message: string; coin_package: CoinPackage }> {
    const response = await adminApi.put<{ success: boolean; message: string; coin_package: CoinPackage }>(
      `${ENDPOINTS.coinPackages}/${id}`,
      { coin_package: data }
    );
    return response;
  },

  async deleteCoinPackage(id: string): Promise<{ success: boolean; message: string }> {
    const response = await adminApi.delete<{ success: boolean; message: string }>(`${ENDPOINTS.coinPackages}/${id}`);
    return response;
  },

  // Monetization Analytics
  async getMonetizationData(dateRange: string = 'today'): Promise<MonetizationData> {
    const response = await adminApi.get<MonetizationData>(`${ENDPOINTS.monetization}?date_range=${dateRange}`);
    return response;
  },

  async getTransactionHistory(dateRange: string = 'today'): Promise<Transaction[]> {
    const response = await adminApi.get<{ transactions: Transaction[] }>(`${ENDPOINTS.monetization}/transactions?date_range=${dateRange}`);
    return response.transactions;
  },

  async getRevenueStats(dateRange: string = 'today'): Promise<MonetizationStats> {
    const response = await adminApi.get<{ stats: MonetizationStats }>(`${ENDPOINTS.monetization}/stats?date_range=${dateRange}`);
    return response.stats;
  },
};




