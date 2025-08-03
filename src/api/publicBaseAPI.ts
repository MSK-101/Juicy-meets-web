const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export class PublicAPIError extends Error {
  constructor(message: string, public status: number, public response?: unknown) {
    super(message);
    this.name = "PublicAPIError";
  }
}

export const publicApiRequest = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const contentType = response.headers.get("content-type");
    const isJSON = contentType?.includes("application/json");
    const data = isJSON ? await response.json() : await response.text();

    if (!response.ok) {
      throw new PublicAPIError(
        data?.message || data || "An error occurred",
        response.status,
        data
      );
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof PublicAPIError) {
      throw error;
    }
    throw new PublicAPIError(
      error instanceof Error ? error.message : "An error occurred",
      500,
      error
    );
  }
};

export const publicApi = {
  get: <T = unknown>(endpoint: string, options?: RequestInit) =>
    publicApiRequest<T>(endpoint, { method: "GET", ...options }),

  post: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    publicApiRequest<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
};
