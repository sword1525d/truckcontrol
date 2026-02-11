
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, onSnapshot, query, where, Timestamp, getDocs, doc, deleteDoc, collectionGroup, orderBy } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, User, Wrench, PlayCircle, Route, Timer, X, Hourglass, EyeOff, Milestone, Maximize, Car, Package, Warehouse, CheckCircle, Clock, Calendar as CalendarIcon, Fuel, ClipboardCheck, Building, Download, Trash2, MapIcon, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceStrict, isToday, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import * as XLSX from 'xlsx';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';


// --- Constantes e Funções de Ajuda ---
const SEGMENT_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#6366f1', '#f59e0b', '#14b8a6', '#d946ef'];
const MAX_DISTANCE_BETWEEN_POINTS_KM = 5;

const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
            console.warn(`Outlier detectado e removido. Distância: ${distance.toFixed(2)} km`);
        }
    }
    return filtered;
};

const formatTimeDiff = (start: Date, end: Date) => {
    if (!start || !end) return 'N/A';
    return formatDistanceStrict(end, start, { locale: ptBR, unit: 'minute' });
}

const processRunSegments = (run: AggregatedRun | Run | null, isAggregated: boolean = true): Segment[] => {
    if (!run || !run.locationHistory || run.locationHistory.length === 0) return [];
    
    const sortedAndFilteredLocations = filterLocationOutliers([...run.locationHistory].sort((a, b) => a.timestamp.seconds - b.timestamp.seconds));
    const sortedStops = [...run.stops].filter(s => s.status === 'COMPLETED' || s.status === 'IN_PROGRESS').sort((a, b) => (a.arrivalTime?.seconds || Infinity) - (b.arrivalTime?.seconds || Infinity));
    const segments: Segment[] = [];
    let lastDepartureTime = run.startTime;
    const startMileage = isAggregated ? (run as AggregatedRun).startMileage : (run as Run).startMileage;
    let lastMileage = startMileage;

    for (let i = 0; i < sortedStops.length; i++) {
        const stop = sortedStops[i];
        if (!stop.arrivalTime) continue;

        const stopArrivalTime = new Date(stop.arrivalTime.seconds * 1000);
        const stopDepartureTime = stop.departureTime ? new Date(stop.departureTime.seconds * 1000) : null;
        const segmentDistance = (stop.mileageAtStop && lastMileage) ? stop.mileageAtStop - lastMileage : null;

        const segmentPath = sortedAndFilteredLocations
            .filter(loc => loc.timestamp.seconds >= lastDepartureTime.seconds && loc.timestamp.seconds <= stop.arrivalTime!.seconds)
            .map(loc => [loc.longitude, loc.latitude] as [number, number]);

        if (i > 0) {
            const prevStop = sortedStops[i - 1];
            if (prevStop.departureTime) {
                const prevDepartureTimeInSeconds = prevStop.departureTime.seconds;
                const lastPointOfPrevSegment = sortedAndFilteredLocations.slice().reverse().find(l => l.timestamp.seconds <= prevDepartureTimeInSeconds);
                if (lastPointOfPrevSegment) {
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
            distance: segmentDistance !== null ? `${segmentDistance.toFixed(1)} km` : undefined
        });

        if (stop.departureTime) lastDepartureTime = stop.departureTime;
        if (stop.mileageAtStop) lastMileage = stop.mileageAtStop;
    }

    if (run.status === 'IN_PROGRESS' && sortedAndFilteredLocations.length > 0) {
        const lastStop = sortedStops[sortedStops.length - 1];
        if (lastStop && lastStop.departureTime) {
            const finalSegmentPath = sortedAndFilteredLocations
                .filter(loc => loc.timestamp.seconds >= lastStop.departureTime!.seconds)
                .map(loc => [loc.longitude, loc.latitude] as [number, number]);
            if (finalSegmentPath.length > 0) {
                segments.push({
                    id: `segment-current`,
                    label: `Posição Atual`,
                    path: finalSegmentPath,
                    color: '#71717a',
                    travelTime: formatTimeDiff(new Date(lastStop.departureTime.seconds * 1000), new Date()),
                    stopTime: ''
                });
            }
        }
    }
    return segments;
};


// --- Tipos Globais ---
type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
type FirebaseTimestamp = Timestamp;

export type LocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: FirebaseTimestamp;
};

export type Stop = {
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

export type Run = {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  startMileage: number;
  startTime: FirebaseTimestamp;
  endTime?: FirebaseTimestamp | null;
  endMileage?: number | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  stops: Stop[];
  locationHistory?: LocationPoint[];
  sectorId?: string;
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
    totalDuration?: number;
    stops: Stop[];
    locationHistory: LocationPoint[];
    originalRuns: Run[];
    startMileage: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
};

export type FirestoreUser = {
  id: string;
  name:string;
  shift?: string;
  photoURL?: string;
  isAdmin?: boolean;
  truck?: boolean;
}

export type Segment = {
    id: string;
    label: string;
    path: [number, number][];
    color: string;
    travelTime: string;
    stopTime: string;
    distance?: string;
    opacity?: number;
}

type UserData = {
  name: string;
  isAdmin: boolean;
  companyId: string;
  sectorId: string;
  matricula: string;
};

type SectorInfo = {
    id: string;
    name: string;
}

const RealTimeMap = dynamic(() => import('./RealTimeMap'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});


// --- Componente da Aba: Acompanhamento ---
const AcompanhamentoTab = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [allRuns, setAllRuns] = useState<Run[]>([]);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRunKeyForMap, setSelectedRunKeyForMap] = useState<string | null>(null);
    const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    
    // From VisaoGeral
    type Vehicle = { id: string; model: string; isTruck: boolean; status: 'PARADO' | 'EM_CORRIDA' | 'EM_MANUTENCAO'; };
    const [vehicleStatuses, setVehicleStatuses] = useState<(Vehicle & { driverName?: string })[]>([]);
    const [isOverviewLoading, setIsOverviewLoading] = useState(true);
    const [isFleetMapOpen, setIsFleetMapOpen] = useState(false);
    const [activeTrucks, setActiveTrucks] = useState<{ id: string; latitude: number; longitude: number }[]>([]);


    useEffect(() => setIsClient(true), []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const matricula = localStorage.getItem('matricula');
        if (storedUser && companyId && sectorId && matricula) setUser({ ...JSON.parse(storedUser), companyId, sectorId, matricula });
    }, []);

    // Effect for Overview Data
    useEffect(() => {
        if (!firestore || !user) return;
        setIsOverviewLoading(true);
        
        const vehiclesCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/vehicles`);
        const vehiclesQuery = query(vehiclesCol, where('isTruck', '==', true));
        
        const unsubscribeVehicles = onSnapshot(vehiclesQuery, (vehiclesSnapshot) => {
            const allTrucks = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
            const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
            const activeRunsQuery = query(runsCol, where('status', '==', 'IN_PROGRESS'));

            const unsubscribeRuns = onSnapshot(activeRunsQuery, (runsSnapshot) => {
                const activeRunsMap = new Map(runsSnapshot.docs.map(doc => [doc.data().vehicleId, doc.data().driverName]));
                const statuses = allTrucks.map(truck => ({
                    ...truck,
                    status: activeRunsMap.has(truck.id) ? 'EM_CORRIDA' : truck.status || 'PARADO',
                    driverName: activeRunsMap.get(truck.id)
                }));
                setVehicleStatuses(statuses);
                setIsOverviewLoading(false);
            }, (error) => {
                console.error("Error fetching active runs: ", error);
                toast({ variant: 'destructive', title: 'Erro ao buscar corridas' });
                setIsOverviewLoading(false);
            });
            
            return () => unsubscribeRuns();
        }, (error) => {
            console.error("Error fetching vehicles: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar veículos' });
            setIsOverviewLoading(false);
        });

        return () => unsubscribeVehicles();
    }, [firestore, user, toast]);

    // Effect for Tracking Data
    useEffect(() => {
        if (!firestore || !user) return;
        setIsLoading(true);
        const usersCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`);
        getDocs(usersCol).then(usersSnapshot => {
            const usersMap = new Map<string, FirestoreUser>();
            usersSnapshot.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser));
            setUsers(usersMap);
        });

        const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const runsQuery = query(runsCol, where('startTime', '>=', Timestamp.fromDate(todayStart)), where('startTime', '<=', Timestamp.fromDate(todayEnd)));

        const unsubscribe = onSnapshot(runsQuery, (snapshot) => {
            const runs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Run));
            setAllRuns(runs);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching runs: ", error);
            if (error.code === 'failed-precondition') {
                toast({ variant: 'destructive', title: 'Índice necessário', description: 'O Firestore precisa de um índice para esta consulta. Crie-o no console do Firebase.' });
            } else {
                toast({ variant: 'destructive', title: 'Erro ao buscar corridas' });
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user, toast]);

    const aggregatedRuns = useMemo(() => {
        const groupedRuns = new Map<string, Run[]>();
        allRuns.forEach(run => {
            const driver = users.get(run.driverId);
            const runDate = format(run.startTime.toDate(), 'yyyy-MM-dd');
            const key = `${run.vehicleId}-${driver?.shift || 'sem-turno'}-${runDate}`;
            if (!groupedRuns.has(key)) groupedRuns.set(key, []);
            groupedRuns.get(key)!.push(run);
        });

        const aggregated: AggregatedRun[] = [];
        groupedRuns.forEach((runs, key) => {
            runs.sort((a,b) => a.startTime.seconds - b.startTime.seconds);
            const firstRun = runs[0];
            const lastRun = runs[runs.length - 1];
            const driver = users.get(firstRun.driverId);
            const allStops = runs.flatMap(r => r.stops).sort((a,b) => (a.arrivalTime?.seconds || 0) - (b.arrivalTime?.seconds || 0));
            const allLocations = runs.flatMap(r => r.locationHistory || []).sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
            const startMileage = firstRun.startMileage;
            const endMileage = lastRun.endMileage ?? allStops.filter(s => s.mileageAtStop).slice(-1)[0]?.mileageAtStop ?? null;
            const totalDistance = (endMileage && startMileage) ? endMileage - startMileage : 0;
            const status = runs.some(r => r.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'COMPLETED';

            aggregated.push({ key, driverId: firstRun.driverId, driverName: firstRun.driverName, vehicleId: firstRun.vehicleId, shift: driver?.shift || 'N/A', date: format(firstRun.startTime.toDate(), 'dd/MM/yyyy'), startTime: firstRun.startTime, endTime: lastRun.endTime, totalDistance, stops: allStops, locationHistory: allLocations, originalRuns: runs, startMileage, status });
        });
        
        return aggregated.sort((a, b) => {
            if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
            if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;
            return b.startTime.seconds - a.startTime.seconds;
        });
    }, [allRuns, users]);
    
    useEffect(() => {
        const inProgressRuns = aggregatedRuns.filter(run => run.status === 'IN_PROGRESS');
        const truckLocations = inProgressRuns.flatMap(run => {
            if (run.locationHistory && run.locationHistory.length > 0) {
                const lastLocation = run.locationHistory[run.locationHistory.length - 1];
                return [{
                    id: run.vehicleId,
                    latitude: lastLocation.latitude,
                    longitude: lastLocation.longitude
                }];
            }
            return [];
        });
        setActiveTrucks(truckLocations);
    }, [aggregatedRuns]);


    const handleViewRoute = (runKey: string) => {
        const run = aggregatedRuns.find(r => r.key === runKey);
        if (!run || !run.locationHistory || run.locationHistory.length < 1) {
            toast({ variant: 'destructive', title: 'Sem dados', description: 'Não há dados de localização para exibir o trajeto.' });
            return;
        }
        setSelectedRunKeyForMap(runKey);
    };

    const handleCloseDialog = () => {
        setSelectedRunKeyForMap(null);
        setHighlightedSegmentId(null);
    }

    const selectedRunForMap = useMemo(() => {
        if (!selectedRunKeyForMap) return null;
        return aggregatedRuns.find(run => run.key === selectedRunKeyForMap) || null;
    }, [selectedRunKeyForMap, aggregatedRuns]);

    const displayedSegments = useMemo(() => {
        if (!selectedRunForMap) return [];
        const segments = processRunSegments(selectedRunForMap, true);
        if (!highlightedSegmentId) return segments.map(s => ({ ...s, opacity: 0.9 }));
        return segments.map(s => ({ ...s, opacity: s.id === highlightedSegmentId ? 1.0 : 0.3 }));
    }, [selectedRunForMap, highlightedSegmentId]);
    
    const kpis = {
        total: vehicleStatuses.length,
        emCorrida: vehicleStatuses.filter(v => v.status === 'EM_CORRIDA').length,
        parado: vehicleStatuses.filter(v => v.status === 'PARADO').length,
        emManutencao: vehicleStatuses.filter(v => v.status === 'EM_MANUTENCAO').length,
    };

    return (
        <div className="space-y-6">
             {isOverviewLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <KpiCard title="Frota Total" value={kpis.total} icon={Truck} />
                        <KpiCard title="Em Corrida" value={kpis.emCorrida} icon={PlayCircle} />
                        <KpiCard title="Parados" value={kpis.parado} icon={Truck} />
                        <KpiCard title="Em Manutenção" value={kpis.emManutencao} icon={Wrench} />
                    </div>
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Truck className="h-6 w-6"/> Status da Frota</CardTitle>
                                    <CardDescription>Visão geral de todos os caminhões do setor.</CardDescription>
                                </div>
                                <Button variant="outline" size="icon" onClick={() => setIsFleetMapOpen(true)} disabled={activeTrucks.length === 0}>
                                    <MapIcon className="h-5 w-5" />
                                    <span className="sr-only">Ver mapa da frota</span>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {vehicleStatuses.length === 0 ? (
                                <p className="text-muted-foreground text-center">Nenhum caminhão encontrado.</p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                    {vehicleStatuses.map(v => <VehicleStatusCard key={v.id} vehicle={v} />)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

             <Separator className="my-6" />

            {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ): (
                <div className='mt-6'>
                {aggregatedRuns.length === 0 ? (
                    <Card className="text-center p-8 mt-6"><CardHeader><CardTitle>Nenhuma atividade hoje</CardTitle><CardDescription>Não há motoristas em rota ou corridas finalizadas hoje.</CardDescription></CardHeader></Card>
                ) : (
                    <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={aggregatedRuns.find(r => r.status === 'IN_PROGRESS')?.key || aggregatedRuns[0]?.key}>
                        {aggregatedRuns.map(run => <RunAccordionItem key={run.key} run={run} users={users} onViewRoute={() => handleViewRoute(run.key)} />)}
                    </Accordion>
                )}
                </div>
            )}
            <Dialog open={selectedRunForMap !== null} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
                <DialogContent className="max-w-[90vw] lg:max-w-7xl w-full h-[90vh] flex flex-col p-0">
                    {isClient && selectedRunForMap && (
                        <>
                            <DialogHeader className="p-6 pb-2 flex-row items-start justify-between">
                                <div>
                                    <DialogTitle>Acompanhamento da Rota - {selectedRunForMap.driverName} ({selectedRunForMap.vehicleId})</DialogTitle>
                                    <DialogDescription>Acompanhe em tempo real ou veja o trajeto detalhado.</DialogDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/map-view/${selectedRunForMap.key}`)}><Maximize className="h-5 w-5" /><span className="sr-only">Tela Cheia</span></Button>
                            </DialogHeader>
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 pt-0 min-h-0">
                                <div className="lg:col-span-2 bg-muted rounded-md min-h-[300px] lg:min-h-0">
                                    <RealTimeMap segments={displayedSegments} fullLocationHistory={selectedRunForMap.locationHistory?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || []} vehicleId={selectedRunForMap.vehicleId} />
                                </div>
                                <div className="lg:col-span-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold">Detalhes da Rota</h4>
                                        {highlightedSegmentId && <Button variant="ghost" size="sm" onClick={() => setHighlightedSegmentId(null)}><EyeOff className="mr-2 h-4 w-4"/> Limpar</Button>}
                                    </div>
                                    <ScrollArea className="flex-1 -mr-6 pr-6"><RunDetailsContent run={selectedRunForMap} onSegmentClick={setHighlightedSegmentId} highlightedSegmentId={highlightedSegmentId} /></ScrollArea>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={isFleetMapOpen} onOpenChange={setIsFleetMapOpen}>
                <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col p-2 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Localização da Frota Ativa</DialogTitle>
                        <DialogDescription>Posição em tempo real dos caminhões que estão em corrida.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 rounded-lg overflow-hidden">
                        <RealTimeMap fleetData={activeTrucks} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon?: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const VehicleStatusCard = ({ vehicle }: { vehicle: any }) => {
  const getStatusDetails = (status: string | undefined) => {
    switch (status) {
      case 'EM_CORRIDA': return { text: 'EM CORRIDA', badgeClass: 'bg-blue-600', cardClass: 'bg-blue-50 dark:bg-blue-900/30' };
      case 'EM_MANUTENCAO': return { text: 'MANUTENÇÃO', badgeClass: 'bg-yellow-500', cardClass: 'bg-yellow-50 dark:bg-yellow-900/30' };
      case 'PARADO': default: return { text: 'PARADO', badgeClass: 'bg-green-600', cardClass: 'bg-green-50 dark:bg-green-800/30' };
    }
  };
  const { text, badgeClass, cardClass } = getStatusDetails(vehicle.status);
  return (
    <Card className={`flex flex-col items-center justify-center p-4 text-center ${cardClass}`}>
        <p className="font-bold text-lg">{vehicle.id}</p>
        <p className="text-xs text-muted-foreground -mt-1 mb-2">{vehicle.model}</p>
        <Badge variant={'default'} className={`${badgeClass} hover:${badgeClass}`}>{text}</Badge>
        {vehicle.status === 'EM_CORRIDA' && vehicle.driverName && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><User className="h-3 w-3"/>{vehicle.driverName}</p>
        )}
    </Card>
  )
};

const RunAccordionItem = ({ run, users, onViewRoute }: { run: AggregatedRun, users: Map<string, FirestoreUser>, onViewRoute: () => void }) => {
    const isCompletedRun = run.status === 'COMPLETED';
    const completedStops = run.stops.filter(s => s.status === 'COMPLETED').length;
    const totalStops = run.stops.filter(s => s.status !== 'CANCELED').length;
    const progress = isCompletedRun ? 100 : (totalStops > 0 ? (completedStops / totalStops) * 100 : 0);
    const currentStop = run.stops.find(s => s.status === 'IN_PROGRESS');
    const driver = users.get(run.driverId);
    const formatFirebaseTime = (ts: FirebaseTimestamp | null | undefined) => ts ? format(new Date(ts.seconds * 1000), 'HH:mm') : '--:--';
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
  
    return (
        <AccordionItem value={run.key} className="bg-card border rounded-lg shadow-sm">
            <AccordionTrigger className="p-4 hover:no-underline">
                <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center text-left gap-4 sm:gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg text-primary truncate flex items-center gap-2"><Truck className="h-5 w-5" />{run.vehicleId} ({run.shift})</p>
                        <div className="text-sm text-muted-foreground flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarImage src={driver?.photoURL} alt={run.driverName} /><AvatarFallback className="text-xs">{getInitials(run.driverName)}</AvatarFallback></Avatar>{run.driverName}</div>
                    </div>
                    <div className="flex-1 w-full sm:w-auto"><div className="flex justify-between text-sm mb-1"><span className="font-medium">{isCompletedRun ? 'Concluído' : `${completedStops} de ${totalStops}`}</span><span className="font-bold text-primary">{Math.round(progress)}%</span></div><Progress value={progress} className="h-2" /></div>
                    <div className="flex-none"><Badge variant={isCompletedRun ? 'default' : (currentStop ? "default" : "secondary")} className={`truncate ${isCompletedRun ? 'bg-green-600' : ''}`}><MapPin className="h-3 w-3 mr-1.5"/>{isCompletedRun ? `Finalizado às ${formatFirebaseTime(run.endTime)}` : (currentStop ? currentStop.name : 'Iniciando...')}</Badge></div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
                <div className="space-y-4 mt-4">
                    <div className="flex justify-between items-center mb-2"><h4 className="font-semibold">Detalhes da Rota</h4><Button variant="outline" size="sm" onClick={onViewRoute}><Route className="mr-2 h-4 w-4"/> Ver Acompanhamento</Button></div>
                    <RunDetailsContent run={run} />
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const RunDetailsContent = ({ run, onSegmentClick, highlightedSegmentId }: { run: AggregatedRun, onSegmentClick?: (segmentId: string) => void, highlightedSegmentId?: string | null }) => {
    const getStatusInfo = (status: StopStatus) => ({
        'COMPLETED': { icon: CheckCircle, color: 'text-green-500', label: 'Concluído' }, 'IN_PROGRESS': { icon: PlayCircle, color: 'text-blue-500', label: 'Em Andamento' }, 'PENDING': { icon: Clock, color: 'text-gray-500', label: 'Pendente' }, 'CANCELED': { icon: X, color: 'text-red-500', label: 'Cancelado' }
    })[status] || { icon: Clock, color: 'text-gray-500', label: 'Pendente' };
    const formatFirebaseTime = (ts: FirebaseTimestamp | null) => ts ? format(new Date(ts.seconds * 1000), 'HH:mm') : '--:--';
    let segmentCounter = 0;

    return (
        <div className="space-y-2">
            {run.originalRuns.map((originalRun, runIndex) => {
                const previousRun = runIndex > 0 ? run.originalRuns[runIndex - 1] : null;
                const idleTime = previousRun?.endTime ? formatDistanceStrict(previousRun.endTime.toDate(), originalRun.startTime.toDate(), { locale: ptBR, unit: 'minute' }) : null;
                let lastDepartureTime = originalRun.startTime;
                let lastMileage = originalRun.startMileage;
                return (
                    <div key={originalRun.id}>
                        {idleTime && parseFloat(idleTime) > 0 && <div className="flex items-center gap-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 my-2"><Hourglass className="h-6 w-6 flex-shrink-0 text-amber-500" /><div className="flex-1"><p className="font-medium">Tempo Parado</p><p className="text-xs text-muted-foreground">O veículo ficou parado entre as corridas.</p></div><div className="text-right text-sm text-muted-foreground"><p><strong>{idleTime}</strong></p></div></div>}
                        {originalRun.stops.map((stop) => {
                            const { icon: Icon, color, label } = getStatusInfo(stop.status);
                            if (stop.status === 'CANCELED') return null;
                            const isCompletedStop = stop.status === 'COMPLETED';
                            const arrivalTime = stop.arrivalTime ? new Date(stop.arrivalTime.seconds * 1000) : null;
                            const departureTime = stop.departureTime ? new Date(stop.departureTime.seconds * 1000) : null;
                            const travelStartTime = lastDepartureTime;
                            const stopTime = arrivalTime && departureTime ? formatDistanceStrict(arrivalTime, departureTime, { locale: ptBR, unit: 'minute'}) : null;
                            const segmentDistance = (stop.mileageAtStop && lastMileage) ? stop.mileageAtStop - lastMileage : null;
                            if (stop.departureTime) lastDepartureTime = stop.departureTime!;
                            if (stop.mileageAtStop) lastMileage = stop.mileageAtStop;
                            const segmentId = stop.status !== 'PENDING' ? `segment-${segmentCounter++}` : ``;
                            return (
                                <div key={`${originalRun.id}-${stop.name}`} className={cn("flex items-start gap-4 p-3 rounded-md", isCompletedStop ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/20', onSegmentClick && segmentId && "cursor-pointer hover:bg-muted", highlightedSegmentId === segmentId && "ring-2 ring-primary")} onClick={() => onSegmentClick && segmentId && onSegmentClick(segmentId)}>
                                    <Icon className={`h-5 w-5 flex-shrink-0 mt-1 ${color}`} />
                                    <div className="flex-1">
                                        <p className="font-medium">{stop.name}</p><p className={`text-xs ${isCompletedStop ? 'text-muted-foreground' : color}`}>{label}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                            {stop.arrivalTime && <span className='flex items-center gap-1'><Route className="h-3 w-3 text-gray-400"/> Viagem: <strong>{formatFirebaseTime(travelStartTime)} - {formatFirebaseTime(stop.arrivalTime)}</strong></span>}
                                            {stopTime && <span className='flex items-center gap-1'><Timer className="h-3 w-3 text-gray-400"/> Parada: <strong>{stopTime}</strong></span>}
                                            {segmentDistance !== null && <span className='flex items-center gap-1'><Milestone className="h-3 w-3 text-gray-400"/> Distância: <strong>{segmentDistance.toFixed(1)} km</strong></span>}
                                            {stop.collectedOccupiedCars !== null && <span className='flex items-center gap-1'><Car className="h-3 w-3 text-gray-400"/> Ocupados: <strong>{stop.collectedOccupiedCars}</strong></span>}
                                            {stop.collectedEmptyCars !== null && <span className='flex items-center gap-1'><Package className="h-3 w-3 text-gray-400"/> Vazios: <strong>{stop.collectedEmptyCars}</strong></span>}
                                        </div>
                                        {stop.observation && <div className="border-t mt-2 pt-2"><p className="text-xs text-muted-foreground"><strong>Obs:</strong> {stop.observation}</p></div>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
};


// --- Componente da Aba: Análise ---
const AnaliseTab = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allRuns, setAllRuns] = useState<Run[]>([]);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [allSectors, setAllSectors] = useState<SectorInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<string>('Todos');
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
    const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
    const [selectedDriver, setSelectedDriver] = useState<string>('all');
    const [selectedSector, setSelectedSector] = useState<string>('all');
    
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const matricula = localStorage.getItem('matricula');
        if (storedUser && companyId && sectorId && matricula) {
            setUser({ ...JSON.parse(storedUser), companyId, sectorId, matricula });
            if (matricula === '801231') setIsSuperAdmin(true);
        } else {
            router.push('/login');
        }
    }, [router]);

    const fetchInitialData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);
        try {
            const usersMap = new Map<string, FirestoreUser>();
            const sectorRefsToFetch: {id: string, name: string}[] = [];

            if (isSuperAdmin) {
                const sectorsSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors`));
                sectorsSnapshot.docs.forEach(doc => sectorRefsToFetch.push({ id: doc.id, name: doc.data().name as string }));
            } else {
                const sectorSnap = await getDoc(doc(firestore, `companies/${user.companyId}/sectors`, user.sectorId));
                if (sectorSnap.exists()) sectorRefsToFetch.push({ id: sectorSnap.id, name: sectorSnap.data().name as string });
            }
            setAllSectors(sectorRefsToFetch);
            
            const runsPromises = sectorRefsToFetch.map(async (sector) => {
                const usersSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors/${sector.id}/users`));
                usersSnapshot.forEach(doc => { if (!usersMap.has(doc.id)) usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser); });
                const querySnapshot = await getDocs(query(collection(firestore, `companies/${user.companyId}/sectors/${sector.id}/runs`), where('status', '==', 'COMPLETED')));
                return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Run, 'id'>), sectorId: sector.id }));
            });

            const runsBySector = await Promise.all(runsPromises);
            const allFetchedRuns = runsBySector.flat();

            setUsers(usersMap);
            setAllRuns(allFetchedRuns.sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0)));
        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar dados' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, user, toast, isSuperAdmin]);

    useEffect(() => { if (user) fetchInitialData(); }, [user, fetchInitialData]);

    const { filteredRuns, vehicleList, driverList } = useMemo(() => {
        const dateFiltered = allRuns.filter(run => {
            const runDate = run.endTime ? new Date(run.endTime.seconds * 1000) : null;
            if (!runDate) return false;
            return date?.from && runDate >= startOfDay(date.from) && runDate <= endOfDay(date.to || date.from);
        });
        const vehicles = new Set<string>();
        dateFiltered.forEach(run => vehicles.add(run.vehicleId));
        const drivers = new Map<string, FirestoreUser>();
        dateFiltered.forEach(run => { if (!drivers.has(run.driverId)) { const driverInfo = users.get(run.driverId); if (driverInfo) drivers.set(run.driverId, driverInfo); } });
        const finalFiltered = dateFiltered.filter(run => {
            const driver = users.get(run.driverId);
            if (selectedShift !== 'Todos' && driver?.shift !== selectedShift) return false;
            if (isSuperAdmin && selectedSector !== 'all' && run.sectorId !== selectedSector) return false;
            if (selectedVehicle !== 'all' && run.vehicleId !== selectedVehicle) return false;
            if (selectedDriver !== 'all' && run.driverId !== selectedDriver) return false;
            return true;
        });
        return { filteredRuns: finalFiltered, vehicleList: Array.from(vehicles).sort(), driverList: Array.from(drivers.values()).sort((a, b) => a.name.localeCompare(b.name)) };
    }, [allRuns, date, selectedShift, selectedVehicle, selectedDriver, selectedSector, users, isSuperAdmin]);

    const kpis = useMemo(() => {
        const totalRuns = filteredRuns.length;
        const totalDistance = filteredRuns.reduce((acc, run) => acc + ((run.endMileage ?? run.startMileage) - run.startMileage > 0 ? (run.endMileage ?? run.startMileage) - run.startMileage : 0), 0);
        const totalDurationSeconds = filteredRuns.reduce((acc, run) => acc + (run.endTime ? run.endTime.seconds - run.startTime.seconds : 0), 0);
        const avgDurationMinutes = totalRuns > 0 ? (totalDurationSeconds / totalRuns / 60) : 0;
        const totalStops = filteredRuns.reduce((acc, run) => acc + run.stops.length, 0);
        return { totalRuns, totalDistance, avgDurationMinutes, totalStops };
    }, [filteredRuns]);
    
    const chartData = useMemo(() => {
        if (!date || !date.from) return { runsByDay: [], distanceByVehicle: [], stoppedTimeByVehicle: [] };
        const from = startOfDay(date.from);
        const to = endOfDay(date.to || date.from);
        const dateMap = new Map<string, number>();
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) dateMap.set(format(d, 'dd/MM'), 0);
        filteredRuns.forEach(run => {
            const day = format(new Date(run.startTime.seconds * 1000), 'dd/MM');
            if(dateMap.has(day)) dateMap.set(day, (dateMap.get(day) || 0) + 1);
        });
        const distanceMap = new Map<string, number>();
        filteredRuns.forEach(run => { const distance = (run.endMileage || run.startMileage) - run.startMileage; if (distance > 0) distanceMap.set(run.vehicleId, (distanceMap.get(run.vehicleId) || 0) + distance); });
        const stoppedTimeMap = new Map<string, number>();
        filteredRuns.forEach(run => {
            let runStopTimeSeconds = run.stops.reduce((acc, stop) => acc + (stop.arrivalTime && stop.departureTime && stop.departureTime.seconds - stop.arrivalTime.seconds > 0 ? stop.departureTime.seconds - stop.arrivalTime.seconds : 0), 0);
            if (runStopTimeSeconds > 0) stoppedTimeMap.set(run.vehicleId, (stoppedTimeMap.get(run.vehicleId) || 0) + runStopTimeSeconds);
        });
        const stoppedTimes = Array.from(stoppedTimeMap.entries()).map(([name, totalSeconds]) => ({ name, total: parseFloat((totalSeconds / 3600).toFixed(1)) })).sort((a,b) => b.total - a.total);
        return { runsByDay: Array.from(dateMap, ([name, total]) => ({ name, total })), distanceByVehicle: Array.from(distanceMap, ([name, total]) => ({ name, total: Math.round(total) })).sort((a,b) => b.total - a.total), stoppedTimeByVehicle: stoppedTimes };
    }, [filteredRuns, date]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                    <DateFilter date={date} setDate={setDate} />
                    {isSuperAdmin && <SectorFilter sectors={allSectors} selectedSector={selectedSector} onSectorChange={setSelectedSector} />}
                    <ShiftFilter selectedShift={selectedShift} onShiftChange={setSelectedShift} />
                    <VehicleFilter vehicles={vehicleList} selectedVehicle={selectedVehicle} onVehicleChange={setSelectedVehicle} />
                    <DriverFilter drivers={driverList} selectedDriver={selectedDriver} onDriverChange={setSelectedDriver} />
                </div>
            </div>
             <div className="py-6 space-y-4">
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     <KpiCard title="Corridas Concluídas" value={kpis.totalRuns} icon={ClipboardCheck} />
                     <KpiCard title="Paradas Totais" value={kpis.totalStops} icon={Milestone} />
                     <KpiCard title="Distância Total" value={`${kpis.totalDistance.toFixed(1)} km`} icon={Route} />
                     <KpiCard title="Duração Média" value={`${kpis.avgDurationMinutes.toFixed(0)} min`} icon={Timer} />
                 </div>
                 <div className="grid gap-6 lg:grid-cols-2">
                     <ChartCard title="Corridas por Dia" description="Total de corridas concluídas por dia."><BarChart data={chartData.runsByDay}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}/><Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
                     <ChartCard title="Km Rodados por Caminhão" description="Distância total percorrida por caminhão."><BarChart data={chartData.distanceByVehicle} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={80} /><Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}} formatter={(value) => `${value} km`}/><Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} /></BarChart></ChartCard>
                     <ChartCard title="Tempo Parado por Caminhão (Horas)" description="Soma do tempo em que o veículo ficou parado nas paradas (coletas/entregas)." className="lg:col-span-2"><BarChart data={chartData.stoppedTimeByVehicle}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} unit="h" /><Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}} formatter={(value: number) => `${value.toFixed(1)} horas`}/><Bar dataKey="total" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
                 </div>
             </div>
        </div>
    );
};

// --- Componente da Aba: Histórico ---
const HistoricoTab = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allRuns, setAllRuns] = useState<Run[]>([]);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [allSectors, setAllSectors] = useState<SectorInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<string>('Todos');
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
    const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
    const [selectedDriver, setSelectedDriver] = useState<string>('all');
    const [selectedSector, setSelectedSector] = useState<string>('all');
    const [selectedRunForDialog, setSelectedRunForDialog] = useState<AggregatedRun | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => setIsClient(true), []);
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const matricula = localStorage.getItem('matricula');
        if (storedUser && companyId && sectorId && matricula) {
            setUser({ ...JSON.parse(storedUser), companyId, sectorId, matricula });
            if (matricula === '801231') setIsSuperAdmin(true);
        } else {
            router.push('/login');
        }
    }, [router]);

    const fetchInitialData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);
        try {
            const usersMap = new Map<string, FirestoreUser>();
            const sectorRefsToFetch: {id: string, name: string}[] = [];

            if (isSuperAdmin) {
                const sectorsSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors`));
                sectorsSnapshot.docs.forEach(doc => sectorRefsToFetch.push({ id: doc.id, name: doc.data().name as string }));
            } else {
                const sectorSnap = await getDoc(doc(firestore, `companies/${user.companyId}/sectors`, user.sectorId));
                if (sectorSnap.exists()) sectorRefsToFetch.push({ id: sectorSnap.id, name: sectorSnap.data().name as string });
            }
            setAllSectors(sectorRefsToFetch);
            
            const runsPromises = sectorRefsToFetch.map(async (sector) => {
                const usersSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors/${sector.id}/users`));
                usersSnapshot.forEach(doc => { if (!usersMap.has(doc.id)) usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser); });
                const querySnapshot = await getDocs(query(collection(firestore, `companies/${user.companyId}/sectors/${sector.id}/runs`), where('status', '==', 'COMPLETED')));
                return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Run, 'id'>), sectorId: sector.id }));
            });

            const runsBySector = await Promise.all(runsPromises);
            const allFetchedRuns = runsBySector.flat();

            setUsers(usersMap);
            setAllRuns(allFetchedRuns.sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0)));
        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar dados' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, user, toast, isSuperAdmin]);

    useEffect(() => { if (user) fetchInitialData(); }, [user, fetchInitialData]);

    const { filteredRuns, vehicleList, driverList } = useMemo(() => {
        const dateFiltered = allRuns.filter(run => {
            const runDate = run.endTime ? new Date(run.endTime.seconds * 1000) : null;
            if (!runDate) return false;
            return date?.from && runDate >= startOfDay(date.from) && runDate <= endOfDay(date.to || date.from);
        });
        const vehicles = new Set<string>();
        dateFiltered.forEach(run => vehicles.add(run.vehicleId));
        const drivers = new Map<string, FirestoreUser>();
        dateFiltered.forEach(run => { if (!drivers.has(run.driverId)) { const driverInfo = users.get(run.driverId); if (driverInfo) drivers.set(run.driverId, driverInfo); } });
        const finalFiltered = dateFiltered.filter(run => {
            const driver = users.get(run.driverId);
            if (selectedShift !== 'Todos' && driver?.shift !== selectedShift) return false;
            if (isSuperAdmin && selectedSector !== 'all' && run.sectorId !== selectedSector) return false;
            if (selectedVehicle !== 'all' && run.vehicleId !== selectedVehicle) return false;
            if (selectedDriver !== 'all' && run.driverId !== selectedDriver) return false;
            return true;
        });
        return { filteredRuns: finalFiltered, vehicleList: Array.from(vehicles).sort(), driverList: Array.from(drivers.values()).sort((a, b) => a.name.localeCompare(b.name)) };
    }, [allRuns, date, selectedShift, selectedVehicle, selectedDriver, selectedSector, users, isSuperAdmin]);

    const aggregatedRunsMap = useMemo(() => {
        const groupedRuns = new Map<string, Run[]>();
        filteredRuns.forEach(run => {
            const driver = users.get(run.driverId);
            const runDate = format(run.startTime.toDate(), 'yyyy-MM-dd');
            const key = `${run.vehicleId}-${driver?.shift || 'sem-turno'}-${runDate}`;
            if (!groupedRuns.has(key)) groupedRuns.set(key, []);
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
            const totalDistance = runs.reduce((acc, run) => acc + ((run.endMileage ?? 0) - run.startMileage > 0 ? (run.endMileage ?? 0) - run.startMileage : 0), 0);
            const totalDuration = lastRun.endTime ? lastRun.endTime.seconds - firstRun.startTime.seconds : 0;
            aggregatedMap.set(key, { key, driverId: firstRun.driverId, driverName: firstRun.driverName, vehicleId: firstRun.vehicleId, shift: driver?.shift || 'N/A', date: format(firstRun.startTime.toDate(), 'dd/MM/yyyy'), startTime: firstRun.startTime, endTime: lastRun.endTime, totalDistance, totalDuration, stops: allStops, locationHistory: allLocations, originalRuns: runs, startMileage: firstRun.startMileage, status: 'COMPLETED' });
        });
        return aggregatedMap;
    }, [filteredRuns, users]);
    
    const handleViewDetails = (run: Run) => {
        const driver = users.get(run.driverId);
        const runDate = format(run.startTime.toDate(), 'yyyy-MM-dd');
        const key = `${run.vehicleId}-${driver?.shift || 'sem-turno'}-${runDate}`;
        const aggregatedRun = aggregatedRunsMap.get(key);
        if (aggregatedRun) setSelectedRunForDialog(aggregatedRun);
    };

    const handleDelete = async (runToDelete: Run) => {
        if (!firestore || !user || !isSuperAdmin) return;
        try {
            await deleteDoc(doc(firestore, `companies/${user.companyId}/sectors/${runToDelete.sectorId}/runs`, runToDelete.id));
            toast({ title: 'Sucesso', description: 'A corrida foi deletada.' });
            fetchInitialData();
        } catch (error) {
            console.error("Error deleting run:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar a corrida.' });
        }
    };
    
    const handleExport = () => {
        if (!filteredRuns.length) {
            toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
            return;
        }
        const runsByVehicle = filteredRuns.reduce((acc, run) => {
            if (!acc[run.vehicleId]) acc[run.vehicleId] = [];
            acc[run.vehicleId].push(run);
            return acc;
        }, {} as Record<string, Run[]>);
        const workbook = XLSX.utils.book_new();
        for (const vehicleId in runsByVehicle) {
            const vehicleRuns = runsByVehicle[vehicleId].sort((a, b) => a.startTime.seconds - b.startTime.seconds);
            const dataToExport = vehicleRuns.map((run, index) => {
                const driver = users.get(run.driverId);
                const sector = allSectors.find(s => s.id === run.sectorId);
                const distance = run.endMileage ? run.endMileage - run.startMileage : 0;
                const durationSeconds = run.endTime ? run.endTime.seconds - run.startTime.seconds : 0;
                const totalDuration = durationSeconds > 0 ? formatDistanceStrict(0, durationSeconds * 1000, { locale: ptBR }) : 'N/A';
                const totalStopTimeSeconds = run.stops.reduce((acc, stop) => acc + (stop.arrivalTime && stop.departureTime ? stop.departureTime.seconds - stop.arrivalTime.seconds : 0), 0);
                const stopTime = totalStopTimeSeconds > 0 ? formatDistanceStrict(0, totalStopTimeSeconds * 1000, { locale: ptBR, unit: 'minute' }) : '0 min';
                const observations = run.stops.map(s => s.observation).filter(Boolean).join('; ');
                const occupancies = run.stops.map(s => s.occupancy !== null ? `${s.occupancy}%` : 'N/A').join(', ');
                
                return { 
                    'Data': format(run.startTime.toDate(), 'dd/MM/yyyy'), 
                    'Horário Inicial': format(run.startTime.toDate(), 'HH:mm'), 
                    'Horário Final': run.endTime ? format(run.endTime.toDate(), 'HH:mm') : 'N/A', 
                    'Duração Total': totalDuration, 
                    'Tempo Parado (na corrida)': stopTime, 
                    'Setor': sector?.name || run.sectorId, 
                    'Veículo': run.vehicleId, 'Motorista': 
                    run.driverName, 'Turno': driver?.shift || 'N/A', 
                    'Paradas': run.stops.map(s => s.name).join(', '), 
                    'Ocupação (%)': occupancies,
                    'Observações': observations, 
                    'Distância (km)': distance > 0 ? distance.toFixed(1) : '0.0', 
                    'Km Inicial': run.startMileage, 
                    'Km Final': run.endMileage || 'N/A' 
                };
            });
            if (dataToExport.length > 0) {
                const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                const objectMaxLength = Object.keys(dataToExport[0]).map(key => ({ wch: Math.max(...dataToExport.map(obj => (obj[key as keyof typeof obj] ?? '').toString().length), key.length) }));
                worksheet['!cols'] = objectMaxLength;
                XLSX.utils.book_append_sheet(workbook, worksheet, vehicleId);
            }
        }
        XLSX.writeFile(workbook, `Historico_Frotacontrol_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                    <DateFilter date={date} setDate={setDate} />
                    {isSuperAdmin && <SectorFilter sectors={allSectors} selectedSector={selectedSector} onSectorChange={setSelectedSector} />}
                    <ShiftFilter selectedShift={selectedShift} onShiftChange={setSelectedShift} />
                    <VehicleFilter vehicles={vehicleList} selectedVehicle={selectedVehicle} onVehicleChange={setSelectedVehicle} />
                    <DriverFilter drivers={driverList} selectedDriver={selectedDriver} onDriverChange={setSelectedDriver} />
                </div>
            </div>
             <div className="py-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                            <div><CardTitle>Histórico de Corridas</CardTitle><CardDescription>Lista de corridas concluídas com os filtros selecionados.</CardDescription></div>
                            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Exportar para Excel</Button>
                        </div>
                    </CardHeader>
                    <CardContent><div className="overflow-auto max-h-[400px]"><Table><TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Turno</TableHead><TableHead>Destino</TableHead><TableHead>Distância</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{filteredRuns.length > 0 ? filteredRuns.map(run => <HistoryTableRow key={run.id} run={run} users={users} onViewDetails={() => handleViewDetails(run)} isSuperAdmin={isSuperAdmin} onDelete={() => handleDelete(run)} />) : <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhuma corrida encontrada</TableCell></TableRow>}</TableBody></Table></div></CardContent>
                </Card>
             </div>

            <RunDetailsDialog run={selectedRunForDialog} isOpen={selectedRunForDialog !== null} onClose={() => setSelectedRunForDialog(null)} isClient={isClient} />
        </div>
    );
};

const ChartCard = ({ title, description, children, className }: { title: string, description: string, children: React.ReactNode, className?: string }) => (
    <Card className={className}><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}>{children}</ResponsiveContainer></CardContent></Card>
);

const HistoryTableRow = ({ run, users, onViewDetails, isSuperAdmin, onDelete }: { run: Run, users: Map<string, FirestoreUser>, onViewDetails: () => void, isSuperAdmin: boolean, onDelete: () => void }) => {
    const driver = users.get(run.driverId);
    const distance = run.endMileage ? run.endMileage - run.startMileage : 0;
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
    return (<TableRow><TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{run.vehicleId}</div></TableCell><TableCell><div className="font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={driver?.photoURL} alt={run.driverName} /><AvatarFallback className="text-xs">{getInitials(run.driverName)}</AvatarFallback></Avatar>{run.driverName}</div></TableCell><TableCell>{driver?.shift || 'N/A'}</TableCell><TableCell>{run.stops.map(s => s.name).join(', ')}</TableCell><TableCell>{distance > 0 ? `${distance.toFixed(1)} km` : '0.0 km'}</TableCell><TableCell>{format(run.startTime.toDate(), 'dd/MM/yyyy')}</TableCell><TableCell className="text-right space-x-2"><Button variant="outline" size="sm" onClick={onViewDetails}><Route className="mr-2 h-4 w-4" />Ver Detalhes</Button>{isSuperAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Deletar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isto irá apagar permanentemente a corrida do motorista {run.driverName} para {run.stops.map(s => s.name).join(', ')}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onDelete}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}</TableCell></TableRow>);
};
const DateFilter = ({ date, setDate }: { date: DateRange | undefined, setDate: (date: DateRange | undefined) => void }) => (<Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className="w-full justify-start text-left font-normal sm:w-auto"><CalendarIcon className="mr-2 h-4 w-4" />{date?.from ? (date.to ? `${format(date.from, "dd/MM/y", { locale: ptBR })} - ${format(date.to, "dd/MM/y", { locale: ptBR })}` : format(date.from, "dd/MM/y", { locale: ptBR })) : <span>Selecione um período</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR} /></PopoverContent></Popover>);
const ShiftFilter = ({ selectedShift, onShiftChange }: { selectedShift: string, onShiftChange: (shift: string) => void }) => (<Select value={selectedShift} onValueChange={onShiftChange}><SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filtrar por turno" /></SelectTrigger><SelectContent>{Object.values({ TODOS: 'Todos', PRIMEIRO_NORMAL: '1° NORMAL', SEGUNDO_NORMAL: '2° NORMAL', PRIMEIRO_ESPECIAL: '1° ESPECIAL', SEGUNDO_ESPECIAL: '2° ESPECIAL' }).map(turno => (<SelectItem key={turno} value={turno}>{turno}</SelectItem>))}</SelectContent></Select>);
const SectorFilter = ({ sectors, selectedSector, onSectorChange }: { sectors: SectorInfo[], selectedSector: string, onSectorChange: (sector: string) => void }) => (<Select value={selectedSector} onValueChange={onSectorChange}><SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filtrar por setor" /></SelectTrigger><SelectContent><SelectItem value="all"><Building className="h-4 w-4 inline-block mr-2"/>Todos os Setores</SelectItem>{sectors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select>);
const VehicleFilter = ({ vehicles, selectedVehicle, onVehicleChange }: { vehicles: string[], selectedVehicle: string, onVehicleChange: (vehicle: string) => void }) => (<Select value={selectedVehicle} onValueChange={onVehicleChange}><SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filtrar por veículo" /></SelectTrigger><SelectContent><SelectItem value="all"><Truck className="h-4 w-4 inline-block mr-2"/>Todos os Veículos</SelectItem>{vehicles.map(v => (<SelectItem key={v} value={v}><Truck className="h-4 w-4 inline-block mr-2"/>{v}</SelectItem>))}</SelectContent></Select>);
const DriverFilter = ({ drivers, selectedDriver, onDriverChange }: { drivers: FirestoreUser[], selectedDriver: string, onDriverChange: (driver: string) => void }) => (<Select value={selectedDriver} onValueChange={onDriverChange}><SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filtrar por motorista" /></SelectTrigger><SelectContent><SelectItem value="all"><User className="h-4 w-4 inline-block mr-2"/>Todos os Motoristas</SelectItem>{drivers.map(d => (<SelectItem key={d.id} value={d.id}><User className="h-4 w-4 inline-block mr-2"/>{d.name}</SelectItem>))}</SelectContent></Select>);

const RunDetailsDialog = ({ run, isOpen, onClose, isClient }: { run: AggregatedRun | null, isOpen: boolean, onClose: () => void, isClient: boolean }) => {
    const [mapRun, setMapRun] = useState<AggregatedRun | Run | null>(null);
    const [isAggregatedMap, setIsAggregatedMap] = useState<boolean>(true);
    const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => { if (isOpen) { setMapRun(run); setIsAggregatedMap(true); } if (!isOpen) { setHighlightedSegmentId(null); } }, [isOpen, run]);
    const mapSegments = useMemo(() => processRunSegments(mapRun, isAggregatedMap), [mapRun, isAggregatedMap]);
    const displayedSegments = useMemo(() => { if (!highlightedSegmentId) return mapSegments.map(s => ({ ...s, opacity: 0.9 })); return mapSegments.map(s => ({ ...s, opacity: s.id === highlightedSegmentId ? 1.0 : 0.3, })); }, [mapSegments, highlightedSegmentId]);
    if (!run) return null;
    const handleViewFullscreen = () => { if (run) router.push(`/dashboard/map-view/${run.key}`); };
    const fullLocationHistory = mapRun?.locationHistory?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || [];
    const formatFirebaseTime = (timestamp: FirebaseTimestamp | null) => timestamp ? format(new Date(timestamp.seconds * 1000), 'HH:mm') : '--:--';
    const handleViewIndividualRoute = (individualRun: Run) => { setMapRun(individualRun); setIsAggregatedMap(false); setHighlightedSegmentId(null); }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] lg:max-w-7xl w-full h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2 flex-row items-start justify-between"><div><DialogTitle>Detalhes da Rota - {run.driverName} ({run.vehicleId})</DialogTitle><DialogDescription>Visualização detalhada da rota e paradas da corrida de {run.date} ({run.shift}).</DialogDescription></div><Button variant="ghost" size="icon" onClick={handleViewFullscreen}><Maximize className="h-5 w-5" /><span className="sr-only">Tela Cheia</span></Button></DialogHeader>
                <div className={cn("flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 pt-0 min-h-0")}>
                    <div className={cn("lg:col-span-2 bg-muted rounded-md min-h-[300px] lg:min-h-0")}>{isClient && <RealTimeMap segments={displayedSegments} fullLocationHistory={fullLocationHistory} vehicleId={run.vehicleId} />}</div>
                    <div className={cn("lg:col-span-1 flex flex-col min-h-0")}>
                         <div className="flex items-center justify-between mb-2"><h4 className="font-semibold">Detalhes da Rota</h4><div className="flex items-center gap-2">{highlightedSegmentId && (<Button variant="ghost" size="sm" onClick={() => setHighlightedSegmentId(null)}><EyeOff className="mr-2 h-4 w-4"/> Limpar</Button>)}<Button variant="outline" size="sm" onClick={() => { setMapRun(run); setIsAggregatedMap(true); setHighlightedSegmentId(null); }}><Route className="mr-2 h-4 w-4"/> Rota Completa</Button></div></div>
                        <ScrollArea className="flex-1 -mr-6 pr-6"><div className="space-y-4 p-1">{run.originalRuns.map((originalRun, runIndex) => {
                            const previousRun = runIndex > 0 ? run.originalRuns[runIndex - 1] : null;
                            let idleTime: string | null = null; if (previousRun && previousRun.endTime) idleTime = formatDistanceStrict(previousRun.endTime.toDate(), originalRun.startTime.toDate(), { locale: ptBR, unit: 'minute' });
                            return (
                                <div key={originalRun.id}>
                                    {idleTime && parseFloat(idleTime) > 0 && <div className="flex items-center gap-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 my-2"><Hourglass className="h-6 w-6 flex-shrink-0 text-amber-500" /><div className="flex-1"><p className="font-medium">Tempo Parado</p><p className="text-xs text-muted-foreground">O veículo ficou parado entre as corridas.</p></div><div className="text-right text-sm text-muted-foreground"><p><strong>{idleTime}</strong></p></div></div>}
                                    {originalRun.stops.filter(s => s.status === 'COMPLETED').map((stop, stopIndex) => {
                                        const globalStopIndex = run.stops.findIndex(s => s.arrivalTime?.seconds === stop.arrivalTime?.seconds); const previousStop = globalStopIndex > 0 ? run.stops[globalStopIndex - 1] : null; const segmentStartTime = previousStop?.departureTime ?? originalRun.startTime; const startMileage = previousStop?.mileageAtStop ?? run.startMileage; const segmentDistance = (stop.mileageAtStop && startMileage) ? stop.mileageAtStop - startMileage : null; const segmentId = `segment-${globalStopIndex}`;
                                        return (
                                            <Card key={`${originalRun.id}-${stopIndex}`} className={cn("bg-muted/50 mb-2 cursor-pointer transition-all hover:bg-muted", highlightedSegmentId === segmentId && "ring-2 ring-primary bg-muted")} onClick={() => { setMapRun(run); setIsAggregatedMap(true); setHighlightedSegmentId(segmentId); }}>
                                                <CardHeader className="pb-3 flex-row items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Milestone className="h-5 w-5 text-muted-foreground" />{stop.name}</CardTitle><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleViewIndividualRoute(originalRun); }}><MapIcon className="h-4 w-4" /></Button></CardHeader>
                                                <CardContent><div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs"><div className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" /><span>{formatFirebaseTime(segmentStartTime)} - {formatFirebaseTime(stop.arrivalTime)}</span></div><div className="flex items-center gap-1"><Route className="h-3 w-3 text-muted-foreground" /><span>{segmentDistance !== null && segmentDistance > 0 ? `${segmentDistance.toFixed(1)} km` : 'N/A'}</span></div><div className="flex items-center gap-1"><Car className="h-3 w-3 text-muted-foreground" /><span>Ocup: {stop.collectedOccupiedCars ?? 'N/A'}</span></div><div className="flex items-center gap-1"><Package className="h-3 w-3 text-muted-foreground" /><span>Vaz: {stop.collectedEmptyCars ?? 'N/A'}</span></div><div className="flex items-center gap-1 col-span-2"><Warehouse className="h-3 w-3 text-muted-foreground" /><span>Lotação: {stop.occupancy ?? 'N/A'}%</span></div>{stop.observation && <div className="col-span-full border-t mt-2 pt-2"><p className="text-xs text-muted-foreground"><strong>Obs:</strong> {stop.observation}</p></div>}</div></CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            );
                        })}</div></ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
};

// --- Componente da Aba: Abastecimentos ---
const AbastecimentosTab = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [allRefuels, setAllRefuels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const matricula = localStorage.getItem('matricula');
        if (storedUser && companyId && sectorId && matricula) setUser({ ...JSON.parse(storedUser), companyId, sectorId, matricula });
    }, []);
    
    const fetchUsers = useCallback(async () => {
        if (!firestore || !user) return;
        const usersSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`));
        const usersMap = new Map<string, FirestoreUser>();
        usersSnapshot.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser));
        setUsers(usersMap);
    }, [firestore, user]);

    const fetchRefuelData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);
        try {
            const refuelsQuery = query(collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/refuels`), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(refuelsQuery);
            setAllRefuels(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) { toast({ variant: 'destructive', title: 'Erro ao buscar abastecimentos' }); } finally { setIsLoading(false); }
    }, [firestore, user, toast]);

    useEffect(() => { if(user) { fetchUsers(); fetchRefuelData(); } }, [user, fetchRefuelData, fetchUsers]);

    const filteredRefuels = useMemo(() => allRefuels.filter(refuel => {
        const refuelDate = new Date(refuel.timestamp.seconds * 1000);
        return date?.from && refuelDate >= startOfDay(date.from) && refuelDate <= endOfDay(date.to || date.from);
    }), [allRefuels, date]);

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                        <CardTitle>Registros de Abastecimento</CardTitle>
                        <CardDescription>Lista de todos os abastecimentos no período selecionado.</CardDescription>
                    </div>
                    <DateFilter date={date} setDate={setDate} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto max-h-[60vh]"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Litros</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{filteredRefuels.length > 0 ? filteredRefuels.map(refuel => <RefuelTableRow key={refuel.id} refuel={refuel} driver={users.get(refuel.driverId)} />) : <TableRow><TableCell colSpan={5} className="text-center h-24">Nenhum abastecimento encontrado</TableCell></TableRow>}</TableBody></Table></div>
            </CardContent>
        </Card>
    );
};

const RefuelTableRow = ({ refuel, driver }: { refuel: any, driver?: FirestoreUser }) => {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
    return (
        <TableRow><TableCell>{format(new Date(refuel.timestamp.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell><TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{refuel.vehicleId}</div></TableCell><TableCell><div className="font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={driver?.photoURL} alt={refuel.driverName} /><AvatarFallback className="text-xs">{getInitials(refuel.driverName)}</AvatarFallback></Avatar>{refuel.driverName}</div></TableCell><TableCell><div className="flex items-center gap-2"><Fuel className="h-4 w-4 text-muted-foreground"/>{refuel.liters.toFixed(2)} L</div></TableCell><TableCell className="text-right font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(refuel.amount)}</TableCell></TableRow>
    );
};

// --- Componente da Aba: Checklists ---
const ChecklistsTab = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allChecklists, setAllChecklists] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
    const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
    const [selectedChecklist, setSelectedChecklist] = useState<any | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user'); const companyId = localStorage.getItem('companyId'); const sectorId = localStorage.getItem('sectorId'); const matricula = localStorage.getItem('matricula');
        if (storedUser && companyId && sectorId && matricula) { setUser({ ...JSON.parse(storedUser), companyId, sectorId, matricula }); if (matricula === '801231') setIsSuperAdmin(true); } else router.push('/login');
    }, [router]);
    
    const fetchUsers = useCallback(async () => {
        if (!firestore || !user) return;
        const usersSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`));
        const usersMap = new Map<string, FirestoreUser>();
        usersSnapshot.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser));
        setUsers(usersMap);
    }, [firestore, user]);

    const fetchChecklistData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);
        try {
            const checklistsQuery = query(collectionGroup(firestore, 'checklists'));
            const querySnapshot = await getDocs(checklistsQuery);
            const checklists = querySnapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
            const filtered = checklists.filter(c => c.path.startsWith(`companies/${user.companyId}/sectors/${user.sectorId}/`)).sort((a,b) => b.timestamp.seconds - a.timestamp.seconds);
            setAllChecklists(filtered);
        } catch (error) { toast({ variant: 'destructive', title: 'Erro ao buscar checklists' }); } finally { setIsLoading(false); }
    }, [firestore, user, toast]);

    useEffect(() => { if(user) { fetchUsers(); fetchChecklistData(); } }, [user, fetchChecklistData, fetchUsers]);
    
    const handleDelete = async (path: string) => {
        if (!firestore || !isSuperAdmin) return;
        try { await deleteDoc(doc(firestore, path)); toast({ title: 'Sucesso', description: 'Checklist deletado.' }); fetchChecklistData(); } catch (error) { toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar.' }); }
    };

    const { filteredChecklists, vehicleList } = useMemo(() => {
        const vehicles = new Set<string>(); allChecklists.forEach(c => vehicles.add(c.vehicleId));
        const filtered = allChecklists.filter(c => {
            const cDate = new Date(c.timestamp.seconds * 1000);
            if (!(date?.from && cDate >= startOfDay(date.from) && cDate <= endOfDay(date.to || date.from))) return false;
            if(selectedVehicle !== 'all' && c.vehicleId !== selectedVehicle) return false;
            return true;
        });
        return { filteredChecklists: filtered, vehicleList: Array.from(vehicles).sort() };
    }, [allChecklists, date, selectedVehicle]);

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                        <CardTitle>Registros de Checklist</CardTitle>
                        <CardDescription>Lista de checklists preenchidos no período.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <VehicleFilter vehicles={vehicleList} selectedVehicle={selectedVehicle} onVehicleChange={setSelectedVehicle} />
                        <DateFilter date={date} setDate={setDate} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto max-h-[60vh]"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filteredChecklists.length > 0 ? filteredChecklists.map(c => <ChecklistTableRow key={c.id} checklist={c} driver={users.get(c.driverId)} onViewDetails={() => setSelectedChecklist(c)} isSuperAdmin={isSuperAdmin} onDelete={handleDelete} />) : <TableRow><TableCell colSpan={5} className="text-center h-24">Nenhum checklist encontrado</TableCell></TableRow>}</TableBody></Table></div>
            </CardContent>
            <ChecklistDetailsDialog checklist={selectedChecklist} isOpen={selectedChecklist !== null} onClose={() => setSelectedChecklist(null)} />
        </Card>
    );
};

const ChecklistTableRow = ({ checklist, driver, onViewDetails, isSuperAdmin, onDelete }: { checklist: any, driver?: FirestoreUser, onViewDetails: () => void, isSuperAdmin: boolean, onDelete: (path: string) => void }) => {
    const nonCompliantItems = checklist.items.filter((item:any) => item.status === 'nao_conforme').length;
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
    return (
        <TableRow><TableCell>{format(new Date(checklist.timestamp.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell><TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{checklist.vehicleId}</div></TableCell><TableCell><div className="font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={driver?.photoURL} alt={checklist.driverName} /><AvatarFallback className="text-xs">{getInitials(checklist.driverName)}</AvatarFallback></Avatar>{checklist.driverName}</div></TableCell><TableCell>{nonCompliantItems > 0 ? <Badge variant="destructive">{nonCompliantItems} item(ns) não conforme</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Tudo conforme</Badge>}</TableCell><TableCell className="text-right font-medium space-x-2"><Button variant="outline" size="sm" onClick={onViewDetails}><FileText className="h-4 w-4 mr-2" />Ver Detalhes</Button>{isSuperAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Deletar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e irá apagar permanentemente o checklist.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(checklist.path)}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}</TableCell></TableRow>
    );
};

const ChecklistDetailsDialog = ({ checklist, isOpen, onClose }: { checklist: any | null, isOpen: boolean, onClose: () => void }) => {
    if (!checklist) return null;
    const getStatusBadge = (status: string) => {
        if (status === 'conforme') return <Badge className="bg-green-100 text-green-800 border-green-300">Conforme</Badge>;
        if (status === 'nao_conforme') return <Badge variant="destructive">Não Conforme</Badge>;
        return <Badge variant="secondary">N/A</Badge>;
    };
    return (
        <Dialog open={isOpen} onOpenChange={onClose}><DialogContent className="max-w-2xl h-[80vh]"><DialogHeader><DialogTitle>Detalhes do Checklist</DialogTitle><DialogDescription>Realizado por {checklist.driverName} no veículo {checklist.vehicleId} em {format(checklist.timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm")}.</DialogDescription></DialogHeader><div className="h-[calc(80vh-120px)] overflow-y-auto space-y-3 pr-2">{checklist.items.map((item:any) => (<div key={item.id} className="border rounded-md p-3"><div className="flex justify-between items-center"><p className="font-semibold">{item.id}. {item.title}</p>{getStatusBadge(item.status)}</div><p className="text-xs text-muted-foreground ml-6">{item.description}</p>{item.status === 'nao_conforme' && item.observation && <p className="text-sm text-destructive-foreground bg-destructive/80 p-2 rounded-md mt-2 ml-6"><strong>Observação:</strong> {item.observation}</p>}</div>))}</div></DialogContent></Dialog>
    )
};


// --- Componente Principal da Página ---
export default function DashboardPage() {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground">Visão geral do sistema Frotacontrol.</p>
       </div>
       
       <Tabs defaultValue="acompanhamento" className="w-full">
        <TabsList className={cn("grid w-full", isMobile ? "grid-cols-2" : "grid-cols-5")}>
            <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
            
            {!isMobile && <TabsTrigger value="analise">Análise</TabsTrigger>}
            {!isMobile && <TabsTrigger value="historico">Histórico</TabsTrigger>}
            {!isMobile && <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>}
            
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamento" className="mt-6">
            <AcompanhamentoTab />
        </TabsContent>
        
        
        {!isMobile && <TabsContent value="analise" className="mt-6">
            <AnaliseTab />
        </TabsContent>}
        {!isMobile && <TabsContent value="historico" className="mt-6">
            <HistoricoTab />
        </TabsContent>}
        {!isMobile && <TabsContent value="abastecimentos" className="mt-6">
            <AbastecimentosTab />
        </TabsContent>}
        

        <TabsContent value="checklists" className="mt-6">
            <ChecklistsTab />
        </TabsContent>
       </Tabs>
    </div>
  );
}
