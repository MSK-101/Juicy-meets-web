import { useAdminAuthStore } from "@/store/adminAuth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export class AdminAPIError extends Error {
  constructor(message: string, public status: number, public response?: unknown) {
    super(message);
    this.name = "AdminAPIError";
  }
}

export const adminApiRequest = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = useAdminAuthStore.getState().token;

  // Check if the body is FormData
  const isFormData = options.body instanceof FormData;

  const config: RequestInit = {
    ...options,
    headers: {
      // Don't set Content-Type for FormData, let the browser set it with boundary
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const contentType = response.headers.get("content-type");
    const isJSON = contentType?.includes("application/json");
    const data = isJSON ? await response.json() : await response.text();

    if (!response.ok) {
      throw new AdminAPIError(
        data?.message || data || "An error occurred",
        response.status,
        data
      );
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof AdminAPIError) {
      throw error;
    }
    throw new AdminAPIError(
      error instanceof Error ? error.message : "An error occurred",
      500,
      error
    );
  }
};

export const adminApi = {
  get: <T = unknown>(endpoint: string, options?: RequestInit) =>
    adminApiRequest<T>(endpoint, { method: "GET", ...options }),

  post: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    adminApiRequest<T>(endpoint, {
      method: "POST",
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
      ...options,
    }),

  put: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    adminApiRequest<T>(endpoint, {
      method: "PUT",
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
      ...options,
    }),

  patch: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    adminApiRequest<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
    adminApiRequest<T>(endpoint, { method: "DELETE", ...options }),
};
