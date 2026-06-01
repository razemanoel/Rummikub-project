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
import {
  GameState,
  SolveILPResponse,
  VisionAnalyzeResponse,
  VisionFeedbackPayload,
} from '@/types/rummikub';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'rummikub_auth_token';
const VISION_REQUEST_TIMEOUT_MS = 120000;

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

// Vision APIs
async analyzeBoards(
  myBoardUri?: string,
  sharedBoardUri?: string
): Promise<ApiResponse<VisionAnalyzeResponse>> {
  try {
    const formData = new FormData();

    const getMimeType = (uri: string) => {
      if (uri.endsWith('.png')) return 'image/png';
      if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) return 'image/jpeg';
      return 'image/jpeg';
    };

    // Add myBoard image if provided
    if (myBoardUri) {
      formData.append('myBoard', {
        uri: myBoardUri,
        type: getMimeType(myBoardUri),
        name: 'myBoard.jpg',
      } as any);
    }

    // Add sharedBoard image if provided
    if (sharedBoardUri) {
      formData.append('sharedBoard', {
        uri: sharedBoardUri,
        type: getMimeType(sharedBoardUri),
        name: 'sharedBoard.jpg',
      } as any);
    }

    const response = await this.api.post('/vision/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: VISION_REQUEST_TIMEOUT_MS,
    });

    return response.data;
  } catch (error) {
    return this.handleError(error);
  }
}

async submitVisionFeedback(
  feedbackPayload: VisionFeedbackPayload
): Promise<ApiResponse<{ savedCount: number; skippedDuplicateCount: number }>> {
  try {
    const formData = new FormData();
    const { sourceImages, ...payload } = feedbackPayload;

    formData.append('feedback', JSON.stringify(payload));

    const getMimeType = (uri: string) => {
      if (uri.endsWith('.png')) return 'image/png';
      if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) return 'image/jpeg';
      return 'image/jpeg';
    };

    if (sourceImages?.rack) {
      formData.append('rackImage', {
        uri: sourceImages.rack,
        type: getMimeType(sourceImages.rack),
        name: 'rack-feedback.jpg',
      } as any);
    }

    if (sourceImages?.board) {
      formData.append('boardImage', {
        uri: sourceImages.board,
        type: getMimeType(sourceImages.board),
        name: 'board-feedback.jpg',
      } as any);
    }

    const response = await this.api.post('/vision/feedback', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: VISION_REQUEST_TIMEOUT_MS,
    });

    return response.data;
  } catch (error) {
    return this.handleError(error);
  }
}

async checkVisionHealth(): Promise<ApiResponse> {
  try {
    const response = await this.api.get('/vision/health');
    return response.data;
  } catch (error) {
    return this.handleError(error);
  }
}

async solveGameState(gameState: GameState): Promise<ApiResponse<SolveILPResponse>> {
  try {
    const response = await this.api.post('/solver/solve', gameState);
    return response.data;
  } catch (error) {
    return this.handleError(error);
  }
}

async saveSolution(originalGameState: GameState, solution: SolveILPResponse): Promise<ApiResponse> {
  try {
    await this.init();

    const response = await this.api.post('/solutions', {
      originalGameState,
      solution,
    });

    return response.data;
  } catch (error) {
    return this.handleError(error);
  }
}

async getSolutionsHistory(): Promise<ApiResponse> {
  try {
    await this.init();

    const response = await this.api.get('/solutions');
    return response.data;
  } catch (error) {
    return this.handleError(error);
  }
}

async validateGameState(gameState: GameState): Promise<ApiResponse<any>> {
  try {
    const response = await this.api.post('/solver/validate', gameState);
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
