
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
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
  startMileage: number;
  endMileage: number | null;
  startTime: FirebaseTimestamp;
  endTime: FirebaseTimestamp | null;
  status: 'COMPLETED';
  stops: Stop[];
  locationHistory?: LocationPoint[];
};

export type Segment = {
    label: string;
    path: [number, number][];
    color: string;
    travelTime: string;
    stopTime: string;
}

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

const HistoryPage = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [user, setUser] = useState<UserData | null>(null);
    const [allRuns, setAllRuns] = useState<Run[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    const [selectedRunForMap, setSelectedRunForMap] = useState<Run | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        if (storedUser && companyId && sectorId) {
            setUser({ ...JSON.parse(storedUser), companyId, sectorId });
        } else {
            router.push('/login');
        }
    }, [router]);

    const fetchCompletedRuns = useCallback(async (): Promise<Run[]> => {
        if (!firestore || !user) return [];

        const runsQuery = query(
            collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`),
            where('status', '==', 'COMPLETED')
        );

        try {
            const querySnapshot = await getDocs(runsQuery);
            const runs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Run));
            return runs.sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0));
        } catch (error) {
            console.error("Error fetching completed runs: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar histórico' });
            return [];
        }
    }, [firestore, user, toast]);

    useEffect(() => {
        if(user) {
            setIsLoading(true);
            fetchCompletedRuns().then(data => {
                setAllRuns(data);
                setIsLoading(false);
            });
        }
    }, [user, fetchCompletedRuns]);

    const filteredRuns = useMemo(() => {
        if (!date?.from) return allRuns;
        const toDate = date.to || date.from;
        return allRuns.filter(run => {
            if (!run.endTime?.seconds) return false;
            const runDate = new Date(run.endTime.seconds * 1000);
            return runDate >= startOfDay(date.from!) && runDate <= endOfDay(toDate);
        });
    }, [allRuns, date]);

    const kpis = useMemo(() => {
      const totalRuns = filteredRuns.length;
      const totalDistance = filteredRuns.reduce((acc, run) => {
        if (run.endMileage && run.startMileage) {
          return acc + (run.endMileage - run.startMileage);
        }
        return acc;
      }, 0);
      const totalDurationSeconds = filteredRuns.reduce((acc, run) => {
        if (run.endTime && run.startTime) {
          return acc + (run.endTime.seconds - run.startTime.seconds);
        }
        return acc;
      }, 0);
      const avgDurationMinutes = totalRuns > 0 ? (totalDurationSeconds / totalRuns / 60) : 0;
      
      return { totalRuns, totalDistance, avgDurationMinutes };
    }, [filteredRuns]);
    
    const chartData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), i)).reverse();
        
        return last7Days.map(day => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);
            const runsOnDay = allRuns.filter(run => {
                if (!run.endTime?.seconds) return false;
                const endTime = new Date(run.endTime.seconds * 1000);
                return endTime >= dayStart && endTime <= dayEnd;
            });
            return {
                name: format(day, 'dd/MM'),
                total: runsOnDay.length,
            };
        });
    }, [allRuns]);

    const handleViewRoute = (run: Run) => {
        // Dummy data for map visualization as processing is complex
        setSelectedRunForMap(run);
    };

    if (isLoading || !user) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex-1 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Histórico e Análise</h2>
                <DateFilter date={date} setDate={setDate} />
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
                <KpiCard title="Corridas Concluídas" value={kpis.totalRuns.toString()} />
                <KpiCard title="Distância Total" value={`${kpis.totalDistance.toFixed(1)} km`} />
                <KpiCard title="Duração Média" value={`${kpis.avgDurationMinutes.toFixed(0)} min`} />
            </div>
            
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Corridas nos Últimos 7 Dias</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="flex justify-center items-center h-[300px]"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))'}}/>
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Histórico Recente</CardTitle>
                        <CardDescription>Corridas concluídas no período.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {isLoading ? <div className="flex justify-center items-center h-[300px]"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                        <div className="overflow-auto max-h-[300px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Motorista</TableHead>
                                        <TableHead>Veículo</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRuns.length > 0 ? filteredRuns.map(run => <HistoryTableRow key={run.id} run={run} onViewRoute={() => handleViewRoute(run)} />) : <TableRow><TableCell colSpan={4} className="text-center h-24">Nenhuma corrida encontrada</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>}
                    </CardContent>
                </Card>
            </div>
             <Dialog open={selectedRunForMap !== null} onOpenChange={(isOpen) => !isOpen && setSelectedRunForMap(null)}>
                <DialogContent className="max-w-4xl h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Trajeto da Corrida - {selectedRunForMap?.driverName} ({selectedRunForMap?.vehicleId})</DialogTitle>
                    <DialogDescription>
                    Visualização do trajeto completo da corrida.
                    </DialogDescription>
                </DialogHeader>
                <div className="h-[calc(80vh-100px)] bg-muted rounded-md">
                    {selectedRunForMap && (
                    <RealTimeMap segments={[]} fullLocationHistory={selectedRunForMap.locationHistory?.map(p => ({latitude: p.latitude, longitude: p.longitude})) || []} />
                    )}
                </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const KpiCard = ({ title, value }: { title: string, value: string }) => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const HistoryTableRow = ({ run, onViewRoute }: { run: Run, onViewRoute: () => void }) => {
    return (
        <TableRow>
            <TableCell>
                <div className="font-medium">{run.driverName}</div>
                <div className="text-xs text-muted-foreground">{run.endTime ? format(new Date(run.endTime.seconds * 1000), 'dd/MM/yy HH:mm') : ''}</div>
            </TableCell>
            <TableCell>{run.vehicleId}</TableCell>
            <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={onViewRoute}>
                    <Route className="h-4 w-4 mr-2" />
                    Ver Trajeto
                </Button>
            </TableCell>
        </TableRow>
    );
};

const DateFilter = ({ date, setDate }: { date: DateRange | undefined, setDate: (date: DateRange | undefined) => void }) => (
    <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className="w-full sm:w-[280px] justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd/MM/y", { locale: ptBR })} -{" "}
                  {format(date.to, "dd/MM/y", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd/MM/y", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
    </Popover>
);

export default HistoryPage;

    