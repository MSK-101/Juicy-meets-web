import { api } from '../baseAPI';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export interface User {
  id: number;
  email: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  interested_in?: 'male' | 'female' | 'other';
  provider?: string;
  oauth_user: boolean;
  confirmed: boolean;
  confirmed_at: string;
  profile_completed: boolean;
  role: 'user' | 'staff' | 'admin';
  user_status: 'pending' | 'active' | 'suspended';
  coin_balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  user: {
    email: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    interested_in: 'male' | 'female' | 'other';
  };
}

export interface CreateUserResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    free_coins: {
      success: boolean;
      coins_given: number;
      message: string;
    };
    user_exists?: boolean;
  };
  message: string;
}

export interface GetUserResponse {
  success: boolean;
  data: {
    user: User;
  };
}

export class UserService {
  // Create a new user
  async createUser(userData: CreateUserRequest): Promise<CreateUserResponse> {
    try {
      console.log('🚀 Creating user with data:', userData);
      const response = await api.post('/users', userData) as CreateUserResponse;
      console.log('✅ User created successfully:', response.data);
      return response;
    } catch (error: unknown) {
      console.error('❌ Error creating user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      throw new Error(errorMessage);
    }
  }

  // Get current user from API
  static async getCurrentUser(): Promise<User | null> {
    try {
      const response = await api.get('/users/me') as { data: { user: User } };
      return response.data?.user || null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // Validate JWT token
  static async validateToken(token: string, email?: string): Promise<{ valid: boolean; user?: User; token?: string; message: string }> {
    try {
      const response = await fetch(`${BASE_URL}/users/validate_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        return {
          valid: true,
          user: data.user,
          token: data.token, // Include new token if auto-login occurred
          message: data.message
        };
      } else {
        return { valid: false, message: data.message || 'Token validation failed' };
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false, message: 'Network error during token validation' };
    }
  }

  // Store user in localStorage for quick access
  storeUserLocally(user: User, token?: string): void {
    localStorage.setItem('juicyMeetsUser', JSON.stringify(user));
    if (token) {
      localStorage.setItem('juicyMeetsAuthToken', token);
    }
  }

  // Get user from localStorage
  getUserFromLocalStorage(): User | null {
    try {
      const userString = localStorage.getItem('juicy-meets-auth-storage');
      const userstring = userString ? JSON.parse(userString) : null;
      return userstring && userstring.state.user;
    } catch (error) {
      console.error('❌ Error getting user from localStorage:', error);
      return null;
    }
  }

  // Get auth token from localStorage
  getAuthTokenFromLocalStorage(): string | null {
    try {
      return localStorage.getItem('juicyMeetsAuthToken');
    } catch (error) {
      console.error('❌ Error getting auth token from localStorage:', error);
      return null;
    }
  }

  // Clear user from localStorage
  clearUserFromLocalStorage(): void {
    localStorage.removeItem('juicyMeetsUser');
    localStorage.removeItem('juicyMeetsAuthToken');
    localStorage.removeItem('juicyMeetsUserDetails'); // Also clear old user details
  }

  // Update user's coin balance in localStorage
  updateUserCoinBalance(newBalance: number): void {
    try {
      const userString = localStorage.getItem('juicyMeetsUser');
      if (userString) {
        const user = JSON.parse(userString);
        user.coin_balance = newBalance;
        localStorage.setItem('juicyMeetsUser', JSON.stringify(user));
        console.log('💰 Updated user coin balance in localStorage:', newBalance);
      }
    } catch (error) {
      console.error('❌ Error updating user coin balance in localStorage:', error);
    }
  }

  // Get user details from localStorage (legacy support)
  getUserDetailsFromLocalStorage(): { email: string; age: string; gender: string; interest: string } | null {
    try {
      const userDetailsString = localStorage.getItem('juicyMeetsUserDetails');
      return userDetailsString ? JSON.parse(userDetailsString) : null;
    } catch (error) {
      console.error('❌ Error getting user details from localStorage:', error);
      return null;
    }
  }
}

export const userService = new UserService();
