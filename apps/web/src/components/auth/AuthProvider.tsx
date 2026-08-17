'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Fetch current user if token exists (handled by HttpOnly cookie and Next.js proxy)
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await authApi.get('/me');
      return response.data as User;
    },
    retry: false,
  });

  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
      // Fetch access token for WebSocket use
      authApi.get('/session').then(res => {
        setAccessToken(res.data.accessToken);
      }).catch(() => setAccessToken(null));
    } else if (error) {
      setIsAuthenticated(false);
      setAccessToken(null);
    }
  }, [user, error]);

  const login = async (credentials: any) => {
    await authApi.post('/login', credentials);
    await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    router.push('/dashboard');
  };

  const register = async (data: any) => {
    await authApi.post('/register', data);
    router.push('/login?registered=true');
  };

  const logout = async () => {
    await authApi.post('/logout');
    setIsAuthenticated(false);
    setAccessToken(null);
    queryClient.setQueryData(['currentUser'], null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        accessToken,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
