
'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider, useFirebase } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rotas públicas ou do módulo carro que não exigem auth do Firebase
    const isPublicOrCarRoute = pathname === '/' || pathname === '/login-car' || pathname.startsWith('/dashboard-car');

    if (!isUserLoading && !user && pathname !== '/login' && !isPublicOrCarRoute) {
      router.push('/');
    }
  }, [user, isUserLoading, pathname, router]);

  // Se estiver carregando, mostra loading SOMENTE se não for login e não for rota pública/carro
  const isPublicOrCarRoute = pathname === '/' || pathname === '/login-car' || pathname.startsWith('/dashboard-car');
  if (isUserLoading && pathname !== '/login' && !isPublicOrCarRoute) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium text-sm">Verificando acesso...</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthGuard>
        {children}
      </AuthGuard>
    </FirebaseProvider>
  );
}