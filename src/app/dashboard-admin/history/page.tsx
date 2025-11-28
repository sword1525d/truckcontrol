
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, deleteDoc } from 'firebase/firestore';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Route, Truck, User, Clock, Car, Package, Warehouse, Milestone, Hourglass, MapIcon, EyeOff, Maximize, Minimize, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay, endOfDay, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import dynamic from 'next/dynamic';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


// --- Constantes ---
const TURNOS = {
    TODOS: 'Todos',
    PRIMEIRO_NORMAL: '1° NORMAL',
    SEGUNDO_NORMAL: '2° NORMAL',
    PRIMEIRO_ESPECIAL: '1° ESPECIAL',
    SEGUNDO_ESPECIAL: '2° ESPECIAL'
};

const SEGMENT_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899',
    '#6366f1', '#f59e0b', '#14b8a6', '#d946ef'
];

const MAX_DISTANCE_BETWEEN_POINTS_KM = 5; // Max distance in km to be considered a valid point


// --- Tipos ---
type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

type FirebaseTimestamp = Timestamp;

type Stop = {
  name: string;
  status: StopStatus;
  arrivalTime: FirebaseTimestamp | null;
  departureTime: FirebaseTimestamp | null;
  collectedOccupiedCars: number | null;
  collectedEmptyCars: number | null;
  mileageAtStop: number | null;
  occupancy: number | null;
  observation?: string;
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: FirebaseTimestamp;
};

export type Run = {
  id: string;
  driverId: string;
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

export type AggregatedRun = {
    key: string;
    driverId: string;
    driverName: string;
    vehicleId: string;
    shift: string;
    date: string;
    startTime: FirebaseTimestamp;
    endTime: FirebaseTimestamp | null;
    totalDistance: number;
    totalDuration: number; // in seconds
    stops: Stop[];
    locationHistory: LocationPoint[];
    originalRuns: Run[];
    startMileage: number;
};

export type FirestoreUser = {
  id: string;
  name:string;
  shift?: string;
  photoURL?: string;
}

export type Segment = {
    id: string;
    label: string;
    path: [number, number][];
    color: string;
    travelTime: string;
    stopTime: string;
    distance?: string;
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

const formatTimeDiff = (start: Date, end: Date) => {
    if (!start || !end) return 'N/A';
    return formatDistanceStrict(end, start, { locale: ptBR, unit: 'minute' });
}

// Haversine distance function
const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};


const filterLocationOutliers = (locations: LocationPoint[]): LocationPoint[] => {
    if (locations.length < 2) return locations;
    const filtered: LocationPoint[] = [locations[0]];
    for (let i = 1; i < locations.length; i++) {
        const prev = filtered[filtered.length - 1];
        const curr = locations[i];
        const distance = getHaversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        if (distance <= MAX_DISTANCE_BETWEEN_POINTS_KM) {
            filtered.push(curr);
        } else {
            console.warn(`Outlier detected and removed. Distance: ${distance.toFixed(2)} km`);
        }
    }
    return filtered;
}

const processRunSegments = (run: AggregatedRun | Run | null, isAggregated: boolean): Segment[] => {
    if (!run || !run.locationHistory || run.locationHistory.length === 0) return [];

    const sortedAndFilteredLocations = filterLocationOutliers(
        [...run.locationHistory].sort((a,b) => a.timestamp.seconds - b.timestamp.seconds)
    );
    const sortedStops = [...run.stops].filter(s => s.status === 'COMPLETED').sort((a, b) => (a.arrivalTime?.seconds || 0) - (b.arrivalTime?.seconds || 0));

    const segments: Segment[] = [];
    let lastDepartureTime = run.startTime;
    const startMileage = isAggregated ? (run as AggregatedRun).startMileage : (run as Run).startMileage;
    let lastMileage = startMileage;

    for(let i = 0; i < sortedStops.length; i++) {
        const stop = sortedStops[i];
        if (!stop.arrivalTime) continue;

        const stopArrivalTime = new Date(stop.arrivalTime.seconds * 1000);
        const stopDepartureTime = stop.departureTime ? new Date(stop.departureTime.seconds * 1000) : null;

        const segmentDistance = (stop.mileageAtStop && lastMileage) ? stop.mileageAtStop - lastMileage : null;

        const segmentPath = sortedAndFilteredLocations
            .filter(loc => {
                const locTime = loc.timestamp.seconds;
                return locTime >= lastDepartureTime.seconds && locTime <= stop.arrivalTime!.seconds;
            })
            .map(loc => [loc.longitude, loc.latitude] as [number, number]);

        // Add the start point of the segment
        if (i > 0) {
            const prevStop = sortedStops[i-1];
            if (prevStop.departureTime) {
                 const prevDepartureTimeInSeconds = prevStop.departureTime.seconds;
                 const lastPointOfPrevSegment = sortedAndFilteredLocations.slice().reverse().find(l => l.timestamp.seconds <= prevDepartureTimeInSeconds);
                 if(lastPointOfPrevSegment) {
                     segmentPath.unshift([lastPointOfPrevSegment.longitude, lastPointOfPrevSegment.latitude]);
                 }
            }
        } else {
             const firstPoint = sortedAndFilteredLocations.find(l => l.timestamp.seconds >= run.startTime.seconds);
             if (firstPoint) {
                segmentPath.unshift([firstPoint.longitude, firstPoint.latitude]);
             }
        }

        segments.push({
            id: `segment-${i}`,
            label: `Trajeto para ${stop.name}`,
            path: segmentPath,
            color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            travelTime: formatTimeDiff(new Date(lastDepartureTime.seconds * 1000), stopArrivalTime),
            stopTime: stopDepartureTime ? formatTimeDiff(stopArrivalTime, stopDepartureTime) : 'Em andamento',
            distance: segmentDistance !== null ? `${segmentDistance.toFixed(1)} km` : 'N/A'
        });

        if (stop.departureTime) {
            lastDepartureTime = stop.departureTime;
        }
        if (stop.mileageAtStop) {
            lastMileage = stop.mileageAtStop;
        }
    }

    return segments;
}

const HistoryPage = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [user, setUser] = useState<UserData | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allRuns, setAllRuns] = useState<Run[]>([]);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<string>(TURNOS.TODOS);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    });
    const [selectedRunForDialog, setSelectedRunForDialog] = useState<AggregatedRun | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const matricula = localStorage.getItem('matricula');

        if (storedUser && companyId && sectorId) {
            setUser({ ...JSON.parse(storedUser), companyId, sectorId });
            if (matricula === '801231') {
                setIsSuperAdmin(true);
            }
        } else {
            router.push('/login');
        }
    }, [router]);

    const fetchInitialData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);

        try {
            // Fetch Users
            const usersCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`);
            const usersSnapshot = await getDocs(usersCol);
            const usersMap = new Map<string, FirestoreUser>();
            usersSnapshot.forEach(doc => {
                usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser);
            });
            setUsers(usersMap);

            // Fetch Completed Runs
            const runsQuery = query(
                collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`),
                where('status', '==', 'COMPLETED')
            );
            const querySnapshot = await getDocs(runsQuery);
            const runs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Run));
            setAllRuns(runs.sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0)));

        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar dados' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, user, toast]);

    useEffect(() => {
        if(user) {
            fetchInitialData();
        }
    }, [user, fetchInitialData]);

    const filteredRuns = useMemo(() => {
        return allRuns.filter(run => {
            const runDate = run.endTime ? new Date(run.endTime.seconds * 1000) : null;
            if (!runDate) return false;

            const isWithinDateRange = date?.from && runDate >= startOfDay(date.from) && runDate <= endOfDay(date.to || date.from);
            if (!isWithinDateRange) return false;

            const driver = users.get(run.driverId);
            if (selectedShift !== TURNOS.TODOS && driver?.shift !== selectedShift) return false;

            return true;
        });
    }, [allRuns, date, selectedShift, users]);

    const aggregatedRunsMap = useMemo(() => {
        const groupedRuns = new Map<string, Run[]>();
        filteredRuns.forEach(run => {
            const driver = users.get(run.driverId);
            const runDate = format(run.startTime.toDate(), 'yyyy-MM-dd');
            const key = `${run.vehicleId}-${driver?.shift || 'sem-turno'}-${runDate}`;

            if (!groupedRuns.has(key)) {
                groupedRuns.set(key, []);
            }
            groupedRuns.get(key)!.push(run);
        });

        const aggregatedMap = new Map<string, AggregatedRun>();
        groupedRuns.forEach((runs, key) => {
            runs.sort((a,b) => a.startTime.seconds - b.startTime.seconds);
            const firstRun = runs[0];
            const lastRun = runs[runs.length - 1];
            const driver = users.get(firstRun.driverId);
            const allStops = runs.flatMap(r => r.stops).filter(s => s.status === 'COMPLETED').sort((a,b) => (a.arrivalTime?.seconds || 0) - (b.arrivalTime?.seconds || 0));
            const allLocations = runs.flatMap(r => r.locationHistory || []).sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
            const startMileage = firstRun.startMileage;
            const endMileage = lastRun.endMileage;
            const totalDistance = (endMileage && startMileage) ? endMileage - startMileage : 0;
            const totalDuration = lastRun.endTime ? lastRun.endTime.seconds - firstRun.startTime.seconds : 0;

            aggregatedMap.set(key, {
                key,
                driverId: firstRun.driverId,
                driverName: firstRun.driverName,
                vehicleId: firstRun.vehicleId,
                shift: driver?.shift || 'N/A',
                date: format(firstRun.startTime.toDate(), 'dd/MM/yyyy'),
                startTime: firstRun.startTime,
                endTime: lastRun.endTime,
                totalDistance,
                totalDuration,
                stops: allStops,
                locationHistory: allLocations,
                originalRuns: runs,
                startMileage
            });
        });

        return aggregatedMap;
    }, [filteredRuns, users]);

    const kpis = useMemo(() => {
      const totalRuns = filteredRuns.length;
      const totalDistance = filteredRuns.reduce((acc, run) => acc + ((run.endMileage || run.startMileage) - run.startMileage), 0);
      const totalDurationSeconds = filteredRuns.reduce((acc, run) => acc + (run.endTime ? run.endTime.seconds - run.startTime.seconds : 0), 0);
      const avgDurationMinutes = totalRuns > 0 ? (totalDurationSeconds / totalRuns / 60) : 0;
      const totalStops = filteredRuns.reduce((acc, run) => acc + run.stops.length, 0);

      return { totalRuns, totalDistance, avgDurationMinutes, totalStops };
    }, [filteredRuns]);

    const runsByDayChartData = useMemo(() => {
        if (!date || !date.from) return [];
        const from = startOfDay(date.from);
        const to = endOfDay(date.to || date.from);

        const dateMap = new Map<string, number>();
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            dateMap.set(format(d, 'dd/MM'), 0);
        }

        filteredRuns.forEach(run => {
            const day = format(new Date(run.startTime.seconds * 1000), 'dd/MM');
            if(dateMap.has(day)){
                dateMap.set(day, (dateMap.get(day) || 0) + 1);
            }
        });

        return Array.from(dateMap, ([name, total]) => ({ name, total }));
    }, [filteredRuns, date]);

    const distanceByVehicleChartData = useMemo(() => {
        const distanceMap = new Map<string, number>();
        filteredRuns.forEach(run => {
            const distance = (run.endMileage || run.startMileage) - run.startMileage;
            distanceMap.set(run.vehicleId, (distanceMap.get(run.vehicleId) || 0) + distance);
        });

        return Array.from(distanceMap, ([vehicleId, distance]) => ({ name: vehicleId, total: Math.round(distance) }));
    }, [filteredRuns]);

    const handleViewDetails = (run: Run) => {
        const driver = users.get(run.driverId);
        const runDate = format(run.startTime.toDate(), 'yyyy-MM-dd');
        const key = `${run.vehicleId}-${driver?.shift || 'sem-turno'}-${runDate}`;
        const aggregatedRun = aggregatedRunsMap.get(key);
        if (aggregatedRun) {
            setSelectedRunForDialog(aggregatedRun);
        }
    };

    const handleDelete = async (runToDelete: Run) => {
        if (!firestore || !user || !isSuperAdmin) return;
        try {
            const runRef = doc(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`, runToDelete.id);
            await deleteDoc(runRef);

            toast({ title: 'Sucesso', description: 'A corrida foi deletada.' });
            fetchInitialData(); // Refresh list
        } catch (error) {
            console.error("Error deleting run:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar a corrida.' });
        }
    };

    if (isLoading || !user) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Histórico e Análise</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <ShiftFilter selectedShift={selectedShift} onShiftChange={setSelectedShift} />
                    <DateFilter date={date} setDate={setDate} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Corridas Concluídas" value={kpis.totalRuns.toString()} />
                <KpiCard title="Paradas Totais" value={kpis.totalStops.toString()} />
                <KpiCard title="Distância Total" value={`${kpis.totalDistance.toFixed(1)} km`} />
                <KpiCard title="Duração Média" value={`${kpis.avgDurationMinutes.toFixed(0)} min`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Corridas por Dia</CardTitle>
                        <CardDescription>Total de corridas concluídas por dia no período e turno selecionados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="flex justify-center items-center h-[300px]"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={runsByDayChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}/>
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Km Rodados por Caminhão</CardTitle>
                        <CardDescription>Distância total percorrida por cada caminhão no período e turno.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="flex justify-center items-center h-[300px]"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={distanceByVehicleChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={80} />
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}} formatter={(value) => `${value} km`}/>
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Corridas</CardTitle>
                    <CardDescription>Lista de corridas concluídas no período e turno selecionados.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? <div className="flex justify-center items-center h-[300px]"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                    <div className="overflow-auto max-h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Motorista</TableHead>
                                    <TableHead>Veículo</TableHead>
                                    <TableHead>Turno</TableHead>
                                    <TableHead>Destino</TableHead>
                                    <TableHead>Distância</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRuns.length > 0 ? filteredRuns.map(run => <HistoryTableRow key={run.id} run={run} users={users} onViewDetails={() => handleViewDetails(run)} isSuperAdmin={isSuperAdmin} onDelete={() => handleDelete(run)} />) : <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhuma corrida encontrada</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>}
                </CardContent>
            </Card>

             <RunDetailsDialog run={selectedRunForDialog} isOpen={selectedRunForDialog !== null} onClose={() => setSelectedRunForDialog(null)} isClient={isClient} />
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

const HistoryTableRow = ({ run, users, onViewDetails, isSuperAdmin, onDelete }: { run: Run, users: Map<string, FirestoreUser>, onViewDetails: () => void, isSuperAdmin: boolean, onDelete: () => void }) => {
    const driver = users.get(run.driverId);
    const distance = run.endMileage ? run.endMileage - run.startMileage : 0;
    
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('');
    }

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium flex items-center gap-2">
                   <Avatar className="h-6 w-6">
                        <AvatarImage src={driver?.photoURL} alt={run.driverName} />
                        <AvatarFallback className="text-xs">{getInitials(run.driverName)}</AvatarFallback>
                    </Avatar>
                    {run.driverName}
                </div>
            </TableCell>
            <TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{run.vehicleId}</div></TableCell>
            <TableCell>{driver?.shift || 'N/A'}</TableCell>
            <TableCell>{run.stops.map(s => s.name).join(', ')}</TableCell>
            <TableCell>{distance.toFixed(1)} km</TableCell>
            <TableCell>{format(run.startTime.toDate(), 'dd/MM/yyyy')}</TableCell>
            <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={onViewDetails}>
                    <Route className="h-4 w-4 mr-2" />
                    Ver Detalhes
                </Button>
                {isSuperAdmin && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm">
                               <Trash2 className="h-4 w-4 mr-1" /> Deletar
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                           <AlertDialogHeader>
                               <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                               <AlertDialogDescription>
                                   Esta ação não pode ser desfeita. Isto irá apagar permanentemente a corrida do motorista {run.driverName} para {run.stops.map(s => s.name).join(', ')}.
                               </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                               <AlertDialogCancel>Cancelar</AlertDialogCancel>
                               <AlertDialogAction onClick={onDelete}>Confirmar</AlertDialogAction>
                           </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
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

const ShiftFilter = ({ selectedShift, onShiftChange }: { selectedShift: string, onShiftChange: (shift: string) => void }) => (
    <Select value={selectedShift} onValueChange={onShiftChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por turno" />
        </SelectTrigger>
        <SelectContent>
            {Object.values(TURNOS).map(turno => (
                <SelectItem key={turno} value={turno}>{turno}</SelectItem>
            ))}
        </SelectContent>
    </Select>
);


const RunDetailsDialog = ({ run, isOpen, onClose, isClient }: { run: AggregatedRun | null, isOpen: boolean, onClose: () => void, isClient: boolean }) => {
    const [mapRun, setMapRun] = useState<AggregatedRun | Run | null>(null);
    const [isAggregatedMap, setIsAggregatedMap] = useState<boolean>(true);
    const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (run) {
            setMapRun(run);
            setIsAggregatedMap(true);
        } else {
            setMapRun(null);
        }
        // Reset state on new run or when closing
        setHighlightedSegmentId(null);
        setIsMapFullscreen(false);
    }, [run]);

    // Added separate effect to handle closing, ensuring state resets properly
    useEffect(() => {
        if (!isOpen) {
             if(run) { // Keep the run context for the next open
                setMapRun(run);
                setIsAggregatedMap(true);
            }
            setHighlightedSegmentId(null);
            setIsMapFullscreen(false);
        }
    }, [isOpen, run]);

    const mapSegments = useMemo(() => processRunSegments(mapRun, isAggregatedMap), [mapRun, isAggregatedMap]);
    
    const displayedSegments = useMemo(() => {
        if (!highlightedSegmentId) return mapSegments.map(s => ({ ...s, opacity: 0.9 }));

        return mapSegments.map(s => ({
            ...s,
            opacity: s.id === highlightedSegmentId ? 1.0 : 0.3,
        }));
    }, [mapSegments, highlightedSegmentId]);
    
    if (!run) return null;
    
    const handleViewFullscreen = () => {
      if (run) {
        // We'll pass the key of the aggregated run to the map view page
        router.push(`/dashboard-admin/map-view/${run.key}`);
      }
    };
    
    const fullLocationHistory = mapRun?.locationHistory?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || [];

    const formatFirebaseTime = (timestamp: FirebaseTimestamp | null) => {
        if (!timestamp) return '--:--';
        return format(new Date(timestamp.seconds * 1000), 'HH:mm');
    };

    const handleViewIndividualRoute = (individualRun: Run) => {
        setMapRun(individualRun);
        setIsAggregatedMap(false);
        setHighlightedSegmentId(null);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] lg:max-w-7xl w-full h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2 flex-row items-start justify-between">
                    <div>
                        <DialogTitle>Detalhes da Rota - {run.driverName} ({run.vehicleId})</DialogTitle>
                        <DialogDescription>
                            Visualização detalhada da rota e paradas da corrida de {run.date} ({run.shift}).
                        </DialogDescription>
                    </div>
                     <Button variant="ghost" size="icon" onClick={handleViewFullscreen}>
                        <Maximize className="h-5 w-5" />
                        <span className="sr-only">Tela Cheia</span>
                    </Button>
                </DialogHeader>

                <div className={cn("flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 pt-0 min-h-0")}>
                    <div className={cn("lg:col-span-2 bg-muted rounded-md min-h-[300px] lg:min-h-0")}>
                        {isClient && (
                            <RealTimeMap
                                segments={displayedSegments}
                                fullLocationHistory={fullLocationHistory}
                                vehicleId={run.vehicleId}
                            />
                        )}
                    </div>

                    <div className={cn("lg:col-span-1 flex flex-col min-h-0")}>
                         <div className="flex items-center justify-between mb-2">
                             <h4 className="font-semibold">Detalhes da Rota</h4>
                             <div className="flex items-center gap-2">
                                {highlightedSegmentId && (
                                    <Button variant="ghost" size="sm" onClick={() => setHighlightedSegmentId(null)}>
                                        <EyeOff className="mr-2 h-4 w-4"/> Limpar
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => { setMapRun(run); setIsAggregatedMap(true); setHighlightedSegmentId(null); }}>
                                    <Route className="mr-2 h-4 w-4"/> Rota Completa
                                </Button>
                             </div>
                         </div>
                        <ScrollArea className="flex-1 -mr-6 pr-6">
                            <div className="space-y-4 p-1">
                                {run.originalRuns.map((originalRun, runIndex) => {
                                    const previousRun = runIndex > 0 ? run.originalRuns[runIndex - 1] : null;
                                    let idleTime: string | null = null;

                                    if (previousRun && previousRun.endTime) {
                                       idleTime = formatDistanceStrict(
                                           previousRun.endTime.toDate(),
                                           originalRun.startTime.toDate(),
                                           { locale: ptBR, unit: 'minute' }
                                       );
                                    }

                                    return (
                                        <div key={originalRun.id}>
                                            {idleTime && parseFloat(idleTime) > 0 && (
                                                <div className="flex items-center gap-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 my-2">
                                                    <Hourglass className="h-6 w-6 flex-shrink-0 text-amber-500" />
                                                    <div className="flex-1">
                                                        <p className="font-medium">Tempo Parado</p>
                                                        <p className="text-xs text-muted-foreground">O veículo ficou parado entre as corridas.</p>
                                                    </div>
                                                    <div className="text-right text-sm text-muted-foreground">
                                                        <p><strong>{idleTime}</strong></p>
                                                    </div>
                                                </div>
                                            )}
                                            {originalRun.stops.filter(s => s.status === 'COMPLETED').map((stop, stopIndex) => {
                                                const globalStopIndex = run.stops.findIndex(s => s.arrivalTime?.seconds === stop.arrivalTime?.seconds);
                                                const previousStop = globalStopIndex > 0 ? run.stops[globalStopIndex - 1] : null;
                                                const segmentStartTime = previousStop?.departureTime ?? originalRun.startTime;

                                                const startMileage = previousStop?.mileageAtStop ?? run.startMileage;
                                                const segmentDistance = (stop.mileageAtStop && startMileage) ? stop.mileageAtStop - startMileage : null;

                                                const segmentId = `segment-${globalStopIndex}`;

                                                return (
                                                    <Card
                                                        key={`${originalRun.id}-${stopIndex}`}
                                                        className={cn(
                                                            "bg-muted/50 mb-2 cursor-pointer transition-all hover:bg-muted",
                                                            highlightedSegmentId === segmentId && "ring-2 ring-primary bg-muted"
                                                         )}
                                                        onClick={() => {
                                                            setMapRun(run);
                                                            setIsAggregatedMap(true);
                                                            setHighlightedSegmentId(segmentId);
                                                        }}
                                                    >
                                                        <CardHeader className="pb-3 flex-row items-center justify-between">
                                                            <CardTitle className="text-base flex items-center gap-2">
                                                                <Milestone className="h-5 w-5 text-muted-foreground" />
                                                                {stop.name}
                                                            </CardTitle>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleViewIndividualRoute(originalRun); }}>
                                                              <MapIcon className="h-4 w-4" />
                                                            </Button>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                                    <span>{formatFirebaseTime(segmentStartTime)} - {formatFirebaseTime(stop.arrivalTime)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Route className="h-3 w-3 text-muted-foreground" />
                                                                    <span>{segmentDistance !== null ? `${segmentDistance.toFixed(1)} km` : 'N/A'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Car className="h-3 w-3 text-muted-foreground" />
                                                                    <span>Ocup: {stop.collectedOccupiedCars ?? 'N/A'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Package className="h-3 w-3 text-muted-foreground" />
                                                                    <span>Vaz: {stop.collectedEmptyCars ?? 'N/A'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 col-span-2">
                                                                    <Warehouse className="h-3 w-3 text-muted-foreground" />
                                                                    <span>Lotação: {stop.occupancy ?? 'N/A'}%</span>
                                                                </div>
                                                                {stop.observation && (
                                                                    <div className="col-span-full border-t mt-2 pt-2">
                                                                        <p className="text-xs text-muted-foreground"><strong>Obs:</strong> {stop.observation}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default HistoryPage;
