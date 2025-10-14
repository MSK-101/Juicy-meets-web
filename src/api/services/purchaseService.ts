import { api } from "../baseAPI";
import type { CreatePurchaseRequest, PurchaseResponse } from "../types";

// API endpoints
const ENDPOINTS = {
  purchases: "/purchases",
} as const;

// Service functions
export const purchaseService = {
  async createPurchase(data: CreatePurchaseRequest): Promise<PurchaseResponse> {
    const response = await api.post(
      ENDPOINTS.purchases,
      { purchase: data }
    ) as { success: boolean; data: PurchaseResponse };
    return response.data;
  },
};

// Export types for convenience
export type { CreatePurchaseRequest, PurchaseResponse };
