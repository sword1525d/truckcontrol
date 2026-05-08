'use client';
import React, { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';

export function AppProvider({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
