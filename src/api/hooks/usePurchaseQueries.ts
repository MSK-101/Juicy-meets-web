import { useMutation } from "@tanstack/react-query";
import { purchaseService } from "../services/purchaseService";
import type { CreatePurchaseRequest } from "../types";

// Mutation hooks
export const useCreatePurchase = () => {
  return useMutation({
    mutationFn: (data: CreatePurchaseRequest) => purchaseService.createPurchase(data),
    onSuccess: (data) => {
      console.log("Purchase created successfully:", data);
    },
    onError: (error) => {
      console.error("Create purchase failed:", error);
    },
  });
};
