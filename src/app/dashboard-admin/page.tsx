'use client';
import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle, PlayCircle, Clock, MapPin, Truck, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

type Stop = {
  name: string;
  status: StopStatus;
  arrivalTime: { seconds: number; nanoseconds: number } | null;
  departureTime: { seconds: number; nanoseconds: number } | null;
  collectedOccupiedCars: number | null;
  collectedEmptyCars: number | null;
  mileageAtStop: number | null;
};

type Run = {
  id: string;
  driverName: string;
  vehicleId: string;
  startMileage: number;
  startTime: { seconds: number; nanoseconds: number };
  status: 'IN_PROGRESS' | 'COMPLETED';
  stops: Stop[];
};

type UserData = {
  name: string;
  isAdmin: boolean;
  companyId: string;
  sectorId: string;
};


const AdminDashboardPage = () => {
  const { firestore, user: authUser } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [activeRuns, setActiveRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');

    if (storedUser && companyId && sectorId) {
      const parsedUser = JSON.parse(storedUser);
      setUser({ ...parsedUser, companyId, sectorId });
    } else {
      toast({
        variant: 'destructive',
        title: 'Sessão inválida',
        description: 'Faça login novamente.',
      });
      router.push('/login');
    }
  }, [router, toast]);


  const fetchActiveRuns = useCallback(() => {
    if (!firestore || !user) return;
    
    setIsLoading(true);

    const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
    const activeRunsQuery = query(runsCol, where('status', '==', 'IN_PROGRESS'));

    const unsubscribe = onSnapshot(activeRunsQuery, (querySnapshot) => {
      const runs: Run[] = [];
      querySnapshot.forEach((doc) => {
        runs.push({ id: doc.id, ...doc.data() } as Run);
      });
      setActiveRuns(runs.sort((a, b) => a.startTime.seconds - b.startTime.seconds));
      setLastUpdated(new Date());
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching active runs: ", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar dados',
        description: 'Não foi possível carregar os acompanhamentos ativos.',
      });
      setIsLoading(false);
    });

    return unsubscribe;

  }, [firestore, user, toast]);

  useEffect(() => {
    const unsubscribe = fetchActiveRuns();
    const interval = setInterval(() => setLastUpdated(new Date()), 1000); // Update time every second

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    }
  }, [fetchActiveRuns]);

  const getStatusInfo = (status: StopStatus) => {
    switch (status) {
      case 'COMPLETED': return { icon: CheckCircle, color: 'text-green-500', label: 'Concluído' };
      case 'IN_PROGRESS': return { icon: PlayCircle, color: 'text-blue-500', label: 'Em Andamento' };
      case 'PENDING': return { icon: Clock, color: 'text-gray-500', label: 'Pendente' };
      default: return { icon: Clock, color: 'text-gray-500', label: 'Pendente' };
    }
  };
  
  const formatTime = (timestamp: { seconds: number; nanoseconds: number } | null) => {
    if (!timestamp) return '--:--';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-black min-h-screen">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            Acompanhamento em Tempo Real
          </h1>
          <p className="text-muted-foreground">
            {lastUpdated ? `Atualizado em: ${lastUpdated.toLocaleTimeString('pt-BR')}` : 'Carregando...'}
          </p>
        </div>
        <Button onClick={() => fetchActiveRuns()} disabled={isLoading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeRuns.length === 0 ? (
        <Card className="text-center p-8">
            <CardHeader>
                <CardTitle>Nenhum acompanhamento ativo</CardTitle>
                <CardDescription>Não há motoristas em rota no momento.</CardDescription>
            </CardHeader>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={activeRuns[0]?.id}>
          {activeRuns.map(run => {
            const completedStops = run.stops.filter(s => s.status === 'COMPLETED').length;
            const totalStops = run.stops.length;
            const progress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
            const currentStop = run.stops.find(s => s.status === 'IN_PROGRESS');

            return (
              <AccordionItem value={run.id} key={run.id} className="bg-card border rounded-lg shadow-sm">
                <AccordionTrigger className="p-4 hover:no-underline">
                  <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center text-left gap-4 sm:gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg text-primary truncate flex items-center gap-2"><User className="h-5 w-5" />{run.driverName}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2"><Truck className="h-4 w-4" />{run.vehicleId}</p>
                    </div>
                    <div className="flex-1 w-full sm:w-auto">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{completedStops} de {totalStops}</span>
                            <span className="font-bold text-primary">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                    <div className="flex-none">
                         <Badge variant={currentStop ? "default" : "secondary"} className="truncate">
                           <MapPin className="h-3 w-3 mr-1.5"/>
                           {currentStop ? currentStop.name : (progress === 100 ? 'Finalizado' : 'Iniciando...')}
                         </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                  <div className="space-y-2 mt-4">
                    <h4 className="font-semibold mb-2">Pontos da Rota</h4>
                    {run.stops.map((stop, index) => {
                      const { icon: Icon, color, label } = getStatusInfo(stop.status);
                      const isCompleted = stop.status === 'COMPLETED';
                      return (
                        <div key={index} className={`flex items-center gap-4 p-3 rounded-md ${isCompleted ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/20'}`}>
                           <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
                           <div className="flex-1">
                             <p className="font-medium">{stop.name}</p>
                             <p className={`text-xs ${isCompleted ? 'text-muted-foreground' : color}`}>{label}</p>
                           </div>
                           {isCompleted && (
                             <div className="text-right text-sm text-muted-foreground">
                                <p>Chegada: {formatTime(stop.arrivalTime)}</p>
                                <p>Saída: {formatTime(stop.departureTime)}</p>
                             </div>
                           )}
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

export default AdminDashboardPage;
