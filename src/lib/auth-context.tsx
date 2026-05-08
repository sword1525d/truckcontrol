'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, LoginResponse } from '@/types/api';
import { api, setTokens, clearTokens, loadTokens, getAccessToken } from './api-client';

interface AuthState {
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (matriculaOrEmail: string, password: string, companyId?: string, sectorId?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      try {
        loadTokens();
        setProfile(JSON.parse(stored));
      } catch {
        // invalid stored data
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (
    matriculaOrEmail: string,
    password: string,
    companyId?: string,
    sectorId?: string
  ) => {
    const isEmail = matriculaOrEmail.includes('@');
    const body: Record<string, string> = { password };

    if (isEmail) {
      body.email = matriculaOrEmail;
      if (companyId) body.companyId = companyId;
      if (sectorId) body.sectorId = sectorId;
    } else {
      body.matricula = matriculaOrEmail;
      if (companyId) body.companyId = companyId;
      if (sectorId) body.sectorId = sectorId;
    }

    const data = await api.post<LoginResponse>('/api/auth/login', body);
    setTokens(data.token, data.refreshToken);
    setProfile(data.profile);
    localStorage.setItem('userProfile', JSON.stringify(data.profile));
    return data.profile;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore
    }
    clearTokens();
    setProfile(null);
    localStorage.removeItem('userProfile');
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        isLoading,
        isAuthenticated: !!profile,
        accessToken: getAccessToken(),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
