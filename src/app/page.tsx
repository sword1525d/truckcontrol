'use client';

import { useRouter } from 'next/navigation';
import { Car, Truck, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Footer } from '@/components/footer';

export default function ModeSelectPage() {
  const router = useRouter();
  const { profile, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && profile) {
      router.replace(profile.isAdmin ? '/dashboard' : '/dashboard-truck');
      return;
    }
    const carUser = localStorage.getItem('car_usuario');
    if (carUser) {
      try {
        const u = JSON.parse(carUser);
        const isAdminOrOP = u.adm || u.role === 'adm' || u.op;
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        router.replace(isAdminOrOP && isDesktop ? '/dashboard-car/admin' : '/dashboard-car');
      } catch {
        router.replace('/dashboard-car');
      }
    }
  }, [profile, isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-background sticky top-0 z-10">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-3">
            <Truck className="h-7 w-7 text-primary" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl">Frotacontrol</span>
              <div className="flex items-center gap-1 pt-1">
                <span className="text-[10px] font-medium italic">by</span>
                <img src="/logo_lsl.png" alt="LSL" className="h-3 w-auto" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Bem-vindo</h1>
            <p className="text-sm text-muted-foreground">Selecione o tipo de frota para continuar</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Carro */}
            <Card
              id="btn-select-car"
              className={cn('cursor-pointer border-2 transition-all duration-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]')}
              onClick={() => router.push('/login-car')}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                  <Car className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-base">Carro</p>
                  <p className="text-sm text-muted-foreground">Frota de veículos leves</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            {/* Caminhão */}
            <Card
              id="btn-select-truck"
              className={cn('cursor-pointer border-2 transition-all duration-200 hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]')}
              onClick={() => router.push('/login')}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                  <Truck className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-base">Caminhão</p>
                  <p className="text-sm text-muted-foreground">Frota Milkrun / Pesados</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
