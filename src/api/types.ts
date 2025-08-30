// Common API types
export interface APIError {
  message: string;
  status: number;
  response?: unknown;
}

export interface APIResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

// Auth types
export interface AdminUser {
  id: number;
  email: string;
  display_name?: string;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Pool and Sequence types
export interface Pool {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  sequences_count: number;
}

export interface Sequence {
  id: number;
  name: string;
  pool_id: number;
  position: number;
  active: boolean;
  video_count: number;
  videos_count: number;
  content_type: string[];
  created_at: string;
  updated_at: string;
  pool?: Pool;
}

export interface PoolWithSequences extends Pool {
  sequences: Sequence[];
}

export interface CreatePoolRequest {
  name: string;
  active?: boolean;
}

export interface UpdatePoolRequest {
  name?: string;
  active?: boolean;
}

export interface CreateSequenceRequest {
  name: string;
  pool_id: number;
  active?: boolean;
  video_count?: number;
  content_type?: string[];
}

export interface UpdateSequenceRequest {
  name?: string;
  active?: boolean;
  video_count?: number;
  content_type?: string[];
}

export interface ReorderSequencesRequest {
  poolId: number;
  sequenceIds: number[];
}

// Video types
export interface Video {
  id: number;
  name: string;
  gender: 'male' | 'female' | 'other';
  status: 'active' | 'pending' | 'inactive';
  pool_id: number;
  sequence_id: number;
  admin_id: number;
  video_file_url?: string;
  created_at: string;
  updated_at: string;
  pool?: Pool;
  sequence?: Sequence;
  admin?: AdminUser;
}

export interface CreateVideoRequest {
  name: string;
  gender: 'male' | 'female' | 'other';
  status: 'active' | 'pending' | 'inactive';
  pool_id: number;
  sequence_id: number;
  video_file: File;
}

export interface UpdateVideoRequest {
  name?: string;
  gender?: 'male' | 'female' | 'other';
  status?: 'active' | 'pending' | 'inactive';
  pool_id?: number;
  sequence_id?: number;
  video_file?: File;
}

export interface VideoFilters {
  genders: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
  pools: Array<{ id: number; name: string }>;
}

export interface VideoListResponse {
  videos: Video[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

// Form validation types
export interface FormErrors {
  [key: string]: string;
}

// Component props types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  selectedFile: File | null;
  accept?: string;
  maxSize?: number;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

// Coin package types
export interface CoinPackage {
  id: number;
  name: string;
  price: number;
  coins_count: number;
  price_per_coin: number;
}

export interface CoinPackagesResponse {
  coin_packages: CoinPackage[];
}

// Purchase types
export interface UserCoinPurchase {
  id: number;
  user_id: number;
  coin_package_id: number;
  coins_count: number;
  price: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id: string;
  purchased_at: string;
  created_at: string;
  updated_at: string;
  coin_package: CoinPackage;
}

export interface CreatePurchaseRequest {
  coin_package_id: number;
}

export interface PurchaseResponse {
  purchase: UserCoinPurchase;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}
