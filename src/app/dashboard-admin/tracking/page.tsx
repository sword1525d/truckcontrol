'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlayCircle, CheckCircle, Clock, MapPin, Truck, User, Route, Timer, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format, formatDistanceStrict, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import dynamic from 'next/dynamic';

// --- Tipos ---
type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

type FirebaseTimestamp = Timestamp;

type Stop = {
  name: string;
  status: StopStatus;
  arrivalTime: FirebaseTimestamp | null;
  departureTime: FirebaseTimestamp | null;
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: FirebaseTimestamp;
};

export type Run = {
  id: string;
  driverName: string;
  vehicleId: string;
  startTime: FirebaseTimestamp;
  endTime?: FirebaseTimestamp | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  stops: Stop[];
  locationHistory?: LocationPoint[];
};

type UserData = {
  name: string;
  isAdmin: boolean;
  companyId: string;
  sectorId: string;
};

const RealTimeMap = dynamic(() => import('../RealTimeMap'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});


const TrackingPage = () => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
  const [user, setUser] = useState<UserData | null>(null);
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRunIdForMap, setSelectedRunIdForMap] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');

    if (storedUser && companyId && sectorId) {
      setUser({ ...JSON.parse(storedUser), companyId, sectorId });
    } else {
      toast({ variant: 'destructive', title: 'Sessão inválida', description: 'Faça login novamente.' });
      router.push('/login');
    }
  }, [router, toast]);
  
  useEffect(() => {
    if (!firestore || !user) return;

    setIsLoading(true);

    const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
    
    // Query for IN_PROGRESS runs
    const activeRunsQuery = query(runsCol, where('status', '==', 'IN_PROGRESS'));
    
    // Query for COMPLETED runs today
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const completedTodayQuery = query(runsCol, 
        where('status', '==', 'COMPLETED'),
        where('endTime', '>=', todayStart),
        where('endTime', '<=', todayEnd)
    );

    const handleSnapshot = (
        newInProgressRuns: Run[],
        newCompletedTodayRuns: Run[]
    ) => {
        const allRunsMap = new Map<string, Run>();

        // Add completed runs first
        newCompletedTodayRuns.forEach(run => allRunsMap.set(run.id, run));
        // Add in-progress runs, overwriting if a run was just completed
        newInProgressRuns.forEach(run => allRunsMap.set(run.id, run));

        const combinedRuns = Array.from(allRunsMap.values());
        const sortedRuns = combinedRuns.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
        
        setAllRuns(sortedRuns);
        setIsLoading(false);
    };

    let inProgressRuns: Run[] = [];
    let completedTodayRuns: Run[] = [];

    const unsubscribeInProgress = onSnapshot(activeRunsQuery, (snapshot) => {
        inProgressRuns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Run));
        handleSnapshot(inProgressRuns, completedTodayRuns);
    }, (error) => {
        console.error("Error fetching active runs: ", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar corridas ativas' });
        setIsLoading(false);
    });

    const unsubscribeCompleted = onSnapshot(completedTodayQuery, (snapshot) => {
        completedTodayRuns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Run));
        handleSnapshot(inProgressRuns, completedTodayRuns);
    }, (error) => {
        console.error("Error fetching completed runs: ", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar corridas concluídas' });
        setIsLoading(false);
    });

    return () => {
        unsubscribeInProgress();
        unsubscribeCompleted();
    };
  }, [firestore, user, toast]);

  const handleViewRoute = (runId: string) => {
      const run = allRuns.find(r => r.id === runId);
      if (!run || !run.locationHistory || run.locationHistory.length < 1) {
          toast({ variant: 'destructive', title: 'Sem dados', description: 'Não há dados de localização suficientes para exibir o trajeto.' });
          return;
      }
      setSelectedRunIdForMap(runId);
  };

  const selectedRunForMap = useMemo(() => {
    if (!selectedRunIdForMap) return null;
    return allRuns.find(run => run.id === selectedRunIdForMap) || null;
  }, [selectedRunIdForMap, allRuns]);


  if (isLoading) {
     return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fullLocationHistory = selectedRunForMap?.locationHistory?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || [];

  return (
    <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Acompanhamento Diário</h2>
        </div>
        
        {allRuns.length === 0 ? (
            <Card className="text-center p-8 mt-6 max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Nenhuma atividade hoje</CardTitle>
                    <CardDescription>Não há motoristas em rota ou corridas finalizadas hoje.</CardDescription>
                </CardHeader>
            </Card>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={allRuns.find(r => r.status === 'IN_PROGRESS')?.id || allRuns[0]?.id}>
            {allRuns.map(run => <RunAccordionItem key={run.id} run={run} onViewRoute={() => handleViewRoute(run.id)} />)}
          </Accordion>
        )}
      
      <Dialog open={selectedRunForMap !== null} onOpenChange={(isOpen) => !isOpen && setSelectedRunIdForMap(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          {isClient && selectedRunForMap && (
             <>
              <DialogHeader>
                <DialogTitle>Localização - {selectedRunForMap.driverName} ({selectedRunForMap.vehicleId})</DialogTitle>
                <DialogDescription>
                  Visualização da localização atual do veículo.
                </DialogDescription>
              </DialogHeader>
              <div className="h-[calc(80vh-100px)] bg-muted rounded-md">
                  <RealTimeMap 
                      fullLocationHistory={fullLocationHistory} 
                      vehicleId={selectedRunForMap.vehicleId}
                  />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RunAccordionItem = ({ run, onViewRoute }: { run: Run, onViewRoute: () => void }) => {
  const isCompletedRun = run.status === 'COMPLETED';
  const completedStops = run.stops.filter(s => s.status === 'COMPLETED').length;
  const totalStops = run.stops.filter(s => s.status !== 'CANCELED').length;
  const progress = isCompletedRun ? 100 : (totalStops > 0 ? (completedStops / totalStops) * 100 : 0);
  const currentStop = run.stops.find(s => s.status === 'IN_PROGRESS');

  const formatFirebaseTime = (timestamp: FirebaseTimestamp | null | undefined) => {
    if (!timestamp) return '--:--';
    return format(new Date(timestamp.seconds * 1000), 'HH:mm');
  };
  
  const getStatusInfo = (status: StopStatus) => {
    switch (status) {
      case 'COMPLETED': return { icon: CheckCircle, color: 'text-green-500', label: 'Concluído' };
      case 'IN_PROGRESS': return { icon: PlayCircle, color: 'text-blue-500', label: 'Em Andamento' };
      case 'PENDING': return { icon: Clock, color: 'text-gray-500', label: 'Pendente' };
      case 'CANCELED': return { icon: X, color: 'text-red-500', label: 'Cancelado' };
      default: return { icon: Clock, color: 'text-gray-500', label: 'Pendente' };
    }
  };

  let lastDepartureTime = run.startTime;

  return (
    <AccordionItem value={run.id} className="bg-card border rounded-lg shadow-sm">
      <AccordionTrigger className="p-4 hover:no-underline">
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center text-left gap-4 sm:gap-2">
          <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-primary truncate flex items-center gap-2"><User className="h-5 w-5" />{run.driverName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Truck className="h-4 w-4" />{run.vehicleId}</p>
          </div>
          <div className="flex-1 w-full sm:w-auto">
              <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{isCompletedRun ? 'Concluído' : `${completedStops} de ${totalStops}`}</span>
                  <span className="font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
          </div>
          <div className="flex-none">
               <Badge variant={isCompletedRun ? 'default' : (currentStop ? "default" : "secondary")} className={`truncate ${isCompletedRun ? 'bg-green-600' : ''}`}>
                 <MapPin className="h-3 w-3 mr-1.5"/>
                 {isCompletedRun ? `Finalizado às ${formatFirebaseTime(run.endTime)}` : (currentStop ? currentStop.name : 'Iniciando...')}
               </Badge>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-4 pt-0">
        <div className="space-y-4 mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">Detalhes da Rota</h4>
             <Button variant="outline" size="sm" onClick={onViewRoute}>
                <Route className="mr-2 h-4 w-4"/> Ver Localização
            </Button>
          </div>
          {run.stops.map((stop, index) => {
            const { icon: Icon, color, label } = getStatusInfo(stop.status);
            if (stop.status === 'CANCELED') return null;

            const isCompletedStop = stop.status === 'COMPLETED';
            
            const arrivalTime = stop.arrivalTime ? new Date(stop.arrivalTime.seconds * 1000) : null;
            const departureTime = stop.departureTime ? new Date(stop.departureTime.seconds * 1000) : null;
            const prevDepartureTime = new Date(lastDepartureTime.seconds * 1000);
            
            const travelTime = arrivalTime ? formatDistanceStrict(prevDepartureTime, arrivalTime, { locale: ptBR, unit: 'minute'}) : null;
            const stopTime = arrivalTime && departureTime ? formatDistanceStrict(arrivalTime, departureTime, { locale: ptBR, unit: 'minute'}) : null;

            if (departureTime) {
                lastDepartureTime = stop.departureTime!;
            }

            return (
              <div key={index} className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-md ${isCompletedStop ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/20'}`}>
                 <Icon className={`h-6 w-6 flex-shrink-0 mt-1 sm:mt-0 ${color}`} />
                 <div className="flex-1">
                   <p className="font-medium">{index + 1}. {stop.name}</p>
                   <p className={`text-xs ${isCompletedStop ? 'text-muted-foreground' : color}`}>{label}</p>
                 </div>
                 <div className="w-full sm:w-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {travelTime && <span className='flex items-center gap-1'><Route className="h-3 w-3 text-gray-400"/> Viagem: <strong>{travelTime}</strong></span>}
                    {stopTime && <span className='flex items-center gap-1'><Timer className="h-3 w-3 text-gray-400"/> Parada: <strong>{stopTime}</strong></span>}
                 </div>
                 {isCompletedStop && (
                   <div className="text-right text-sm text-muted-foreground">
                      <p>Chegada: {formatFirebaseTime(stop.arrivalTime)}</p>
                      <p>Saída: {formatFirebaseTime(stop.departureTime)}</p>
                   </div>
                 )}
              </div>
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default TrackingPage;
