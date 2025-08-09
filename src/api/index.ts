// API Services
export { poolsService } from "./services/poolsService";
export { videosService } from "./services/videosService";
export { adminAuthService } from "./services/adminAuthService";
export { coinPackagesService } from "./services/coinPackagesService";
export { deductionRulesService } from "./services/deductionRulesService";
export { purchaseService } from "./services/purchaseService";

// API Hooks
export {
  usePools,
  usePool,
  useSequences,
  useSequence,
  useCreatePool,
  useUpdatePool,
  useDeletePool,
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  useReorderSequences,
} from "./hooks/usePoolsQueries";

export {
  useVideos,
  useVideo,
  useVideoFilters,
  useCreateVideo,
  useUpdateVideo,
  useDeleteVideo,
} from "./hooks/useVideosQueries";

export {
  useCoinPackages,
} from "./hooks/useCoinPackagesQueries";

export {
  useCreatePurchase,
} from "./hooks/usePurchaseQueries";

export {
  useCurrentAdmin,
  useAdminLogin,
  useAdminLogout,
} from "./hooks/useAdminAuthQueries";

export {
  useDeductionRules,
  useDeductionRule,
  useCreateDeductionRule,
  useUpdateDeductionRule,
  useDeleteDeductionRule,
} from "./hooks/useDeductionRulesQueries";

// API Base
export { adminApi } from "./adminBaseAPI";
export type { AdminAPIError } from "./adminBaseAPI";
export { publicApi } from "./publicBaseAPI";
export type { PublicAPIError } from "./publicBaseAPI";

// Centralized Types
export type {
  // Common types
  APIError,
  APIResponse,
  PaginatedResponse,
  FormErrors,

  // Auth types
  AdminUser,
  LoginRequest,

  // Pool and Sequence types
  Pool,
  Sequence,
  PoolWithSequences,
  CreatePoolRequest,
  UpdatePoolRequest,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  ReorderSequencesRequest,

  // Video types
  Video,
  CreateVideoRequest,
  UpdateVideoRequest,
  VideoFilters,
  VideoListResponse,

  // Coin package types
  CoinPackage,
  CoinPackagesResponse,

  // Purchase types
  UserCoinPurchase,
  CreatePurchaseRequest,
  PurchaseResponse,

  // Component props
  ModalProps,
  FileUploaderProps,
  PaginationProps,
} from "./types";
