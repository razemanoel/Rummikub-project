import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types/auth';
import { apiService } from '@/services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      await apiService.init();
      const authToken = apiService.getToken();
      setToken(authToken);

      if (authToken) {
        // Try to fetch user profile
        await fetchProfile();
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiService.login({ email, password });

      if (!response.success) {
        throw new Error(response.message);
      }

      if (response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, confirmPassword: string) => {
    setIsLoading(true);
    try {
      const response = await apiService.signup({ email, password, confirmPassword });

      if (!response.success) {
        throw new Error(response.message);
      }

      if (response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await apiService.getProfile();

      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const logout = async () => {
    try {
      await apiService.clearToken();
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    signup,
    logout,
    getProfile: fetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
