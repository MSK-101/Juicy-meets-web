import { publicApi } from "../publicBaseAPI";
import type { CreatePurchaseRequest, PurchaseResponse } from "../types";

// API endpoints
const ENDPOINTS = {
  purchases: "/purchases",
} as const;

// Service functions
export const purchaseService = {
  async createPurchase(data: CreatePurchaseRequest): Promise<PurchaseResponse> {
    const response = await publicApi.post<{ success: boolean; data: PurchaseResponse }>(
      ENDPOINTS.purchases,
      { purchase: data }
    );
    return response.data;
  },
};

// Export types for convenience
export type { CreatePurchaseRequest, PurchaseResponse };
