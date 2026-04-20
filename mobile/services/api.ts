import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  AuthResponse,
  ApiResponse,
  SignUpRequest,
  LoginRequest,
  ForgotPasswordRequest,
  VerifyResetCodeRequest,
  ResetPasswordRequest,
} from '@/types/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'rummikub_auth_token';

// Platform detection - check if localStorage is available
const isWeb = typeof localStorage !== 'undefined';

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      async (config) => {
        // Add token to requests if available
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Handle 401 - token expired
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          this.clearToken();
        }
        return Promise.reject(error);
      }
    );
  }

  // Initialize - load token from storage
  async init() {
    try {
      let storedToken: string | null = null;
      
      if (isWeb) {
        // Use localStorage on web
        storedToken = localStorage.getItem(TOKEN_KEY);
      } else {
        // Use SecureStore on native
        try {
          storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        } catch (error) {
          console.warn('Failed to load from SecureStore:', error);
        }
      }
      
      if (storedToken) {
        this.token = storedToken;
      }
    } catch (error) {
      console.error('Failed to load token from storage:', error);
    }
  }

  // Auth APIs
  async signup(data: SignUpRequest): Promise<AuthResponse> {
    try {
      const response = await this.api.post('/auth/signup', data);
      if (response.data.data?.token) {
        await this.setToken(response.data.data.token);
      }
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.api.post('/auth/login', data);
      if (response.data.data?.token) {
        await this.setToken(response.data.data.token);
      }
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse> {
    try {
      const response = await this.api.post('/auth/forgot-password', data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async verifyResetCode(data: VerifyResetCodeRequest): Promise<ApiResponse> {
    try {
      const response = await this.api.post('/auth/verify-reset-code', data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse> {
    try {
      const response = await this.api.post('/auth/reset-password', data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getProfile(): Promise<ApiResponse> {
    try {
      const response = await this.api.get('/auth/profile');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Token management
  private async setToken(token: string) {
    this.token = token;
    try {
      if (isWeb) {
        // Use localStorage on web
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        // Use SecureStore on native
        try {
          await SecureStore.setItemAsync(TOKEN_KEY, token);
        } catch (error) {
          console.warn('Failed to store token in SecureStore:', error);
        }
      }
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  async clearToken() {
    this.token = null;
    try {
      if (isWeb) {
        // Use localStorage on web
        localStorage.removeItem(TOKEN_KEY);
      } else {
        // Use SecureStore on native
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        } catch (error) {
          console.warn('Failed to delete token from SecureStore:', error);
        }
      }
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Error handling
  private handleError(error: any): ApiResponse {
    console.error('API Error:', error);

    if (axios.isAxiosError(error)) {
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || 'An error occurred',
        };
      }

      if (error.message === 'Network Error') {
        return {
          success: false,
          message: 'Network error. Please check your connection.',
        };
      }

      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Request timeout. Please try again.',
        };
      }
    }

    return {
      success: false,
      message: 'An unexpected error occurred',
    };
  }
}

// Export singleton instance
export const apiService = new ApiService();
