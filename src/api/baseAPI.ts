import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/error";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export class APIError extends Error {
  constructor(message: string, public status: number, public response?: unknown) {
    super(message);
    this.name = "APIError";
  }
}

export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> => {
  const user = useAuthStore.getState().user;
  const token = user?.token;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
      useErrorStore.getState().setError(data?.message || data || "An error occurred");
      throw new APIError(data?.message || data || "An error occurred", response.status, data);
    }

    return data;
  } catch (error: any) {
    useErrorStore.getState().setError(error?.message || "An error occurred");
    throw error;
  }
};

export const api = {
  get: (endpoint: string, options?: RequestInit) =>
    apiRequest(endpoint, { method: "GET", ...options }),
  post: (endpoint: string, data?: unknown, options?: RequestInit) =>
    apiRequest(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
  put: (endpoint: string, data?: unknown, options?: RequestInit) =>
    apiRequest(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
  patch: (endpoint: string, data?: unknown, options?: RequestInit) =>
    apiRequest(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
  delete: (endpoint: string, options?: RequestInit) =>
    apiRequest(endpoint, { method: "DELETE", ...options }),
};
