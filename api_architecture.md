# React Query + Service Layer API Architecture Guide

## Overview

This guide demonstrates a scalable API architecture pattern using React Query (TanStack Query) with a layered service approach. This structure provides type safety, centralized error handling, automatic caching, and excellent developer experience.

## Architecture Layers

┌─────────────────┐
│ Components │ ← Uses hooks for data fetching/mutations
└─────────────────┘
│
┌─────────────────┐
│ React Query │ ← Handles caching, loading states, errors
│ Hooks Layer │
└─────────────────┘
│
┌─────────────────┐
│ Service Layer │ ← Business logic, data transformation
└─────────────────┘
│
┌─────────────────┐
│ Base API Layer │ ← HTTP client, auth, error handling
└─────────────────┘
│
┌─────────────────┐
│ Zustand Store │ ← Client state (auth, user data)
└─────────────────┘

## Why This Structure is Better

### ✅ Advantages

- **Separation of Concerns**: Each layer has a single responsibility
- **Type Safety**: Full TypeScript integration across all layers
- **Centralized Error Handling**: Consistent error management
- **Automatic Caching**: React Query handles all caching logic
- **Optimistic Updates**: Built-in support for better UX
- **Code Reusability**: Services can be used across multiple hooks
- **Testing**: Easy to mock and test each layer independently
- **Scalability**: Easy to add new endpoints and features

### ❌ Problems It Solves

- Eliminates prop drilling for server state
- Prevents duplicate API calls
- Removes manual loading/error state management
- Avoids scattered API logic across components
- Eliminates cache invalidation complexity

---

## 1. Base API Layer

### Purpose

Centralized HTTP client with authentication, error handling, and request/response processing.

### Implementation Pattern

```typescript
// src/api/baseAPI.ts
import { useUserStore } from "@/store/userStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

// Custom error class for better error handling
export class APIError extends Error {
  constructor(message: string, public status: number, public response?: any) {
    super(message);
    this.name = "APIError";
  }
}

// Main request function with auth and error handling
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  // Get token from Zustand store
  const token = useUserStore.getState().user?.token;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  // Handle response parsing
  const contentType = response.headers.get("content-type");
  const isJSON = contentType?.includes("application/json");
  const data = isJSON ? await response.json() : await response.text();

  // Throw custom error for non-ok responses
  if (!response.ok) {
    throw new APIError(
      data?.message || data || "An error occurred",
      response.status,
      data
    );
  }

  return data;
};

// HTTP method helpers
export const api = {
  get: (endpoint: string, options?: RequestInit) =>
    apiRequest(endpoint, { method: "GET", ...options }),

  post: (endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  put: (endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),

  delete: (endpoint: string, options?: RequestInit) =>
    apiRequest(endpoint, { method: "DELETE", ...options }),
};
```

### Key Features

- **Automatic Authentication**: Injects JWT tokens from Zustand store
- **Error Standardization**: Custom APIError class with status codes
- **Content Type Handling**: Handles both JSON and text responses
- **Environment Configuration**: Uses environment variables for base URL

---

## 2. Zustand Store Integration

### Purpose

Client-side state management for user authentication and session data.

### Implementation Pattern

```typescript
// src/store/userStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  name: string;
  token?: string; // JWT token for API requests
  // ... other user fields
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  hasHydrated: boolean;

  // Actions
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isLoading: false,
      hasHydrated: false,

      // Actions
      setUser: (user: User) => set({ user, isLoading: false }),

      updateUser: (updates: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearUser: () => set({ user: null, isLoading: false }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
    }),
    {
      name: "app-user-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Convenience hooks
export const useSetUser = () => useUserStore((state) => state.setUser);
export const useClearUser = () => useUserStore((state) => state.clearUser);
export const useUpdateUser = () => useUserStore((state) => state.updateUser);
export const useUser = () => useUserStore((state) => state.user);
```

---

## 3. Service Layer

### Purpose

Business logic, data transformation, and API endpoint definitions.

### Implementation Pattern

```typescript
// src/api/services/userService.ts
import { api } from "../baseAPI";

// Type definitions for requests/responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  jwt: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  bio?: string;
}

// Service object with all user-related API calls
export const userService = {
  // Authentication
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    api.post("/v1/sessions", credentials),

  logout: (): Promise<void> => api.delete("/v1/sessions"),

  // Profile management
  getCurrentUser: (): Promise<User> => api.get("/v1/users/me"),

  updateProfile: (
    userId: string,
    updates: UpdateProfileRequest
  ): Promise<User> => api.patch(`/v1/users/${userId}`, updates),

  // Social features
  followUser: (userId: string): Promise<void> =>
    api.post(`/v1/users/${userId}/follow`),

  getFollowers: (userId: string): Promise<User[]> =>
    api.get(`/v1/users/${userId}/followers`),
};
```

```typescript
// src/api/services/gearService.ts
import { api } from "../baseAPI";

export interface GearSearchParams {
  query?: string;
  brand_ids?: number[];
  page?: number;
  limit?: number;
}

export interface Gear {
  id: number;
  name: string;
  brand: { id: number; name: string };
  // ... other gear fields
}

export const gearService = {
  searchGears: (params: GearSearchParams): Promise<Gear[]> => {
    const searchParams = new URLSearchParams();

    if (params.query) searchParams.append("query", params.query);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());

    const query = searchParams.toString();
    return api.get(`/v1/gears${query ? `?${query}` : ""}`);
  },

  getGear: (gearId: number): Promise<Gear> => api.get(`/v1/gears/${gearId}`),

  addToCollection: (gearIds: number[]): Promise<any> =>
    api.post("/v1/user_gears", { gear_ids: gearIds }),
};

// src/providers/QueryProvider.tsx
("use client");

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors except 401
              if (
                error?.status >= 400 &&
                error?.status < 500 &&
                error?.status !== 401
              ) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.status >= 400 && error?.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};
```

### Service Layer Conventions

- **Single Responsibility**: Each service handles one domain (user, gear, etc.)
- **Type Safety**: All inputs/outputs are typed
- **Pure Functions**: Services don't manage state, just API calls
- **Consistent Naming**: Methods match their API endpoints
- **Parameter Handling**: Complex parameters are properly serialized

---

## 4. React Query Provider Setup

### Purpose

Configure React Query client with caching strategies and error handling.

### Provider Integration

```typescript
// src/app/layout.tsx
import { QueryProvider } from "@/providers/QueryProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

---

## 5. React Query Hooks Layer

### Purpose

React Query integration with services, providing caching, loading states, and mutations.

### Query Hooks Pattern

```typescript
// src/api/hooks/useUserQueries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  userService,
  LoginRequest,
  UpdateProfileRequest,
} from "../services/userService";
import { useSetUser, useClearUser, useUpdateUser } from "@/store";

// Query key factory for consistent caching
export const userKeys = {
  all: ["users"] as const,
  current: () => [...userKeys.all, "current"] as const,
  profile: (userId: string) => [...userKeys.all, "profile", userId] as const,
  followers: (userId: string) =>
    [...userKeys.all, "followers", userId] as const,
};

// Query hooks (for fetching data)
export const useCurrentUser = () => {
  return useQuery({
    queryKey: userKeys.current(),
    queryFn: userService.getCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: userKeys.profile(userId),
    queryFn: () => userService.getProfile(userId),
    enabled: !!userId, // Only run if userId exists
  });
};

// Mutation hooks (for changing data)
export const useLogin = () => {
  const setUser = useSetUser();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => userService.login(credentials),
    onSuccess: (response) => {
      // Update Zustand store with user data and token
      setUser({ ...response.user, token: response.jwt });
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });
};

export const useUpdateProfile = () => {
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      updates,
    }: {
      userId: string;
      updates: UpdateProfileRequest;
    }) => userService.updateProfile(userId, updates),
    onSuccess: (updatedUser, { userId }) => {
      // Update Zustand store
      updateUser(updatedUser);

      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: userKeys.profile(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
};

export const useLogout = () => {
  const clearUser = useClearUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.logout,
    onSuccess: () => {
      // Clear user from store
      clearUser();
      // Clear all cached data
      queryClient.clear();
    },
  });
};
```

### Advanced Hooks Pattern (Infinite Queries, Debouncing)

```typescript
// src/api/hooks/useGearQueries.ts
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { gearService, GearSearchParams } from "../services/gearService";

// Query keys
export const gearQueryKeys = {
  all: ["gears"] as const,
  search: (params: GearSearchParams) => ["gears", "search", params] as const,
  detail: (id: number) => ["gears", "detail", id] as const,
};

// Standard search with pagination
export const useGearSearch = (params: GearSearchParams, enabled = true) => {
  return useQuery({
    queryKey: gearQueryKeys.search(params),
    queryFn: () => gearService.searchGears(params),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};

// Infinite scroll search
export const useInfiniteGearSearch = (
  baseParams: Omit<GearSearchParams, "page">,
  enabled = true
) => {
  return useInfiniteQuery({
    queryKey: gearQueryKeys.search(baseParams),
    queryFn: ({ pageParam = 1 }) =>
      gearService.searchGears({ ...baseParams, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
  });
};

// Mutation with cache updates
export const useAddToCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gearIds: number[]) => gearService.addToCollection(gearIds),
    onSuccess: () => {
      // Invalidate user gear queries
      queryClient.invalidateQueries({ queryKey: ["user-gears"] });
    },
  });
};
```

### User Gear Hooks Pattern

```typescript
// src/api/hooks/useUserGearQueries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserGears,
  createUserGears,
  updateUserGear,
  deleteUserGear,
  type CreateUserGearRequest,
  type UpdateUserGearRequest,
  type UserGearQueryParams,
} from "../services/userGearService";

// Query keys for consistent caching
export const userGearQueryKeys = {
  all: ["user-gears"] as const,
  list: (params: UserGearQueryParams) =>
    ["user-gears", "list", params] as const,
  detail: (id: number) => ["user-gears", "detail", id] as const,
};

// Hook for fetching user gears
export const useUserGears = (
  params: UserGearQueryParams = {},
  enabled = true
) => {
  return useQuery({
    queryKey: userGearQueryKeys.list(params),
    queryFn: () => getUserGears(params),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for creating user gears
export const useCreateUserGears = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserGearRequest) => createUserGears(data),
    onSuccess: (data, variables) => {
      // Invalidate and refetch user gears queries
      queryClient.invalidateQueries({ queryKey: userGearQueryKeys.all });
    },
  });
};

// Hook for updating a user gear
export const useUpdateUserGear = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserGearRequest }) =>
      updateUserGear(id, data),
    onSuccess: (updatedUserGear, variables) => {
      // Update the specific user gear in cache
      queryClient.setQueryData(
        userGearQueryKeys.detail(variables.id),
        updatedUserGear
      );
      // Invalidate list queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: userGearQueryKeys.all });
    },
  });
};

// Hook for deleting a user gear
export const useDeleteUserGear = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteUserGear(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: userGearQueryKeys.detail(deletedId),
      });
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: userGearQueryKeys.all });
    },
  });
};
```

### Debounce Hook Pattern

```typescript
// src/api/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// Usage in components
export const useDebouncedSearch = (searchQuery: string, delay = 300) => {
  return useDebounce(searchQuery, delay);
};
```

---

## 6. Complete Service Layer Examples

### User Gear Service

```typescript
// src/api/services/userGearService.ts
import { api } from "../baseAPI";

export interface UserGear {
  id: number;
  user_id: number;
  gear_id: number;
  gear: any; // The full gear object
  featured: boolean;
  is_public: boolean;
  price?: string;
  purchased_at?: string;
  purchased_from?: string;
  serial_number?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserGearRequest {
  gear_ids: number[];
  gear_type_id?: number;
  featured?: boolean;
}

export interface UpdateUserGearRequest {
  featured?: boolean;
  price?: string;
  purchased_at?: string;
  purchased_from?: string;
  serial_number?: string;
  is_public?: boolean;
}

export interface UserGearQueryParams {
  user_id?: number;
  is_instrument?: boolean;
  gear_type_id?: number;
  featured?: boolean;
}

export async function getUserGears(
  params: UserGearQueryParams = {}
): Promise<UserGear[]> {
  const searchParams = new URLSearchParams();

  if (params.user_id) searchParams.append("user_id", params.user_id.toString());
  if (params.is_instrument !== undefined)
    searchParams.append("is_instrument", params.is_instrument.toString());
  if (params.gear_type_id)
    searchParams.append("gear_type_id", params.gear_type_id.toString());
  if (params.featured !== undefined)
    searchParams.append("featured", params.featured.toString());

  const query = searchParams.toString();
  return api.get(`/v1/user_gears${query ? `?${query}` : ""}`);
}

export async function createUserGears(
  data: CreateUserGearRequest
): Promise<UserGear[]> {
  return api.post("/v1/user_gears", data);
}

export async function updateUserGear(
  id: number,
  data: UpdateUserGearRequest
): Promise<UserGear> {
  return api.put(`/v1/user_gears/${id}`, data);
}

export async function deleteUserGear(id: number): Promise<void> {
  return api.delete(`/v1/user_gears/${id}`);
}
```

---

## 7. Component Integration Patterns

### Basic Query Usage

```typescript
// Component using queries
import { useCurrentUser, useUserProfile } from "@/api/hooks/useUserQueries";

export const UserProfile = ({ userId }: { userId: string }) => {
  const { data: currentUser } = useCurrentUser();
  const { data: user, isLoading, error, refetch } = useUserProfile(userId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {currentUser?.id === user.id && <p>This is you!</p>}
    </div>
  );
};
```

### Mutation Usage

```typescript
// Component using mutations
import { useLogin } from "@/api/hooks/useUserQueries";
import { useState } from "react";

export const LoginForm = () => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(credentials);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={credentials.email}
        onChange={(e) =>
          setCredentials((prev) => ({ ...prev, email: e.target.value }))
        }
        placeholder="Email"
      />
      <input
        type="password"
        value={credentials.password}
        onChange={(e) =>
          setCredentials((prev) => ({ ...prev, password: e.target.value }))
        }
        placeholder="Password"
      />
      <button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Logging in..." : "Login"}
      </button>
      {loginMutation.error && (
        <p className="error">{loginMutation.error.message}</p>
      )}
    </form>
  );
};
```

### Search with Debouncing

```typescript
// Search component with debouncing
import { useState } from "react";
import { useGearSearch } from "@/api/hooks/useGearQueries";
import { useDebouncedSearch } from "@/api/hooks/useDebounce";

export const GearSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedSearch(searchQuery, 300);

  const { data: gears, isLoading } = useGearSearch(
    { query: debouncedQuery },
    !!debouncedQuery // Only search if there's a query
  );

  return (
    <div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search gears..."
      />

      {isLoading && <p>Searching...</p>}

      <div>
        {gears?.map((gear) => (
          <div key={gear.id}>{gear.name}</div>
        ))}
      </div>
    </div>
  );
};
```

---

## 8. API Index File

### Purpose

Central export point for all API functionality.

```typescript
// src/api/index.ts
// Base API
export { api, apiRequest, APIError } from "./baseAPI";

// Services and types
export * from "./services/userService";
export * from "./services/gearService";

// React Query hooks
export * from "./hooks/useUserQueries";
export * from "./hooks/useGearQueries";
export * from "./hooks/useUserGearQueries";
export * from "./hooks/useDebounce";
```

---

## 9. Complete File Structure

src/
├── api/
│ ├── baseAPI.ts # HTTP client with auth
│ ├── index.ts # Export all API functions
│ ├── services/
│ │ ├── userService.ts # User-related API calls
│ │ ├── gearService.ts # Gear-related API calls
│ │ └── userGearService.ts # User gear management
│ └── hooks/
│ ├── useUserQueries.ts # User React Query hooks
│ ├── useGearQueries.ts # Gear React Query hooks
│ ├── useUserGearQueries.ts # User gear hooks
│ └── useDebounce.ts # Utility hooks
├── store/
│ ├── index.ts # Export store hooks
│ └── userStore.ts # Zustand user store
├── providers/
│ └── QueryProvider.tsx # React Query provider
└── components/
└── ... # Components using hooks

---

## 10. Implementation Steps for New Projects

### Step 1: Setup Dependencies

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools zustand
```

### Step 2: Create Base API Layer

1. Create `src/api/baseAPI.ts` with HTTP client
2. Add authentication integration with store
3. Implement error handling with custom APIError class

### Step 3: Setup Zustand Store

1. Create `src/store/userStore.ts` for authentication
2. Add persistence with localStorage
3. Create convenience hooks for store actions

### Step 4: Create React Query Provider

1. Create `src/providers/QueryProvider.tsx`
2. Configure caching strategies and retry logic
3. Wrap app with provider in layout/main component

### Step 5: Implement Service Layer

1. Create service files in `src/api/services/`
2. Define TypeScript interfaces for requests/responses
3. Implement API methods using base API client

### Step 6: Create React Query Hooks

1. Create hook files in `src/api/hooks/`
2. Implement query hooks for fetching data
3. Implement mutation hooks for changing data
4. Add proper cache invalidation strategies

### Step 7: Create API Index

1. Create `src/api/index.ts` to export all API functionality
2. This provides a clean import interface for components

### Step 8: Integrate in Components

1. Use hooks in components instead of direct API calls
2. Handle loading states and errors appropriately
3. Implement optimistic updates where beneficial

---

## 11. Best Practices

### Query Key Management

- Use factory functions for consistent query keys
- Include relevant parameters in query keys
- Use hierarchical key structures for easy invalidation

### Error Handling

- Implement global error handling in base API
- Use React Query's built-in error boundaries
- Provide user-friendly error messages

### Performance

- Set appropriate stale times based on data freshness needs
- Use infinite queries for paginated data
- Implement debouncing for search inputs
- Clean up unused queries with garbage collection

### Type Safety

- Define interfaces for all API requests/responses
- Use generic types in hooks for better inference
- Leverage TypeScript's strict mode

### Cache Invalidation

- Use specific query keys for targeted invalidation
- Implement optimistic updates for better UX
- Consider background refetching for critical data

### Testing

- Mock services at the service layer for unit tests
- Use React Query's testing utilities
- Test error scenarios and loading states

This architecture provides a solid foundation for scalable React applications with excellent developer experience and maintainability.
