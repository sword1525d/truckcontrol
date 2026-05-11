'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Loader2, PlayCircle, ClipboardCheck, Fuel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function DashboardTruckPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const [isCheckingRun, setIsCheckingRun] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated || !profile) {
      router.push('/login');
      return;
    }
  }, [isAuthLoading, isAuthenticated, profile, router]);

  useEffect(() => {
    if (!profile) return;

    const checkForActiveRun = async () => {
      setIsCheckingRun(true);
      try {
        const companyId = profile.companyId;
        const sectorId = profile.sectorId;
        if (!companyId || !sectorId) return;

        const runs = await api.get<{ id: string }[]>(
          `/api/companies/${companyId}/sectors/${sectorId}/runs?status=IN_PROGRESS&driverId=${profile.id}`
        );

        if (Array.isArray(runs) && runs.length > 0) {
          setActiveRunId(runs[0].id);
        } else {
          setActiveRunId(null);
        }

      } catch (error) {
        console.error("Erro ao buscar corridas ativas:", error);
        toast({
          variant: 'destructive',
          title: 'Erro de Rede',
          description: 'Nao foi possivel verificar se ha uma corrida ativa.',
        });
      } finally {
        setIsCheckingRun(false);
      }
    };

    checkForActiveRun();
  }, [profile, toast]);

  if (isAuthLoading || !profile || isCheckingRun) {
    return (
      <div className="flex flex-col flex-grow">
        <Header />
        <div className="flex-grow flex items-center justify-center bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  const navItems = [
    {
      href: activeRunId ? `/dashboard-truck/active-run?id=${activeRunId}` : '/dashboard-truck/run',
      icon: PlayCircle,
      title: activeRunId ? 'Continuar Trajeto' : 'Iniciar Trajeto',
      colSpan: 'sm:col-span-2'
    },
    {
      href: '/dashboard-truck/checklist',
      icon: ClipboardCheck,
      title: 'Checklist Diario',
    },
    {
      href: '/dashboard-truck/refuel',
      icon: Fuel,
      title: 'Registrar Abastecimento',
    }
  ]

  return (
    <div className="bg-background flex flex-col flex-grow">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col pb-24">
        <div className="max-w-4xl w-full mx-auto flex-grow flex flex-col sm:justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 flex-grow sm:flex-grow-0">

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`block h-full ${item.colSpan ? item.colSpan : ''}`}>
                  <Card className="hover:border-primary/80 hover:bg-accent/50 transition-all h-full sm:h-auto sm:aspect-square flex flex-col">
                    <CardContent className="p-6 flex flex-col flex-grow items-center justify-center text-center gap-4">
                      <div className="bg-primary/10 p-4 sm:p-5 rounded-full">
                        <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-semibold">{item.title}</CardTitle>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
