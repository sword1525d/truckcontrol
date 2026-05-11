'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, getAccessToken } from '@/lib/api-client';
import { useSignalR } from '@/hooks/use-signalr';
import type { VehicleDto, RunSummaryDto, RunDto, UserDto, RouteDto } from '@/types/api';
import type { AggregatedRun, PlannedRoute, Stop, LocationPoint, Segment, SectorInfo } from './types';
import { SHIFT_NUM_TO_NAME, SEGMENT_COLORS } from './types';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Truck, User, Wrench, PlayCircle, Route, Timer, X, Hourglass, MapIcon, Milestone, Maximize, Car, Package, Warehouse, CheckCircle, Clock, EyeOff, MapPin, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format, formatDistanceStrict, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// ---- Helpers ----
const MAX_DISTANCE_BETWEEN_POINTS_KM = 5;

const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const filterLocationOutliers = (locations: LocationPoint[]) => {
    if (locations.length < 2) return locations;
    const filtered = [locations[0]];
    for (let i = 1; i < locations.length; i++) {
        const prev = filtered[filtered.length - 1];
        const curr = locations[i];
        if (getHaversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude) <= MAX_DISTANCE_BETWEEN_POINTS_KM) {
            filtered.push(curr);
        }
    }
    return filtered;
};

const formatTimeDiff = (start: Date, end: Date) => {
    if (!start || !end) return 'N/A';
    return formatDistanceStrict(end, start, { locale: ptBR, unit: 'minute' });
};

const processRunSegments = (run: AggregatedRun | null, isAggregated: boolean = true): Segment[] => {
    if (!run || !run.locationHistory || run.locationHistory.length === 0) return [];
    const sortedAndFilteredLocations = filterLocationOutliers([...run.locationHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    const sortedStops = [...run.stops].filter(s => s.status === 'COMPLETED' || s.status === 'IN_PROGRESS').sort((a, b) => (a.arrivalTime ? new Date(a.arrivalTime).getTime() : Infinity) - (b.arrivalTime ? new Date(b.arrivalTime).getTime() : Infinity));
    const segments: Segment[] = [];
    let lastDepartureTime = run.startTime;
    let lastMileage = run.startMileage;

    for (let i = 0; i < sortedStops.length; i++) {
        const stop = sortedStops[i];
        if (!stop.arrivalTime) continue;
        const stopArrivalTime = new Date(stop.arrivalTime);
        const stopDepartureTime = stop.departureTime ? new Date(stop.departureTime) : null;
        const segmentDistance = (stop.mileageAtStop && lastMileage) ? stop.mileageAtStop - lastMileage : null;
        const segmentPath = sortedAndFilteredLocations
            .filter(loc => new Date(loc.timestamp).getTime() >= new Date(lastDepartureTime).getTime() && new Date(loc.timestamp).getTime() <= stopArrivalTime.getTime())
            .map(loc => [loc.longitude, loc.latitude] as [number, number]);
        if (i > 0) {
            const prevStop = sortedStops[i - 1];
            if (prevStop.departureTime) {
                const prevDtMs = new Date(prevStop.departureTime).getTime();
                const lastPoint = sortedAndFilteredLocations.slice().reverse().find(l => new Date(l.timestamp).getTime() <= prevDtMs);
                if (lastPoint) segmentPath.unshift([lastPoint.longitude, lastPoint.latitude]);
            }
        } else {
            const firstPoint = sortedAndFilteredLocations.find(l => new Date(l.timestamp).getTime() >= new Date(run.startTime).getTime());
            if (firstPoint) segmentPath.unshift([firstPoint.longitude, firstPoint.latitude]);
        }
        segments.push({
            id: `segment-${i}`, label: `Trajeto para ${stop.name}`, path: segmentPath,
            color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            travelTime: formatTimeDiff(new Date(lastDepartureTime), stopArrivalTime),
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
                .filter(loc => new Date(loc.timestamp).getTime() >= new Date(lastStop.departureTime!).getTime())
                .map(loc => [loc.longitude, loc.latitude] as [number, number]);
            if (finalSegmentPath.length > 0) {
                segments.push({ id: 'segment-current', label: 'Posição Atual', path: finalSegmentPath, color: '#71717a', travelTime: formatTimeDiff(new Date(lastStop.departureTime!), new Date()), stopTime: '' });
            }
        }
    }
    return segments;
};

// ---- dynamic import for map ----
const RealTimeMap = dynamic(() => import('./RealTimeMap'), {
    ssr: false,
    loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

// ---- Sub-componentes ----

const KpiCard = ({ title, value, icon: Icon, alert }: { title: string; value: string | number; icon?: React.ElementType; alert?: boolean }) => (
    <Card className={alert ? 'border-destructive/50 bg-destructive/5' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {Icon && <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />}
        </CardHeader>
        <CardContent>
            <div className={`text-2xl font-bold ${alert ? 'text-destructive' : ''}`}>{value}</div>
        </CardContent>
    </Card>
);

const VehicleStatusCard = ({ vehicle, onUnlock }: { vehicle: any; onUnlock?: (id: string) => Promise<void> }) => {
    const [confirmUnlock, setConfirmUnlock] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);

    const getStatusDetails = (status: string | undefined) => {
        switch (status) {
            case 'EM_CORRIDA': return { text: 'EM CORRIDA', badgeClass: 'bg-blue-600', cardClass: 'bg-blue-50 dark:bg-blue-900/30' };
            case 'EM_MANUTENCAO': return { text: 'MANUTENÇÃO', badgeClass: 'bg-yellow-500', cardClass: 'bg-yellow-50 dark:bg-yellow-900/30' };
            case 'BLOQUEADO_CHECKLIST': return { text: 'BLOQUEADO', badgeClass: 'bg-destructive animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]', cardClass: 'bg-red-50 dark:bg-red-900/40 border-destructive border-2' };
            case 'PARADO': default: return { text: 'PARADO', badgeClass: 'bg-green-600', cardClass: 'bg-green-50 dark:bg-green-800/30' };
        }
    };
    const { text, badgeClass, cardClass } = getStatusDetails(vehicle.status);
    return (
        <Card className={`flex flex-col items-center justify-center p-4 text-center relative transition-all ${cardClass}`}>
            {vehicle.status === 'BLOQUEADO_CHECKLIST' && onUnlock && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="absolute -top-3 -right-3 rounded-full h-8 w-8 p-0 shadow-lg" title="Desbloquear">
                            <CheckCircle className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-destructive font-bold">Desbloqueio de Segurança</AlertDialogTitle>
                            <AlertDialogDescription>
                                Este veículo foi bloqueado por apresentar não conformidades graves (Grau A ou B) no checklist.
                                Ao desbloquear, você assume inteira responsabilidade pela liberação do veículo na operação.
                            </AlertDialogDescription>
                            <div className="my-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                                <Label className="text-xs font-bold text-destructive uppercase mb-2 block">Para liberar, digite exatamente: EU ME RESPONSABILIZO</Label>
                                <Input value={confirmUnlock} onChange={(e) => setConfirmUnlock(e.target.value)} placeholder="EU ME RESPONSABILIZO" className="text-center font-bold" />
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setConfirmUnlock('')}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => { setIsUnlocking(true); await onUnlock(vehicle.id); setIsUnlocking(false); setConfirmUnlock(''); }} disabled={confirmUnlock !== 'EU ME RESPONSABILIZO' || isUnlocking} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
                                {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Confirmar Liberação
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            <p className="font-bold text-lg">{vehicle.id}</p>
            <p className="text-xs text-muted-foreground -mt-1 mb-2">{vehicle.model}</p>
            <Badge variant="default" className={`${badgeClass} hover:${badgeClass}`}>{text}</Badge>
            {vehicle.status === 'EM_CORRIDA' && vehicle.driverName && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><User className="h-3 w-3" />{vehicle.driverName}</p>
            )}
        </Card>
    );
};

const RunAccordionItem = ({ run, usersMap, onViewRoute, onCancelRun, isOP }: {
    run: AggregatedRun;
    usersMap: Map<string, { name: string; photoURL?: string; shift?: string }>;
    onViewRoute: () => void;
    onCancelRun?: (runId: string) => void;
    isOP?: boolean;
}) => {
    const isCompletedRun = run.status === 'COMPLETED';
    const isPlannedRun = run.status === 'PLANNED';

    let completedStops = 0;
    let totalStops = 0;
    if (run.plannedRoute) {
        totalStops = run.plannedRoute.trips.reduce((acc, trip) => acc + trip.stops.length, 0);
        completedStops = run.stops.filter(s => s.status === 'COMPLETED').length;
    } else {
        completedStops = run.stops.filter(s => s.status === 'COMPLETED').length;
        totalStops = run.stops.filter(s => s.status !== 'CANCELED').length;
    }
    const progress = isCompletedRun ? 100 : (totalStops > 0 ? (completedStops / totalStops) * 100 : 0);
    const activeRun = run.originalRuns.find(r => r.status === 'IN_PROGRESS');
    const currentStop = run.stops.find(s => s.status === 'IN_PROGRESS');
    const driver = usersMap.get(run.driverId);
    const formatTime = (ts: string | null | undefined) => ts ? format(new Date(ts), 'HH:mm') : '--:--';
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');

    return (
        <AccordionItem value={run.key} className={cn("bg-card border rounded-lg shadow-sm transition-all", isPlannedRun && "opacity-60 border-dashed")}>
            <AccordionTrigger className="p-4 hover:no-underline">
                <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center text-left gap-4 sm:gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg text-primary truncate flex items-center gap-2">
                            <Truck className="h-5 w-5" /> {run.vehicleId}
                            <span className="text-xs font-normal text-muted-foreground ml-2">({run.shift})</span>
                        </p>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {isPlannedRun ? (
                                <><Hourglass className="h-4 w-4 text-muted-foreground" /> Aguardando Motorista</>
                            ) : (
                                <><Avatar className="h-5 w-5"><AvatarImage src={driver?.photoURL} alt={run.driverName} /><AvatarFallback className="text-xs">{getInitials(run.driverName)}</AvatarFallback></Avatar>{run.driverName}</>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 w-full sm:w-auto">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{isCompletedRun ? 'Concluído' : isPlannedRun ? 'Pendente' : `${completedStops} de ${totalStops} paradas`}</span>
                            <span className="font-bold text-primary">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                    </div>
                    <div className="flex-none">
                        <Badge variant={isCompletedRun ? 'default' : (isPlannedRun ? "outline" : (currentStop ? "default" : "secondary"))}
                            className={cn("truncate px-3", isCompletedRun && "bg-green-600 hover:bg-green-700", isPlannedRun && "border-primary/30 text-primary/50")}>
                            <MapPin className="h-3 w-3 mr-1.5" />
                            {isCompletedRun ? `Finalizado às ${formatTime(run.endTime)}` :
                                isPlannedRun ? "Rota Programada" :
                                    (activeRun?.tripName ? `${activeRun.tripName}: ${currentStop?.name || 'Iniciando'}` : (currentStop ? currentStop.name : 'Em Trânsito...'))}
                        </Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
                <div className="space-y-4 mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">{isPlannedRun ? 'Roteirização Programada' : 'Acompanhamento em Tempo Real'}</h4>
                        {!isPlannedRun && (
                            <div className="flex gap-2">
                                {activeRun && onCancelRun && isOP && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="text-destructive h-8 px-2 font-bold flex items-center gap-1.5 hover:bg-destructive/10">
                                                <X className="h-4 w-4" /> Cancelar
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-destructive font-black uppercase">Cancelar este trajeto?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta ação irá interromper a corrida de <strong>{run.driverName}</strong> no veículo <strong>{run.vehicleId}</strong>.
                                                    Os dados já registrados serão mantidos mas a corrida será encerrada imediatamente.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onCancelRun(activeRun.id)} className="bg-destructive hover:bg-destructive shadow-lg font-bold">Encerrar Agora</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                                <Button variant="outline" size="sm" onClick={onViewRoute} className="h-8">
                                    <Route className="mr-2 h-4 w-4" /> Ver No Mapa
                                </Button>
                            </div>
                        )}
                    </div>
                    {isPlannedRun && run.plannedRoute ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {run.plannedRoute.trips.map((trip, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-primary">{trip.name}</span>
                                        <Badge variant="secondary" className="text-[9px] h-4">{trip.stops.length} paradas</Badge>
                                    </div>
                                    <div className="space-y-1.5 border-l-2 border-primary/10 ml-1 pl-2">
                                        {trip.stops.map((stop, sIdx) => (
                                            <div key={sIdx} className="text-[10px] flex justify-between gap-2">
                                                <span className="truncate">{stop.name}</span>
                                                <span className="text-muted-foreground whitespace-nowrap">{stop.plannedArrival}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <RunDetailsContent run={run} />
                    )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const RunDetailsContent = ({ run, onSegmentClick, highlightedSegmentId }: { run: AggregatedRun; onSegmentClick?: (id: string) => void; highlightedSegmentId?: string | null }) => {
    const getStatusInfo = (status: string) => ({
        'COMPLETED': { icon: CheckCircle, color: 'text-green-500', label: 'Concluído' },
        'IN_PROGRESS': { icon: PlayCircle, color: 'text-blue-500', label: 'Em Andamento' },
        'PENDING': { icon: Clock, color: 'text-gray-500', label: 'Pendente' },
        'CANCELED': { icon: X, color: 'text-red-500', label: 'Cancelado' }
    })[status] || { icon: Clock, color: 'text-gray-500', label: 'Pendente' };

    const formatTime = (ts: string | null) => ts ? format(new Date(ts), 'HH:mm') : '--:--';
    let segmentCounter = 0;

    if (run.plannedRoute) {
        return (
            <div className="space-y-6 mt-4">
                {run.plannedRoute.trips.map((plannedTrip, tripIdx) => {
                    const matchedRun = run.originalRuns.find(r => r.tripId === plannedTrip.id);
                    const isFullyCompleted = matchedRun?.status === 'COMPLETED';
                    const isInProgress = matchedRun?.status === 'IN_PROGRESS';
                    const isPlanned = !matchedRun;
                    return (
                        <div key={plannedTrip.id} className={cn("p-4 rounded-xl border transition-all",
                            isFullyCompleted ? "bg-green-50/30 border-green-100" : isInProgress ? "bg-blue-50/30 border-blue-100 ring-1 ring-blue-100" : "bg-muted/10 border-dashed")}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                                        isFullyCompleted ? "bg-green-500 text-white" : isInProgress ? "bg-blue-500 text-white animate-pulse" : "bg-muted text-muted-foreground")}>
                                        {tripIdx + 1}
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-sm">{plannedTrip.name}</h5>
                                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
                                            {isFullyCompleted ? 'VIAGEM CONCLUÍDA' : isInProgress ? 'VIAGEM EM ANDAMENTO' : 'PROGRAMADA'}
                                        </p>
                                    </div>
                                </div>
                                {matchedRun && (
                                    <div className="text-right text-[10px] text-muted-foreground">
                                        <p>Início: {formatTime(matchedRun.startTime)}</p>
                                        {matchedRun.endTime && <p>Fim: {formatTime(matchedRun.endTime)}</p>}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4 ml-4 border-l-2 border-muted pl-6">
                                {plannedTrip.stops.map((plannedStop, stopIdx) => {
                                    const actualStop = matchedRun?.stops.find(s => s.name === plannedStop.name);
                                    const status = actualStop?.status || 'PENDING';
                                    const { icon: Icon, color, label } = getStatusInfo(status);
                                    const isCompleted = status === 'COMPLETED';
                                    return (
                                        <div key={stopIdx} className="relative">
                                            <div className={cn("absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border-2 bg-background",
                                                isCompleted ? "border-green-500 bg-green-500" : status === 'IN_PROGRESS' ? "border-blue-500 animate-pulse" : "border-muted")} />
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={cn("text-xs font-bold", !isCompleted && status !== 'IN_PROGRESS' && "text-muted-foreground")}>{plannedStop.name}</p>
                                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                                        <span>Programado: {plannedStop.plannedArrival}</span>
                                                        {actualStop?.arrivalTime && <span className="text-primary font-bold">Real: {formatTime(actualStop.arrivalTime)}</span>}
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={cn("text-[9px] h-4", color)}>{label}</Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {run.originalRuns.map((originalRun, runIndex) => {
                const previousRun = runIndex > 0 ? run.originalRuns[runIndex - 1] : null;
                const idleTime = previousRun?.endTime ? formatDistanceStrict(new Date(previousRun.endTime), new Date(originalRun.startTime), { locale: ptBR, unit: 'minute' }) : null;
                let lastDepartureTime = originalRun.startTime;
                let lastMileage = originalRun.startMileage;
                return (
                    <div key={originalRun.id}>
                        {idleTime && parseFloat(idleTime) > 0 && (
                            <div className="flex items-center gap-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 my-2">
                                <Hourglass className="h-6 w-6 flex-shrink-0 text-amber-500" />
                                <div className="flex-1"><p className="font-medium">Tempo Parado</p><p className="text-xs text-muted-foreground">O veículo ficou parado entre as corridas.</p></div>
                                <div className="text-right text-sm text-muted-foreground"><p><strong>{idleTime}</strong></p></div>
                            </div>
                        )}
                        <div className="px-2 py-1 mb-2 bg-muted/30 rounded flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">{originalRun.tripName || 'Trajeto Manual'}</span>
                            <span className="text-[10px] text-muted-foreground">{formatTime(originalRun.startTime)}</span>
                        </div>
                        {originalRun.stops.map((stop) => {
                            const { icon: Icon, color, label } = getStatusInfo(stop.status);
                            if (stop.status === 'CANCELED') return null;
                            const isCompletedStop = stop.status === 'COMPLETED';
                            const arrivalTime = stop.arrivalTime ? new Date(stop.arrivalTime) : null;
                            const departureTime = stop.departureTime ? new Date(stop.departureTime) : null;
                            const stopTime = arrivalTime && departureTime ? formatDistanceStrict(arrivalTime, departureTime, { locale: ptBR, unit: 'minute' }) : null;
                            const segmentDistance = (stop.mileageAtStop !== null && stop.mileageAtStop !== undefined && lastMileage !== null && lastMileage !== undefined) ? stop.mileageAtStop - lastMileage : null;
                            if (stop.departureTime) lastDepartureTime = stop.departureTime;
                            if (stop.mileageAtStop) lastMileage = stop.mileageAtStop;
                            const segmentId = stop.status !== 'PENDING' ? `segment-${segmentCounter++}` : '';
                            return (
                                <div key={`${originalRun.id}-${stop.name}`}
                                    className={cn("flex items-start gap-4 p-3 rounded-md", isCompletedStop ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/20',
                                        onSegmentClick && segmentId && "cursor-pointer hover:bg-muted", highlightedSegmentId === segmentId && "ring-2 ring-primary")}
                                    onClick={() => onSegmentClick && segmentId && onSegmentClick(segmentId)}>
                                    <Icon className={`h-5 w-5 flex-shrink-0 mt-1 ${color}`} />
                                    <div className="flex-1">
                                        <p className="font-medium">{stop.name}</p>
                                        <p className={`text-xs ${isCompletedStop ? 'text-muted-foreground' : color}`}>{label}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                            {stop.arrivalTime && <span className="flex items-center gap-1"><Route className="h-3 w-3 text-gray-400" /> Viagem: <strong>{formatTime(originalRun.startTime)} - {formatTime(stop.arrivalTime)}</strong></span>}
                                            {stopTime && <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-gray-400" /> Parada: <strong>{stopTime}</strong></span>}
                                            {segmentDistance !== null && <span className="flex items-center gap-1"><Milestone className="h-3 w-3 text-gray-400" /> Distância: <strong>{segmentDistance.toFixed(1)} km</strong></span>}
                                            {stop.collectedOccupiedCars !== null && <span className="flex items-center gap-1"><Car className="h-3 w-3 text-gray-400" /> Ocupados: <strong>{stop.collectedOccupiedCars}</strong></span>}
                                            {stop.collectedEmptyCars !== null && <span className="flex items-center gap-1"><Package className="h-3 w-3 text-gray-400" /> Vazios: <strong>{stop.collectedEmptyCars}</strong></span>}
                                        </div>
                                        {stop.observation && <div className="border-t mt-2 pt-2"><p className="text-xs text-muted-foreground"><strong>Obs:</strong> {stop.observation}</p></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

// ---- Componente Principal ----
export default function AcompanhamentoTab({ activeTab, isMilkrunAstec }: { activeTab: string; isMilkrunAstec?: boolean }) {
    const auth = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const profile = auth.profile;

    const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
    const [allRuns, setAllRuns] = useState<RunDto[]>([]);
    const [users, setUsers] = useState<Map<string, { name: string; photoURL?: string; shift?: string }>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    const [selectedRunKeyForMap, setSelectedRunKeyForMap] = useState<string | null>(null);
    const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isFleetMapOpen, setIsFleetMapOpen] = useState(false);
    const [activeTrucks, setActiveTrucks] = useState<{ id: string; latitude: number; longitude: number }[]>([]);
    const [selectedShift, setSelectedShift] = useState<string>('1° NORMAL');
    const [dailyProgrammedRoutes, setDailyProgrammedRoutes] = useState<PlannedRoute[]>([]);

    const companyId = profile?.companyId || '';
    const sectorId = profile?.sectorId || '';

    useEffect(() => setIsClient(true), []);

    // SignalR real-time connection (replaces polling)
    const signalRUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5089'}/hubs/runs`;

    // Debounce refetch to avoid flooding on rapid events
    const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refetchRef = useRef<() => Promise<void>>(async () => {});

    const loadData = useCallback(async () => {
        if (!companyId || !sectorId) return;
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const todayStart = startOfDay(new Date()).toISOString();
            const todayEnd = endOfDay(new Date()).toISOString();

            const [vehResp, usersResp] = await Promise.all([
                api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`),
                api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`),
            ]);

            setVehicles(vehResp);
            const usersMap = new Map<string, { name: string; photoURL?: string; shift?: string }>();
            usersResp.forEach(u => usersMap.set(u.id, { name: u.name, photoURL: u.photoURL, shift: SHIFT_NUM_TO_NAME[u.shift] || '1° NORMAL' }));
            setUsers(usersMap);

            if (!isMilkrunAstec) {
                try {
                    const routes = await api.get<RouteDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/routes?date=${todayStr}`);
                    const planned: PlannedRoute[] = routes.map(r => ({
                        id: r.id,
                        vehicleId: r.vehicleId,
                        date: r.date,
                        shift: SHIFT_NUM_TO_NAME[r.shift] || '1° NORMAL',
                        isFixed: r.isFixed,
                        trips: r.trips.map(t => ({
                            id: t.id,
                            name: t.name,
                            stops: t.stops.map(s => ({
                                name: s.name,
                                plannedArrival: s.plannedArrival,
                                plannedDeparture: s.plannedDeparture,
                            }))
                        }))
                    }));
                    setDailyProgrammedRoutes(planned);
                } catch { /* routes may not exist yet */ }
            }

            const runSummaries = await api.get<RunSummaryDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${todayStart}&dateTo=${todayEnd}`);

            const fullRuns: RunDto[] = [];
            for (const rs of runSummaries) {
                try {
                    const detail = await api.get<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs/${rs.id}`);
                    fullRuns.push(detail);
                } catch { /* skip */ }
            }
            setAllRuns(fullRuns.filter(r => r.status !== 'CANCELED'));
        } catch (e: any) {
            if (!e.message?.includes('404')) {
                console.error('Erro ao carregar dados:', e);
            }
        } finally {
            setIsLoading(false);
        }
    }, [companyId, sectorId, isMilkrunAstec]);

    // Keep ref up to date
    refetchRef.current = loadData;

    const debouncedRefetch = useCallback(() => {
        if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = setTimeout(() => refetchRef.current(), 1000);
    }, []);

    // SignalR handlers
    const signalRHandlers = useMemo(() => ({
        RunStarted: () => debouncedRefetch(),
        RunUpdated: () => debouncedRefetch(),
        RunEnded: () => debouncedRefetch(),
        RunCanceled: (data: any) => {
            const runId = (data as any).RunId || (data as any).Id || (data as any).runId;
            if (runId) {
                setAllRuns(prev => (prev || []).filter(r => r.id !== runId));
            }
            debouncedRefetch();
        },
        VehicleLocation: (data: any) => {
            const runId = data.RunId as string;
            const lat = data.Latitude as number;
            const lng = data.Longitude as number;
            // Update location history in run data
            setAllRuns(prev => (prev || []).map(run => {
                if (run.id !== runId) return run;
                const newPoint = { latitude: lat, longitude: lng, timestamp: new Date().toISOString() };
                return {
                    ...run,
                    locationHistory: run.locationHistory
                        ? [...run.locationHistory, newPoint]
                        : [newPoint],
                };
            }));
            // Look up vehicleId to update fleet map markers
            setAllRuns(prev => {
                const run = prev.find(r => r.id === runId);
                if (run) {
                    setActiveTrucks(prevTrucks => {
                        const idx = prevTrucks.findIndex(t => t.id === run.vehicleId);
                        const entry = { id: run.vehicleId, latitude: lat, longitude: lng };
                        if (idx >= 0) {
                            const next = [...prevTrucks];
                            next[idx] = entry;
                            return next;
                        }
                        return [...prevTrucks, entry];
                    });
                }
                return prev;
            });
        },
    }), [debouncedRefetch]);

    const { isConnected, subscribeToSector } = useSignalR({
        hubUrl: signalRUrl,
        accessTokenFactory: () => getAccessToken() || '',
        handlers: signalRHandlers as Record<string, (...args: unknown[]) => void>,
        enabled: !!profile,
    });

    // Subscribe to sector when connected
    useEffect(() => {
        if (isConnected && companyId && sectorId) {
            subscribeToSector(companyId, sectorId);
        }
    }, [isConnected, companyId, sectorId, subscribeToSector]);

    // Initial load
    useEffect(() => {
        if (!profile || activeTab !== 'acompanhamento') return;
        setIsLoading(true);
        loadData();
    }, [profile, companyId, sectorId, activeTab, loadData]);

    // Convert API RunDto to internal Run type
    const runsInternal: import('./types').Run[] = useMemo(() => (allRuns || []).map(r => ({
        id: r.id,
        driverId: r.driverId,
        driverName: r.driverName,
        vehicleId: r.vehicleId,
        startMileage: r.startMileage,
        startTime: r.startTime,
        endTime: r.endTime,
        endMileage: r.endMileage,
        status: r.status,
        stops: r.stops.map(s => ({
            name: s.name,
            status: s.status,
            arrivalTime: s.arrivalTime || null,
            departureTime: s.departureTime || null,
            collectedOccupiedCars: s.collectedOccupiedCars ?? null,
            collectedEmptyCars: s.collectedEmptyCars ?? null,
            mileageAtStop: s.mileageAtStop ?? null,
            occupancy: s.occupancy ?? null,
            observation: s.observation,
        })),
        locationHistory: r.locationHistory || [],
        tripId: r.tripId,
        tripName: r.tripName,
        shift: SHIFT_NUM_TO_NAME[r.shift] || '1° NORMAL',
        routeId: r.routeId,
    })), [allRuns]);

    // Vehicle statuses derived from vehicles + active runs
    const vehicleStatuses = useMemo(() => {
        const activeRunMap = new Map<string, string>();
        runsInternal.forEach(run => {
            if (run.status === 'IN_PROGRESS') activeRunMap.set(run.vehicleId, run.driverName);
        });
        return vehicles.filter(v => v.isTruck).map(v => ({
            id: v.id,
            model: v.model,
            isTruck: v.isTruck,
            status: activeRunMap.has(v.id) ? 'EM_CORRIDA' as const : v.status,
            driverName: activeRunMap.get(v.id),
        }));
    }, [vehicles, runsInternal]);

    // Aggregated runs
    const aggregatedRuns = useMemo(() => {
        const groupedRuns = new Map<string, import('./types').Run[]>();
        runsInternal.forEach(run => {
            const driver = users.get(run.driverId);
            const runDate = format(new Date(run.startTime), 'yyyy-MM-dd');
            const shift = run.shift || driver?.shift || '1° NORMAL';
            const key = `${run.vehicleId}-${shift}-${runDate}`;
            if (!groupedRuns.has(key)) groupedRuns.set(key, []);
            groupedRuns.get(key)!.push(run);
        });

        const aggregated: AggregatedRun[] = [];
        const processedKeys = new Set<string>();

        groupedRuns.forEach((runs, key) => {
            runs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            const firstRun = runs[0];
            const lastRun = runs[runs.length - 1];
            const driver = users.get(firstRun.driverId);
            const allStops = runs.flatMap(r => r.stops).sort((a, b) => (a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0) - (b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0));
            const allLocations = runs.flatMap(r => r.locationHistory || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const startMileage = firstRun.startMileage;
            const endMileage = lastRun.endMileage ?? allStops.filter(s => s.mileageAtStop).slice(-1)[0]?.mileageAtStop ?? null;
            const totalDistance = (endMileage && startMileage) ? endMileage - startMileage : 0;
            const status = runs.some(r => r.status === 'IN_PROGRESS') ? 'IN_PROGRESS' as const : 'COMPLETED' as const;
            const shift = (firstRun as any).shift || driver?.shift || '1° NORMAL';
            const runDateStr = format(new Date(firstRun.startTime), 'yyyy-MM-dd');

            const planned = isMilkrunAstec ? undefined : dailyProgrammedRoutes.find(pr => {
                if ((firstRun as any).routeId && pr.id === (firstRun as any).routeId) return true;
                return pr.vehicleId === firstRun.vehicleId && (pr.date === runDateStr || pr.date === 'fixed') && (pr.shift === shift || (!pr.shift && shift === '1° NORMAL'));
            });

            aggregated.push({
                key, driverId: firstRun.driverId, driverName: firstRun.driverName, vehicleId: firstRun.vehicleId,
                shift, date: format(new Date(firstRun.startTime), 'dd/MM/yyyy'),
                startTime: firstRun.startTime, endTime: lastRun.endTime ?? null,
                totalDistance, stops: allStops, locationHistory: allLocations,
                originalRuns: runs, startMileage, status, plannedRoute: planned,
            });
            processedKeys.add(key);
        });

        // Add planned routes without runs
        if (!isMilkrunAstec) {
            dailyProgrammedRoutes.forEach(route => {
                const shift = route.shift || '1° NORMAL';
                if (shift !== selectedShift) return;
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const key = `${route.vehicleId}-${shift}-${todayStr}`;
                if (!processedKeys.has(key)) {
                    aggregated.push({
                        key, driverId: '', driverName: 'Aguardando Motorista', vehicleId: route.vehicleId,
                        shift, date: format(new Date(), 'dd/MM/yyyy'), startTime: new Date().toISOString(),
                        endTime: null, totalDistance: 0, stops: [], locationHistory: [],
                        originalRuns: [], startMileage: 0, status: 'PLANNED', plannedRoute: route,
                    });
                    processedKeys.add(key);
                }
            });
        }

        return aggregated.sort((a, b) => {
            if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
            if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;
            if (a.status === 'COMPLETED' && b.status === 'PLANNED') return -1;
            if (a.status === 'PLANNED' && b.status === 'COMPLETED') return 1;
            return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        });
    }, [runsInternal, users, dailyProgrammedRoutes, selectedShift, isMilkrunAstec]);

    // Active truck locations for fleet map
    useEffect(() => {
        const inProgressRuns = aggregatedRuns.filter(run => run.status === 'IN_PROGRESS');
        const truckLocations = inProgressRuns.flatMap(run => {
            if (run.locationHistory && run.locationHistory.length > 0) {
                const lastLocation = run.locationHistory[run.locationHistory.length - 1];
                return [{ id: run.vehicleId, latitude: lastLocation.latitude, longitude: lastLocation.longitude }];
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
    };

    const handleCancelRun = async (runId: string) => {
        if (!companyId || !sectorId) return;
        try {
            await api.put(`/api/companies/${companyId}/sectors/${sectorId}/runs/${runId}/cancel`, {});
            toast({ title: 'Sucesso', description: 'O trajeto foi interrompido e cancelado.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cancelar o trajeto.' });
        }
    };

    const handleUnlockVehicle = async (vehicleId: string) => {
        if (!companyId || !sectorId) return;
        try {
            await api.put(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vehicleId}/status`, { status: 'PARADO' });
            toast({ title: 'Veículo Desbloqueado', description: `O caminhão ${vehicleId} foi liberado com sucesso.` });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desbloquear o caminhão.' });
        }
    };

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
        bloqueado: vehicleStatuses.filter(v => v.status === 'BLOQUEADO_CHECKLIST').length,
    };

    const availableShifts = useMemo(() => {
        const shifts = new Set<string>(['1° NORMAL', '2° NORMAL', '1° ESPECIAL', '2° ESPECIAL']);
        users.forEach(u => { if (u.shift) shifts.add(u.shift); });
        dailyProgrammedRoutes.forEach(r => { if (r.shift) shifts.add(r.shift); });
        return Array.from(shifts).sort();
    }, [users, dailyProgrammedRoutes]);

    // Milkrun Astec simplified view
    if (isMilkrunAstec) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-xl">Caminhões do Setor</h3>
                    <Button variant="outline" size="sm" onClick={() => setIsFleetMapOpen(true)} disabled={activeTrucks.length === 0}>
                        <MapIcon className="h-4 w-4 mr-2" />Mapa Frota
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {vehicleStatuses.map(v => <VehicleStatusCard key={v.id} vehicle={v} onUnlock={handleUnlockVehicle} />)}
                </div>

                <Separator className="my-8" />

                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-xl">Acompanhamento das Corridas</h3>
                    <p className="text-xs font-medium text-muted-foreground bg-muted p-1 px-3 rounded-full">{format(new Date(), 'dd/MM/yyyy')}</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : aggregatedRuns.length === 0 ? (
                    <Card className="p-12 text-center border-dashed border-2"><CardDescription>Nenhuma corrida registrada hoje.</CardDescription></Card>
                ) : (
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {aggregatedRuns.map(run => (
                            <RunAccordionItem key={run.key} run={run} usersMap={users} onViewRoute={() => handleViewRoute(run.key)} onCancelRun={handleCancelRun} isOP={profile?.isOP} />
                        ))}
                    </Accordion>
                )}

                {/* Run route map dialog */}
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
                                            {highlightedSegmentId && <Button variant="ghost" size="sm" onClick={() => setHighlightedSegmentId(null)}><EyeOff className="mr-2 h-4 w-4" /> Limpar</Button>}
                                        </div>
                                        <ScrollArea className="flex-1 -mr-6 pr-6"><RunDetailsContent run={selectedRunForMap} onSegmentClick={setHighlightedSegmentId} highlightedSegmentId={highlightedSegmentId} /></ScrollArea>
                                    </div>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Fleet map dialog */}
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
    }

    // Normal view (non-Milkrun Astec)
    return (
        <div className="space-y-6">
            {isLoading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <Card key={i}><Skeleton className="h-32 w-full" /></Card>)}
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
                        <KpiCard title="Bloqueados" value={kpis.bloqueado} icon={AlertCircle} alert={kpis.bloqueado > 0} />
                    </div>

                    {!isMilkrunAstec && (
                        <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-lg">Acompanhamento de Operação</h3>
                                <div className="h-6 w-px bg-muted" />
                                <Select value={selectedShift} onValueChange={setSelectedShift}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Selecione o Turno" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableShifts.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-sm text-muted-foreground">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Truck className="h-6 w-6" /> Status da Frota</CardTitle>
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
                                    {vehicleStatuses.map(v => <VehicleStatusCard key={v.id} vehicle={v} onUnlock={handleUnlockVehicle} />)}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Separator className="my-6" />

                    <div className="mt-6">
                        {aggregatedRuns.filter(r => isMilkrunAstec ? true : r.shift === selectedShift).length === 0 ? (
                            <Card className="text-center p-12 border-dashed border-2">
                                <CardHeader>
                                    <CardTitle>Nenhuma atividade para este turno</CardTitle>
                                    <CardDescription>Não há motoristas em rota ou corridas finalizadas hoje.</CardDescription>
                                </CardHeader>
                            </Card>
                        ) : (
                            <Accordion type="single" collapsible className="w-full space-y-4 shadow-sm" defaultValue={aggregatedRuns.find(r => r.status === 'IN_PROGRESS')?.key || aggregatedRuns[0]?.key}>
                                {aggregatedRuns.filter(r => isMilkrunAstec ? true : r.shift === selectedShift).map(run => (
                                    <RunAccordionItem key={run.key} run={run} usersMap={users} onViewRoute={() => handleViewRoute(run.key)} onCancelRun={handleCancelRun} isOP={profile?.isOP} />
                                ))}
                            </Accordion>
                        )}
                    </div>
                </>
            )}

            {/* Run route map dialog */}
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
                                        {highlightedSegmentId && <Button variant="ghost" size="sm" onClick={() => setHighlightedSegmentId(null)}><EyeOff className="mr-2 h-4 w-4" /> Limpar</Button>}
                                    </div>
                                    <ScrollArea className="flex-1 -mr-6 pr-6"><RunDetailsContent run={selectedRunForMap} onSegmentClick={setHighlightedSegmentId} highlightedSegmentId={highlightedSegmentId} /></ScrollArea>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Fleet map dialog */}
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
}
