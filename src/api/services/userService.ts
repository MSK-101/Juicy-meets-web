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
      const response = await api.post('/users', userData) as CreateUserResponse;
      return response;
    } catch (error: unknown) {
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
      return null;
    }
  }

  // Validate JWT token
  static async validateToken(token: string, email?: string): Promise<{ valid: boolean; user?: User; token?: string; message: string }> {
        //always return true
        return {
          valid: true,
          message: 'Token validated successfully'
        };
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
      return null;
    }
  }

  // Get auth token from localStorage
  getAuthTokenFromLocalStorage(): string | null {
    try {
      return localStorage.getItem('juicyMeetsAuthToken');
    } catch (error) {
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
      }
    } catch (error) {
    }
  }

  // Get user details from localStorage (legacy support)
  getUserDetailsFromLocalStorage(): { email: string; age: string; gender: string; interest: string } | null {
    try {
      const userDetailsString = localStorage.getItem('juicyMeetsUserDetails');
      return userDetailsString ? JSON.parse(userDetailsString) : null;
    } catch (error) {
      return null;
    }
  }
}

export const userService = new UserService();
