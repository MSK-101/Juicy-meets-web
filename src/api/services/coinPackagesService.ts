import { publicApi } from "../publicBaseAPI";
import type { CoinPackage, CoinPackagesResponse } from "../types";

// API endpoints
const ENDPOINTS = {
  coinPackages: "/coin_packages",
} as const;

// Service functions
export const coinPackagesService = {
  async getCoinPackages(): Promise<CoinPackage[]> {
    const response = await publicApi.get<{ success: boolean; data: CoinPackagesResponse }>(ENDPOINTS.coinPackages);
    return response.data.coin_packages;
  },
};

// Export types for convenience
export type { CoinPackage, CoinPackagesResponse };
