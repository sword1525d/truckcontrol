
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, onSnapshot, query, where, Timestamp, getDocs, getDoc, doc, setDoc, deleteDoc, collectionGroup, orderBy, writeBatch } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, User, Wrench, PlayCircle, Route, Timer, X, Hourglass, MapIcon, Milestone, Maximize, Car, Package, Warehouse, CheckCircle, Clock, Calendar as CalendarIcon, Fuel, ClipboardCheck, Building, Download, Trash2, FileText, EyeOff, MapPin, Plus, ArrowLeft, ArrowRight, Edit, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceStrict, isToday, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths, addDays } from 'date-fns';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


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
  sectorId?: string;
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
    totalDuration?: number;
    stops: Stop[];
    locationHistory: LocationPoint[];
    originalRuns: Run[];
    startMileage: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
};

// --- Tipos para Roteirização ---
type PlannedStop = {
  name: string;
  plannedArrival: string;
  plannedDeparture: string;
};

type PlannedTrip = {
  id: string;
  name: string;
  stops: PlannedStop[];
};

type PlannedRoute = {
  id: string;
  vehicleId: string;
  trips: PlannedTrip[];
  date: string; // ISO YYYY-MM-DD
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
const AcompanhamentoTab = ({ activeTab }: { activeTab: string }) => {
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

    // Effect for Overview and Tracking Data
    useEffect(() => {
        if (!firestore || !user || activeTab !== 'acompanhamento') return;

        setIsLoading(true);
        setIsOverviewLoading(true);

        const companyId = user.companyId;
        const sectorId = user.sectorId;

        // Fetch Users
        const usersCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/users`);
        getDocs(usersCol).then(usersSnapshot => {
            const usersMap = new Map<string, FirestoreUser>();
            usersSnapshot.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser));
            setUsers(usersMap);
        });

        // Combined listener for Vehicles and Runs
        const vehiclesCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/vehicles`);
        const vehiclesQuery = query(vehiclesCol, where('isTruck', '==', true));
        
        const unsubscribeVehicles = onSnapshot(vehiclesQuery, (vehiclesSnapshot) => {
            const allTrucks = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
            
            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());
            const runsCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/runs`);
            const runsQuery = query(runsCol, where('startTime', '>=', todayStart), where('startTime', '<=', todayEnd));

            const unsubscribeRuns = onSnapshot(runsQuery, (runsSnapshot) => {
                const activeRunsMap = new Map<string, string>();
                const runs = runsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Run));
                
                runs.forEach(run => {
                    if (run.status === 'IN_PROGRESS') {
                        activeRunsMap.set(run.vehicleId, run.driverName);
                    }
                });

                const statuses = allTrucks.map(truck => ({
                    ...truck,
                    status: activeRunsMap.has(truck.id) ? 'EM_CORRIDA' : truck.status || 'PARADO',
                    driverName: activeRunsMap.get(truck.id)
                }));

                setVehicleStatuses(statuses);
                setAllRuns(runs);
                setIsLoading(false);
                setIsOverviewLoading(false);

            }, (error) => {
                console.error("Error fetching runs: ", error);
                toast({ variant: 'destructive', title: 'Erro ao buscar corridas' });
                setIsLoading(false);
                setIsOverviewLoading(false);
            });
            
            return () => unsubscribeRuns();
        }, (error) => {
            console.error("Error fetching vehicles: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar veículos' });
            setIsLoading(false);
            setIsOverviewLoading(false);
        });

        return () => unsubscribeVehicles();
    }, [firestore, user, toast, activeTab]);


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
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i}><Skeleton className="h-32 w-full" /></Card>
                        ))}
                    </div>
                    <Card><Skeleton className="h-96 w-full" /></Card>
                </div>
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
const AnaliseTab = ({ activeTab }: { activeTab: string }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [user, setUser] = useState<UserData | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
    
    // Data states
    const [allSectors, setAllSectors] = useState<SectorInfo[]>([]);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [allRuns, setAllRuns] = useState<Run[]>([]);

    // Filter states
    const [selectedShift, setSelectedShift] = useState<string>('Todos');
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
        }
    }, []);

    useEffect(() => {
        const fetchAnalysisData = async () => {
            if (!firestore || !user || !date?.from || activeTab !== 'analise') return;
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
                    
                    const runsQuery = query(
                        collection(firestore, `companies/${user.companyId}/sectors/${sector.id}/runs`), 
                        where('startTime', '>=', startOfDay(date.from!)),
                        where('startTime', '<=', endOfDay(date.to || date.from!))
                    );

                    const querySnapshot = await getDocs(runsQuery);
                    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Run, 'id'>), sectorId: sector.id }));
                });

                const runsBySector = await Promise.all(runsPromises);
                const allFetchedRuns = runsBySector.flat().filter(run => run.status === 'COMPLETED');

                setUsers(usersMap);
                setAllRuns(allFetchedRuns);
            } catch (error) {
                console.error("Error fetching data: ", error);
                 if ((error as any).code === 'failed-precondition') {
                    toast({ variant: 'destructive', title: 'Índice necessário no Firestore', description: 'Para otimizar esta consulta, um índice composto é necessário. Por favor, crie-o no console do Firebase.', duration: 8000 });
                } else {
                    toast({ variant: 'destructive', title: 'Erro ao buscar dados' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalysisData();
    }, [firestore, user, toast, isSuperAdmin, date, activeTab]);

    const { filteredRuns, vehicleList, driverList } = useMemo(() => {
        const vehicles = new Set<string>();
        allRuns.forEach(run => vehicles.add(run.vehicleId));

        const drivers = new Map<string, FirestoreUser>();
        allRuns.forEach(run => { if (!drivers.has(run.driverId)) { const driverInfo = users.get(run.driverId); if (driverInfo) drivers.set(run.driverId, driverInfo); } });
        
        const finalFiltered = allRuns.filter(run => {
            const driver = users.get(run.driverId);
            if (selectedShift !== 'Todos' && driver?.shift !== selectedShift) return false;
            if (isSuperAdmin && selectedSector !== 'all' && run.sectorId !== selectedSector) return false;
            if (selectedVehicle !== 'all' && run.vehicleId !== selectedVehicle) return false;
            if (selectedDriver !== 'all' && run.driverId !== selectedDriver) return false;
            return true;
        });
        return { filteredRuns: finalFiltered, vehicleList: Array.from(vehicles).sort(), driverList: Array.from(drivers.values()).sort((a, b) => a.name.localeCompare(b.name)) };
    }, [allRuns, selectedShift, selectedVehicle, selectedDriver, selectedSector, users, isSuperAdmin]);

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
const HistoricoTab = ({ activeTab }: { activeTab: string }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
    const [selectedRunForDialog, setSelectedRunForDialog] = useState<AggregatedRun | null>(null);
    const [isClient, setIsClient] = useState(false);
    
    // Data states
    const [allSectors, setAllSectors] = useState<SectorInfo[]>([]);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [allRuns, setAllRuns] = useState<Run[]>([]);
    const [page, setPage] = useState(1);
    const pageSize = 30;

    // Filter states
    const [selectedShift, setSelectedShift] = useState<string>('Todos');
    const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
    const [selectedDriver, setSelectedDriver] = useState<string>('all');
    const [selectedSector, setSelectedSector] = useState<string>('all');


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

    useEffect(() => {
        const fetchHistoryData = async () => {
            if (!firestore || !user || !date?.from || activeTab !== 'historico') return;
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
                    
                    const runsQuery = query(
                        collection(firestore, `companies/${user.companyId}/sectors/${sector.id}/runs`), 
                        where('startTime', '>=', startOfDay(date.from!)),
                        where('startTime', '<=', endOfDay(date.to || date.from!))
                    );

                    const querySnapshot = await getDocs(runsQuery);
                    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Run, 'id'>), sectorId: sector.id }));
                });

                const runsBySector = await Promise.all(runsPromises);
                const allFetchedRuns = runsBySector.flat().filter(run => run.status === 'COMPLETED');

                setUsers(usersMap);
                setAllRuns(allFetchedRuns.sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0)));
            } catch (error) {
                console.error("Error fetching data: ", error);
                if ((error as any).code === 'failed-precondition') {
                    toast({ variant: 'destructive', title: 'Índice necessário no Firestore', description: 'Para otimizar esta consulta, um índice composto é necessário. Por favor, crie-o no console do Firebase.', duration: 8000 });
                } else {
                    toast({ variant: 'destructive', title: 'Erro ao buscar dados' });
                }
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchHistoryData();
    }, [firestore, user, toast, isSuperAdmin, date, activeTab]);

    const { filteredRuns, vehicleList, driverList, hasMore, totalFiltered } = useMemo(() => {
        const vehicles = new Set<string>();
        allRuns.forEach(run => vehicles.add(run.vehicleId));
        const drivers = new Map<string, FirestoreUser>();
        allRuns.forEach(run => { if (!drivers.has(run.driverId)) { const driverInfo = users.get(run.driverId); if (driverInfo) drivers.set(run.driverId, driverInfo); } });
        
        const finalFiltered = allRuns.filter(run => {
            const driver = users.get(run.driverId);
            if (selectedShift !== 'Todos' && driver?.shift !== selectedShift) return false;
            if (isSuperAdmin && selectedSector !== 'all' && run.sectorId !== selectedSector) return false;
            if (selectedVehicle !== 'all' && run.vehicleId !== selectedVehicle) return false;
            if (selectedDriver !== 'all' && run.driverId !== selectedDriver) return false;
            return true;
        });

        const paginatedRuns = finalFiltered.slice(0, page * pageSize);
        const hasMore = finalFiltered.length > page * pageSize;

        return { 
            filteredRuns: paginatedRuns, 
            totalFiltered: finalFiltered.length,
            hasMore,
            vehicleList: Array.from(vehicles).sort(), 
            driverList: Array.from(drivers.values()).sort((a, b) => a.name.localeCompare(b.name)) 
        };
    }, [allRuns, selectedShift, selectedVehicle, selectedDriver, selectedSector, users, isSuperAdmin, page]);

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
            // Re-filter client-side to update UI instantly
            setAllRuns(prev => prev.filter(r => r.id !== runToDelete.id));
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
            const dataToExport = vehicleRuns.map((run) => {
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
                    'Veículo': run.vehicleId,
                    'Motorista': run.driverName,
                    'Turno': driver?.shift || 'N/A', 
                    'Paradas': run.stops.map(s => s.name).join(', '), 
                    'Ocupação (%)': occupancies,
                    'Observações': observations, 
                    'Distância (km)': distance > 0 ? distance.toFixed(1) : '0.0', 
                    'Km Inicial': run.startMileage, 
                    'Km Final': run.endMileage || 'N/A',
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
        return (
            <div className="space-y-6">
                <div className="flex justify-center flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-32" />)}
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                    <CardContent className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </CardContent>
                </Card>
            </div>
        );
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
                    <CardContent>
                        <div className="overflow-auto max-h-[600px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Veículo</TableHead>
                                        <TableHead>Motorista</TableHead>
                                        <TableHead>Turno</TableHead>
                                        <TableHead>Destino</TableHead>
                                        <TableHead>Distância</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRuns.length > 0 ? filteredRuns.map(run => (
                                        <HistoryTableRow 
                                            key={run.id} 
                                            run={run} 
                                            users={users} 
                                            onViewDetails={() => handleViewDetails(run)} 
                                            isSuperAdmin={isSuperAdmin} 
                                            onDelete={() => handleDelete(run)} 
                                        />
                                    )) : (
                                        <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhuma corrida encontrada</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {hasMore && (
                            <div className="flex justify-center mt-6">
                                <Button variant="outline" onClick={() => setPage(p => p + 1)} className="w-full max-w-xs">
                                    Carregar mais corridas ({filteredRuns.length} de {totalFiltered})
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
             </div>

            <RunDetailsDialog run={selectedRunForDialog} isOpen={selectedRunForDialog !== null} onClose={() => setSelectedRunForDialog(null)} isClient={isClient} />
        </div>
    );
};

// --- Componente da Aba: Roteirização ---
const RoteirizacaoTab = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [vehicles, setVehicles] = useState<{id: string, model: string}[]>([]);
    const [routes, setRoutes] = useState<PlannedRoute[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [newRouteVehicle, setNewRouteVehicle] = useState('');
    const [newTrips, setNewTrips] = useState<PlannedTrip[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
    const [selectedAdditionalDates, setSelectedAdditionalDates] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'daily' | 'calendar'>('daily');
    const [vehicleFilter, setVehicleFilter] = useState<string>('all');

    const fetchVehicles = useCallback(async () => {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      if (!firestore || !companyId || !sectorId) return;

      try {
        const vehiclesCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/vehicles`);
        const snapshot = await getDocs(vehiclesCol);
        const list = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
          .filter(v => v.isTruck)
          .map(v => ({ id: v.id, model: v.model }));
        setVehicles(list);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar veículos.' });
      }
    }, [firestore, toast]);

    const fetchRoutes = useCallback(async () => {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      if (!firestore || !companyId || !sectorId) return;

      setIsLoading(true);
      try {
        const routesCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/routes`);
        const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
        
        const q = query(routesCol, where('date', '>=', start), where('date', '<=', end));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlannedRoute));
        setRoutes(list);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar rotas.' });
      } finally {
        setIsLoading(false);
      }
    }, [firestore, selectedDate, toast]);

    useEffect(() => {
      fetchVehicles();
      fetchRoutes();
    }, [fetchVehicles, fetchRoutes]);

    const handleAddTrip = () => {
      const newTrip: PlannedTrip = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Viagem ${newTrips.length + 1}`,
        stops: [{ name: '', plannedArrival: '', plannedDeparture: '' }]
      };
      setNewTrips([...newTrips, newTrip]);
    };

    const handleAddStop = (tripId: string) => {
      setNewTrips(newTrips.map(trip => {
        if (trip.id === tripId) {
          return { ...trip, stops: [...trip.stops, { name: '', plannedArrival: '', plannedDeparture: '' }] };
        }
        return trip;
      }));
    };

    const handleUpdateStop = (tripId: string, stopIndex: number, field: keyof PlannedStop, value: string) => {
      setNewTrips(newTrips.map(trip => {
        if (trip.id === tripId) {
          const newStops = [...trip.stops];
          newStops[stopIndex] = { ...newStops[stopIndex], [field]: value };
          return { ...trip, stops: newStops };
        }
        return trip;
      }));
    };

    const handleRemoveStop = (tripId: string, stopIndex: number) => {
      setNewTrips(newTrips.map(trip => {
        if (trip.id === tripId) {
          return { ...trip, stops: trip.stops.filter((_, i) => i !== stopIndex) };
        }
        return trip;
      }));
    };

    const handleRemoveTrip = (tripId: string) => {
      setNewTrips(newTrips.filter(t => t.id !== tripId));
    };

    const handleSaveRoute = async () => {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      if (!firestore || !companyId || !sectorId || !newRouteVehicle) return;

      if (newTrips.length === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Adicione pelo menos uma viagem.' });
        return;
      }

      setIsSaving(true);
      try {
        const datesToSave = [format(selectedDate, 'yyyy-MM-dd'), ...selectedAdditionalDates];
        // Save in batches of 5 dates to avoid 'Transaction too big' error
        for (let i = 0; i < datesToSave.length; i += 5) {
          const batch = writeBatch(firestore);
          const chunk = datesToSave.slice(i, i + 5);
          
          for (const dateStr of chunk) {
            const routeId = isEditing && dateStr === format(selectedDate, 'yyyy-MM-dd') 
              ? editingRouteId! 
              : `${dateStr}_${newRouteVehicle}_${Math.random().toString(36).substr(2, 5)}`;
            
            const routeRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/routes`, routeId);
            batch.set(routeRef, {
              vehicleId: newRouteVehicle,
              date: dateStr,
              trips: newTrips
            });
          }
          await batch.commit();
        }

        toast({ title: 'Sucesso', description: isEditing ? 'Rota atualizada!' : 'Rota(s) salva(s) com sucesso!' });
        resetForm();
        fetchRoutes();
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao salvar rota.' });
      } finally {
        setIsSaving(false);
      }
    };

    const resetForm = () => {
      setNewRouteVehicle('');
      setNewTrips([]);
      setIsEditing(false);
      setEditingRouteId(null);
      setSelectedAdditionalDates([]);
    };

    const handleEditRoute = (route: PlannedRoute) => {
      setNewRouteVehicle(route.vehicleId);
      setNewTrips(route.trips);
      setSelectedDate(new Date(route.date + 'T12:00:00'));
      setIsEditing(true);
      setEditingRouteId(route.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteRoute = async (routeId: string) => {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      if (!firestore || !companyId || !sectorId) return;

      try {
        await deleteDoc(doc(firestore, `companies/${companyId}/sectors/${sectorId}/routes`, routeId));
        toast({ title: 'Sucesso', description: 'Rota excluída.' });
        fetchRoutes();
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir rota.' });
      }
    };

    const routesForSelectedDate = routes.filter(r => r.date === format(selectedDate, 'yyyy-MM-dd'));

    const CalendarView = () => {
      const days = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate)
      });

      const startDay = getDay(days[0]);
      const padding = Array(startDay).fill(null);

      return (
        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">{format(selectedDate, 'MMMM yyyy', { locale: ptBR })}</h3>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(subMonths(selectedDate, 1))}><ArrowLeft className="w-4 h-4"/></Button>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}><ArrowRight className="w-4 h-4"/></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
              <span key={d} className="text-[10px] font-black uppercase text-muted-foreground">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {padding.map((_, i) => <div key={`p-${i}`} className="h-12" />)}
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayRoutes = routes.filter(r => r.date === dateStr);
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;
              const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
              
              return (
                <button 
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={`h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-md' : 
                    isToday ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-sm font-bold">{format(day, 'd')}</span>
                  <div className="flex gap-0.5">
                    {dayRoutes.slice(0, 3).map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    if (isLoading && routes.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2"><Skeleton className="h-[500px] w-full" /></Card>
                    <Skeleton className="h-[500px] w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Roteirização</h2>
                    <p className="text-muted-foreground text-sm">Defina as rotas e paradas dos motoristas.</p>
                </div>
                <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    <Input 
                        type="date" 
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                        className="border-none focus-visible:ring-0 w-36 h-8 text-sm p-0"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />} 
                                    {isEditing ? 'Editar Programação' : 'Nova Programação'}
                                </CardTitle>
                                <CardDescription>
                                    {isEditing ? `Alterando rota do dia ${format(selectedDate, 'dd/MM')}` : `Defina paradas para ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`}
                                </CardDescription>
                            </div>
                            {isEditing && (
                              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar Edição</Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Veículo</Label>
                                    <Select value={newRouteVehicle} onValueChange={setNewRouteVehicle}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                                        <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.id} - {v.model}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <Label>Repetir para Datas (Opcional)</Label>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="xs" className="h-6 text-[10px]" onClick={() => {
                                                const next5 = Array.from({length: 5}, (_, i) => format(addDays(selectedDate, i + 1), 'yyyy-MM-dd'));
                                                setSelectedAdditionalDates([...new Set([...selectedAdditionalDates, ...next5])]);
                                            }}>+5 dias</Button>
                                            <Button variant="outline" size="xs" className="h-6 text-[10px]" onClick={() => setSelectedAdditionalDates([])}>Limpar</Button>
                                        </div>
                                    </div>
                                    <Input 
                                      type="date" 
                                      onChange={(e) => {
                                        if (e.target.value && !selectedAdditionalDates.includes(e.target.value)) {
                                          setSelectedAdditionalDates([...selectedAdditionalDates, e.target.value]);
                                        }
                                      }}
                                    />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {selectedAdditionalDates.map(d => (
                                        <Badge key={d} variant="secondary" className="gap-1">
                                          {format(new Date(d + 'T12:00:00'), 'dd/MM')}
                                          <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedAdditionalDates(selectedAdditionalDates.filter(x => x !== d))} />
                                        </Badge>
                                      ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-base font-semibold">Viagens e Paradas</span>
                                    <Button variant="outline" size="sm" onClick={handleAddTrip}><Plus className="w-4 h-4 mr-1" /> Add Viagem</Button>
                                </div>

                                {newTrips.map((trip, tIndex) => (
                                    <div key={trip.id} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                                        <div className="flex justify-between items-center">
                                            <Input value={trip.name} onChange={(e) => { const next = [...newTrips]; next[tIndex].name = e.target.value; setNewTrips(next); }} className="max-w-[200px] font-bold h-8" />
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveTrip(trip.id)}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                        <div className="space-y-3">
                                            {trip.stops.map((stop, sIndex) => (
                                                <div key={sIndex} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b pb-3 last:border-0">
                                                    <div className="md:col-span-2 space-y-1"><span className="text-[10px] uppercase font-bold text-muted-foreground block">Ponto de Parada</span><Input placeholder="Ex: PINTURA ABS" value={stop.name} onChange={(e) => handleUpdateStop(trip.id, sIndex, 'name', e.target.value)} className="h-8" /></div>
                                                    <div className="space-y-1"><span className="text-[10px] uppercase font-bold text-muted-foreground block">Ch. Prevista</span><Input type="time" value={stop.plannedArrival} onChange={(e) => handleUpdateStop(trip.id, sIndex, 'plannedArrival', e.target.value)} className="h-8" /></div>
                                                    <div className="flex gap-1">
                                                        <div className="flex-1 space-y-1"><span className="text-[10px] uppercase font-bold text-muted-foreground block">Sa. Prevista</span><Input type="time" value={stop.plannedDeparture} onChange={(e) => handleUpdateStop(trip.id, sIndex, 'plannedDeparture', e.target.value)} className="h-8" /></div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveStop(trip.id, sIndex)}><Trash2 className="w-4 h-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button variant="ghost" size="sm" className="w-full border-dashed border-2 h-8" onClick={() => handleAddStop(trip.id)}><Plus className="w-3 h-3 mr-1" /> Add Parada</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button className="w-full h-10" onClick={handleSaveRoute} disabled={isSaving || !newRouteVehicle}>
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : isEditing ? <Check className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                {isEditing ? 'Atualizar Rota' : selectedAdditionalDates.length > 0 ? `Salvar para ${selectedAdditionalDates.length + 1} dias` : 'Salvar Programação'}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Truck className="w-5 h-5" /> Programadas ({routesForSelectedDate.length})</h3>
                            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Filtrar veículo" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {routesForSelectedDate.filter(r => vehicleFilter === 'all' || r.vehicleId === vehicleFilter).length === 0 ? (
                            <div className="text-muted-foreground text-center py-12 border rounded-lg border-dashed flex flex-col items-center gap-2"><CalendarIcon className="h-8 w-8 opacity-20" /><p className="text-sm">Nenhuma rota para hoje.</p></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {routesForSelectedDate
                                .filter(r => vehicleFilter === 'all' || r.vehicleId === vehicleFilter)
                                .map(route => (
                                <Card key={route.id} className="overflow-hidden border-primary/20">
                                    <div className="bg-primary/5 p-3 flex justify-between items-center border-b">
                                        <span className="font-bold text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> {route.vehicleId}</span>
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditRoute(route)}><Edit className="w-4 h-4" /></Button>
                                          <AlertDialog>
                                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                              <AlertDialogContent>
                                                  <AlertDialogHeader><AlertDialogTitle>Excluir Rota?</AlertDialogTitle><AlertDialogDescription>Deseja realmente excluir a programação do veículo {route.vehicleId}?</AlertDialogDescription></AlertDialogHeader>
                                                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRoute(route.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                                              </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                    </div>
                                    <CardContent className="p-3 space-y-4">
                                        {route.trips.map((trip, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <p className="text-[10px] font-black uppercase text-primary/70">{trip.name}</p>
                                                <div className="space-y-1 border-l-2 border-primary/20 ml-1 pl-2">
                                                    {trip.stops.map((stop, sIdx) => (
                                                        <div key={sIdx} className="text-xs flex justify-between items-center bg-muted/30 p-1 rounded px-2">
                                                            <span className="font-medium">{stop.name}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">{stop.plannedArrival} - {stop.plannedDeparture}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                              ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <CalendarView />
                    <Card>
                      <CardHeader><CardTitle className="text-sm font-bold">Resumo do Mês</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {vehicles.map(v => {
                          const vehicleRoutes = routes.filter(r => r.vehicleId === v.id);
                          return (
                            <div key={v.id} className="flex justify-between items-center text-sm">
                              <span>{v.id}</span>
                              <Badge variant="outline">{vehicleRoutes.length} dias programados</Badge>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// --- Componente da Aba: Abastecimentos ---
const AbastecimentosTab = ({ activeTab }: { activeTab: string }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
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
    
    useEffect(() => {
        const fetchRefuelData = async () => {
            if (!firestore || !user || activeTab !== 'abastecimentos') return;
            setIsLoading(true);
            try {
                const usersSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`));
                const usersMap = new Map<string, FirestoreUser>();
                usersSnapshot.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser));
                setUsers(usersMap);
                
                const refuelsQuery = query(collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/refuels`), orderBy('timestamp', 'desc'));
                const querySnapshot = await getDocs(refuelsQuery);
                setAllRefuels(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) { toast({ variant: 'destructive', title: 'Erro ao buscar abastecimentos' }); } finally { setIsLoading(false); }
        };

        fetchRefuelData();
    }, [firestore, user, toast, activeTab]);

    const filteredRefuels = useMemo(() => allRefuels.filter(refuel => {
        const refuelDate = new Date(refuel.timestamp.seconds * 1000);
        return date?.from && refuelDate >= startOfDay(date.from) && refuelDate <= endOfDay(date.to || date.from);
    }), [allRefuels, date]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div>
                        <Skeleton className="h-10 w-48" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </CardContent>
            </Card>
        );
    }

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

// --- Componente da Aba: Checklists ---
const ChecklistsTab = ({ activeTab }: { activeTab: string }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [user, setUser] = useState<UserData | null>(null);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allChecklists, setAllChecklists] = useState<any[]>([]);
    const [isChecklistsLoading, setIsChecklistsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
    const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
    const [selectedChecklist, setSelectedChecklist] = useState<any | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user'); const companyId = localStorage.getItem('companyId'); const sectorId = localStorage.getItem('sectorId'); const matricula = localStorage.getItem('matricula');
        if (storedUser && companyId && sectorId && matricula) { setUser({ ...JSON.parse(storedUser), companyId, sectorId, matricula }); if (matricula === '801231') setIsSuperAdmin(true); } 
    }, []);
    
    useEffect(() => {
        const fetchChecklistData = async () => {
            if (!firestore || !user || activeTab !== 'checklists') return;

            setIsChecklistsLoading(true);
            try {
                const usersSnapshot = await getDocs(collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`));
                const usersMap = new Map<string, FirestoreUser>();
                usersSnapshot.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser));
                setUsers(usersMap);
                
                const checklistsQuery = query(collectionGroup(firestore, 'checklists'));
                const querySnapshot = await getDocs(checklistsQuery);
                const checklists = querySnapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() as any }));

                const companyPath = `companies/${user.companyId}/sectors/${user.sectorId}/`;
                const filteredAndSorted = checklists
                    .filter(c => c.path.startsWith(companyPath))
                    .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

                setAllChecklists(filteredAndSorted);
            } catch (error) { 
                console.error("Error fetching checklists:", error);
                toast({ variant: 'destructive', title: 'Erro ao buscar checklists' });
            } finally {
                setIsChecklistsLoading(false);
            }
        };
        
        fetchChecklistData();
    }, [firestore, user, toast, activeTab]);
    
    const handleDelete = async (path: string) => {
        if (!firestore || !isSuperAdmin) return;
        try { await deleteDoc(doc(firestore, path)); toast({ title: 'Sucesso', description: 'Checklist deletado.' }); 
            setAllChecklists(prev => prev.filter(c => c.path !== path));
        } catch (error) { toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar.' }); }
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

    if (isChecklistsLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div>
                        <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-48" /></div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </CardContent>
            </Card>
        );
    }

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

const RefuelTableRow = ({ refuel, driver }: { refuel: any, driver?: FirestoreUser }) => {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
    return (
        <TableRow><TableCell>{format(new Date(refuel.timestamp.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell><TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{refuel.vehicleId}</div></TableCell><TableCell><div className="font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={driver?.photoURL} alt={refuel.driverName} /><AvatarFallback className="text-xs">{getInitials(refuel.driverName)}</AvatarFallback></Avatar>{refuel.driverName}</div></TableCell><TableCell><div className="flex items-center gap-2"><Fuel className="h-4 w-4 text-muted-foreground"/>{refuel.liters.toFixed(2)} L</div></TableCell><TableCell className="text-right font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(refuel.amount)}</TableCell></TableRow>
    );
};

const ChecklistTableRow = ({ checklist, driver, onViewDetails, isSuperAdmin, onDelete }: { checklist: any, driver?: FirestoreUser, onViewDetails: () => void, isSuperAdmin: boolean, onDelete: (path: string) => void }) => {
    const nonCompliantItems = checklist.items.filter((item:any) => item.status === 'nao_conforme').length;
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
    return (
        <TableRow><TableCell>{format(new Date(checklist.timestamp.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell><TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{checklist.vehicleId}</div></TableCell><TableCell><div className="font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={driver?.photoURL} alt={checklist.driverName} /><AvatarFallback className="text-xs">{getInitials(checklist.driverName)}</AvatarFallback></Avatar>{checklist.driverName}</div></TableCell><TableCell>{nonCompliantItems > 0 ? <Badge variant="destructive">{nonCompliantItems} item(ns) não conforme</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Tudo conforme</Badge>}</TableCell><TableCell className="text-right font-medium space-x-2"><Button variant="outline" size="sm" onClick={onViewDetails}><FileText className="h-4 w-4 mr-2" />Ver Detalhes</Button>{isSuperAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Deletar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e irá apagar permanentemente o checklist.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(checklist.path)}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}</TableCell></TableRow>
    );
};

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
  const [activeTab, setActiveTab] = useState('acompanhamento');

  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground">Visão geral do sistema Frotacontrol.</p>
       </div>
       
       <Tabs defaultValue="acompanhamento" className="w-full" onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full", isMobile ? "grid-cols-2" : "grid-cols-6")}>
            <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
            <TabsTrigger value="roteirizacao">Roteirização</TabsTrigger>
            <TabsTrigger value="analise">Análise</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamento" className="mt-6">
            <AcompanhamentoTab activeTab={activeTab} />
        </TabsContent>
        <TabsContent value="roteirizacao" className="mt-6">
            <RoteirizacaoTab />
        </TabsContent>
        <TabsContent value="analise" className="mt-6">
            <AnaliseTab activeTab={activeTab} />
        </TabsContent>
        <TabsContent value="historico" className="mt-6">
            <HistoricoTab activeTab={activeTab} />
        </TabsContent>
        <TabsContent value="abastecimentos" className="mt-6">
            <AbastecimentosTab activeTab={activeTab} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-6">
            <ChecklistsTab activeTab={activeTab} />
        </TabsContent>
       </Tabs>
    </div>
  );
}




