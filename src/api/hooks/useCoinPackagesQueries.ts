import { useQuery } from "@tanstack/react-query";
import { coinPackagesService } from "../services/coinPackagesService";

// Query keys
export const coinPackagesKeys = {
  all: ["coinPackages"] as const,
  lists: () => [...coinPackagesKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...coinPackagesKeys.lists(), { filters }] as const,
  details: () => [...coinPackagesKeys.all, "detail"] as const,
  detail: (id: number) => [...coinPackagesKeys.details(), id] as const,
};

// Query hooks
export const useCoinPackages = () => {
  return useQuery({
    queryKey: coinPackagesKeys.lists(),
    queryFn: () => coinPackagesService.getCoinPackages(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
