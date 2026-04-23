'use client';

import { useRouter } from 'next/navigation';
import { Car, Truck } from 'lucide-react';
import { useEffect } from 'react';
import { useFirebase } from '@/firebase';

export default function ModeSelectPage() {
  const router = useRouter();
  const { user, isUserLoading } = useFirebase();

  // Se já logado no sistema truck, vai direto
  useEffect(() => {
    if (!isUserLoading && user) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          router.replace(userData.isAdmin ? '/dashboard' : '/dashboard-truck');
          return;
        } catch { /* ignore */ }
      }
    }
    // Se já logado no sistema carro
    const carUser = localStorage.getItem('car_usuario');
    if (carUser) {
      router.replace('/dashboard-car');
    }
  }, [user, isUserLoading, router]);

  const handleSelect = (mode: 'car' | 'truck') => {
    if (mode === 'car') {
      router.push('/login-car');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-10">
        {/* Logo / Brand */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/logo_lsl.png" alt="LSL" className="h-8 w-auto opacity-90" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">FrotaControl</h1>
          <p className="text-blue-300/70 mt-2 text-sm">Selecione o tipo de veículo para continuar</p>
        </div>

        {/* Mode Cards */}
        <div className="w-full grid grid-cols-2 gap-4">
          <button
            id="btn-select-car"
            onClick={() => handleSelect('car')}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/40 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
              <Car className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg leading-tight">Carro</p>
              <p className="text-white/40 text-xs mt-1">Frota de veículos leves</p>
            </div>
            <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-blue-400/60" />
          </button>

          <button
            id="btn-select-truck"
            onClick={() => handleSelect('truck')}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-amber-500/10 active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-shadow">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg leading-tight">Caminhão</p>
              <p className="text-white/40 text-xs mt-1">Frota Milkrun / Pesados</p>
            </div>
            <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-amber-400/60" />
          </button>
        </div>

        <p className="text-white/20 text-xs text-center">
          FrotaControl © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
