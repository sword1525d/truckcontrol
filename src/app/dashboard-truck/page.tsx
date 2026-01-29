'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Loader2, PlayCircle, ClipboardCheck, Fuel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';

type UserData = {
  id: string;
  name: string;
  isAdmin: boolean;
  truck: boolean;
  companyId: string;
  sectorId: string;
  matricula: string;
};

export default function DashboardTruckPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, auth, user: authUser, isUserLoading } = useFirebase();
  const [user, setUser] = useState<UserData | null>(null);
  const [isCheckingRun, setIsCheckingRun] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) {
      return; // Aguardar o estado de autenticação ser resolvido
    }

    if (!authUser) {
      toast({
        variant: 'destructive',
        title: 'Sessão Expirada',
        description: 'Por favor, faça login novamente.',
      });
      router.push('/login');
      return;
    }

    const storedUser = localStorage.getItem('user');
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');
    const matricula = localStorage.getItem('matricula');

    if (storedUser && companyId && sectorId && matricula) {
        const parsedUser = JSON.parse(storedUser);
      setUser({ ...parsedUser, id: authUser.uid, companyId, sectorId, matricula });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro de Sessão',
        description: 'Dados da sessão não encontrados. Por favor, faça login novamente.',
      });
      auth.signOut();
      localStorage.clear();
      router.push('/login');
    }
  }, [isUserLoading, authUser, router, toast, auth]);
  
  useEffect(() => {
    if (!firestore || !user || !authUser) return;
    
    const checkForActiveRun = async () => {
      setIsCheckingRun(true);
      try {
        const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
        const activeRunsQuery = query(runsCol, 
            where('status', '==', 'IN_PROGRESS'),
            where('driverId', '==', authUser.uid)
        );
        const activeRunsSnapshot = await getDocs(activeRunsQuery);

        if (!activeRunsSnapshot.empty) {
          setActiveRunId(activeRunsSnapshot.docs[0].id);
        } else {
          setActiveRunId(null);
        }

      } catch (error) {
        console.error("Erro ao buscar corridas ativas:", error);
        toast({
          variant: 'destructive',
          title: 'Erro de Rede',
          description: 'Não foi possível verificar se há uma corrida ativa.',
        });
      } finally {
        setIsCheckingRun(false);
      }
    };

    checkForActiveRun();
  }, [firestore, user, authUser, toast]);


  if (isUserLoading || !user || isCheckingRun) {
    return (
        <>
            <Header />
            <div className="flex flex-grow items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </>
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
          title: 'Checklist Diário',
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
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
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
    </div>
  );
}
