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
  const adminAuth = useAdminAuthStore.getState();
  const token = adminAuth.token;
  let adminEmail: string | undefined;

  // Get admin email for auto-login fallback
  if (adminAuth.admin?.email) {
    adminEmail = adminAuth.admin.email;
  } else {
    try {
      const storedAdmin = localStorage.getItem('juicy-meets-admin-auth-storage');
      if (storedAdmin) {
        const adminData = JSON.parse(storedAdmin);
        adminEmail = adminData?.state?.admin?.email;
      }
    } catch {
      console.warn('Could not access localStorage for admin email');
    }
  }

  console.log('🔍 Admin API Request Debug:', { endpoint, hasToken: !!token, hasEmail: !!adminEmail });

  // Check if the body is FormData
  const isFormData = options.body instanceof FormData;

  // Prepare request body with email for auto-login
  let requestBody = options.body;
  if (adminEmail && !isFormData) {
    if (options.method === 'POST' && requestBody) {
      try {
        const bodyData = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
        bodyData.email = adminEmail;
        requestBody = JSON.stringify(bodyData);
      } catch (error) {
        console.warn('Could not add email to admin request body:', error);
      }
    } else if (options.method === 'POST' && !requestBody) {
      // If no body exists, create one with just the email
      requestBody = JSON.stringify({ email: adminEmail });
    } else if (['GET', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')) {
      // For non-POST requests, add email as query parameter
      const modifiedEndpoint = `${endpoint}${endpoint.includes('?') ? '&' : '?'}email=${encodeURIComponent(adminEmail)}`;
      // Update the endpoint for the final request
      endpoint = modifiedEndpoint;
    }
  }
  console.log('🔍 Request body:', requestBody);
  const config: RequestInit = {
    ...options,
    body: requestBody,
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

    // Check for new token in response headers (auto-login token refresh)
    const newToken = response.headers.get("X-New-Token");
    if (newToken) {
      console.log("🔄 Received new token from auto-login, updating store");
      const { setAdmin } = useAdminAuthStore.getState();
      if (adminAuth.admin) {
        setAdmin(adminAuth.admin, newToken);
      }
    }

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
