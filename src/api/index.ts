// API Services
export { poolsService } from "./services/poolsService";
export { videosService } from "./services/videosService";
export { adminAuthService } from "./services/adminAuthService";

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
  useCurrentAdmin,
  useAdminLogin,
  useAdminLogout,
} from "./hooks/useAdminAuthQueries";

// API Base
export { adminApi } from "./adminBaseAPI";
export type { AdminAPIError } from "./adminBaseAPI";

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

  // Component props
  ModalProps,
  FileUploaderProps,
  PaginationProps,
} from "./types";
