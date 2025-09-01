import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/error";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

// Debug: Log the BASE_URL being used
console.log('🔍 BASE_URL:', BASE_URL);
console.log('🔍 NEXT_PUBLIC_API_URL env var:', process.env.NEXT_PUBLIC_API_URL);

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
  let token = user?.token;

  console.log('🔍 API Request Debug:', { endpoint, hasUserToken: !!user?.token, hasUser: !!user });

  // If no token in auth store, try to get from localStorage
  if (!token) {
    try {
      const storedToken = localStorage.getItem('juicyMeetsAuthToken');
      if (storedToken) {
        token = storedToken;
        console.log('🔍 Retrieved token from localStorage');
      }
    } catch {
      console.warn('Could not access localStorage for token');
    }
  }

  console.log('🔍 Final token for request:', token ? 'Present' : 'Missing');

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  console.log('🔍 Request headers:', config.headers);

  try {
    const fullUrl = `${BASE_URL}${endpoint}`;
    console.log('🔍 Making request to:', fullUrl);
    const response = await fetch(fullUrl, config);
    const contentType = response.headers.get("content-type");
    const isJSON = contentType?.includes("application/json");
    const data = isJSON ? await response.json() : await response.text();

    console.log('🔍 Response status:', response.status, 'for endpoint:', endpoint);

    if (!response.ok) {
      useErrorStore.getState().setError(data?.message || data || "An error occurred");
      throw new APIError(data?.message || data || "An error occurred", response.status, data);
    }

    return data;
  } catch (error: unknown) {
    useErrorStore.getState().setError(error instanceof Error ? error.message : "An error occurred");
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
