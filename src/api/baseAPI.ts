import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/error";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL  || "http://localhost:3000/api/v1";

// Debug: Log the BASE_URL being used

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
  let userEmail: string | undefined;

  // If no token in auth store, try to get from localStorage
  if (!token) {
    try {
      const storedToken = localStorage.getItem('juicyMeetsAuthToken');
      if (storedToken) {
        token = storedToken;
      }
    } catch {
    }
  }

  // Get user email for auto-login fallback
  if (user?.email) {
    userEmail = user.email;
  } else {
    try {
      const storedUser = localStorage.getItem('juicyMeetsUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userEmail = userData.email;
      }
    } catch {
    }
  }

  // Prepare request body with email for auto-login
  let requestBody = options.body;
  if (userEmail) {
    if (options.method === 'POST' && requestBody) {
      try {
        const bodyData = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
        bodyData.email = userEmail;
        requestBody = JSON.stringify(bodyData);
      } catch (error) {

      }
    } else if (options.method === 'POST' && !requestBody) {
      // If no body exists, create one with just the email
      requestBody = JSON.stringify({ email: userEmail });
    } else if (['GET', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')) {
      // For non-POST requests, add email as query parameter
      const url = new URL(`${BASE_URL}${endpoint}`);
      url.searchParams.set('email', userEmail);
      // We'll need to update the endpoint to include the query params
      const modifiedEndpoint = `${endpoint}${endpoint.includes('?') ? '&' : '?'}email=${encodeURIComponent(userEmail)}`;
      // Update the endpoint for the final request
      endpoint = modifiedEndpoint;
    }
  }

  const config: RequestInit = {
    ...options,
    body: requestBody,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const fullUrl = `${BASE_URL}${endpoint}`;
    const response = await fetch(fullUrl, config);
    const contentType = response.headers.get("content-type");
    const isJSON = contentType?.includes("application/json");
    const data = isJSON ? await response.json() : await response.text();

    // Check for new token in response headers (auto-login token refresh)
    const newToken = response.headers.get("X-New-Token");
    if (newToken) {
      const { setUser } = useAuthStore.getState();
      if (user) {
        setUser({ ...user, token: newToken });
      }
    }

    // Also check for new token in response body (for validate_token endpoint)
    if (isJSON && data && typeof data === 'object' && 'token' in data && data.token) {
      const { setUser } = useAuthStore.getState();
      if (user) {
        setUser({ ...user, token: data.token });
      }
      // Also update localStorage
      localStorage.setItem('juicyMeetsAuthToken', data.token);
    }

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
