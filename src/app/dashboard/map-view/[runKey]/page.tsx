'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { RunDto } from '@/types/api';
import type { AggregatedRun, LocationPoint, Segment } from '../../types';
import { SEGMENT_COLORS } from '../../types';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Route, Timer, Milestone, Car, Package, Warehouse, Clock, CheckCircle, PlayCircle, X } from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const RealTimeMap = dynamic(() => import('../../RealTimeMap'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

const MAX_DISTANCE_BETWEEN_POINTS_KM = 5;

const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const filterLocationOutliers = (locations: LocationPoint[]): LocationPoint[] => {
    if (locations.length < 2) return locations;
    const filtered: LocationPoint[] = [locations[0]];
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

const processRunSegments = (run: AggregatedRun | null): Segment[] => {
    if (!run || !run.locationHistory || run.locationHistory.length === 0) return [];
    const sortedLocations = filterLocationOutliers([...run.locationHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
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
        const segmentPath = sortedLocations
            .filter(loc => new Date(loc.timestamp).getTime() >= new Date(lastDepartureTime).getTime() && new Date(loc.timestamp).getTime() <= stopArrivalTime.getTime())
            .map(loc => [loc.longitude, loc.latitude] as [number, number]);
        if (i > 0) {
            const prevStop = sortedStops[i - 1];
            if (prevStop.departureTime) {
                const prevDtMs = new Date(prevStop.departureTime).getTime();
                const lastPoint = sortedLocations.slice().reverse().find(l => new Date(l.timestamp).getTime() <= prevDtMs);
                if (lastPoint) segmentPath.unshift([lastPoint.longitude, lastPoint.latitude]);
            }
        } else {
            const firstPoint = sortedLocations.find(l => new Date(l.timestamp).getTime() >= new Date(run.startTime).getTime());
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
    if (run.status === 'IN_PROGRESS' && sortedLocations.length > 0) {
        const lastStop = sortedStops[sortedStops.length - 1];
        if (lastStop && lastStop.departureTime) {
            const finalSegmentPath = sortedLocations
                .filter(loc => new Date(loc.timestamp).getTime() >= new Date(lastStop.departureTime!).getTime())
                .map(loc => [loc.longitude, loc.latitude] as [number, number]);
            if (finalSegmentPath.length > 0) {
                segments.push({ id: 'segment-current', label: 'Posição Atual', path: finalSegmentPath, color: '#71717a', travelTime: formatTimeDiff(new Date(lastStop.departureTime!), new Date()), stopTime: '' });
            }
        }
    }
    return segments;
};

export default function MapViewPage({ params }: { params: Promise<{ runKey: string }> }) {
    const { runKey } = use(params);
    const router = useRouter();
    const auth = useAuth();
    const [runData, setRunData] = useState<AggregatedRun | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);

    const profile = auth.profile;
    const companyId = profile?.companyId || '';
    const sectorId = profile?.sectorId || '';

    useEffect(() => {
        if (!profile || !runKey) return;

        const fetchRunData = async () => {
            setIsLoading(true);
            if (!companyId || !sectorId) { router.push('/login'); return; }

            const [vehicleId, shift, date] = runKey.split('-');
            const runDateStart = new Date(`${date}T00:00:00`).toISOString();
            const runDateEnd = new Date(`${date}T23:59:59`).toISOString();

            try {
                const users = await api.get<any[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`);
                const shiftUsers = users.filter((u: any) => {
                    const shiftNames: Record<number, string> = { 0: '1° NORMAL', 1: '2° NORMAL', 2: '1° ESPECIAL', 3: '2° ESPECIAL' };
                    return (shiftNames[u.shift] || '1° NORMAL') === shift;
                });
                const userIds = new Set(shiftUsers.map((u: any) => u.id));
                if (userIds.size === 0) throw new Error("Nenhum usuário encontrado para o turno.");

                const runSummaries = await api.get<any[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${runDateStart}&dateTo=${runDateEnd}`);

                const runs: any[] = [];
                for (const rs of runSummaries) {
                    if (rs.vehicleId !== vehicleId || !userIds.has(rs.driverId)) continue;
                    try {
                        const detail = await api.get<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs/${rs.id}`);
                        runs.push(detail);
                    } catch { /* skip */ }
                }

                if (runs.length === 0) throw new Error("Nenhuma corrida encontrada.");

                runs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                const firstRun = runs[0];
                const lastRun = runs[runs.length - 1];
                const allStops = runs.flatMap((r: any) => r.stops.map((s: any) => ({
                    name: s.name, status: s.status,
                    arrivalTime: s.arrivalTime || null,
                    departureTime: s.departureTime || null,
                    collectedOccupiedCars: s.collectedOccupiedCars ?? null,
                    collectedEmptyCars: s.collectedEmptyCars ?? null,
                    mileageAtStop: s.mileageAtStop ?? null,
                    occupancy: s.occupancy ?? null,
                    observation: s.observation,
                }))).sort((a: any, b: any) => (a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0) - (b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0));
                const allLocations = runs.flatMap((r: any) => r.locationHistory || []).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                const startMileage = firstRun.startMileage;
                const endMileage = lastRun.endMileage ?? allStops.filter((s: any) => s.mileageAtStop).slice(-1)[0]?.mileageAtStop ?? null;

                const aggregated: AggregatedRun = {
                    key: runKey, driverId: firstRun.driverId, driverName: firstRun.driverName,
                    vehicleId: firstRun.vehicleId, shift,
                    date: format(new Date(firstRun.startTime), 'dd/MM/yyyy'),
                    startTime: firstRun.startTime, endTime: lastRun.endTime ?? null,
                    totalDistance: (endMileage && startMileage) ? endMileage - startMileage : 0,
                    stops: allStops, locationHistory: allLocations,
                    originalRuns: runs, startMileage,
                    status: runs.some((r: any) => r.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'COMPLETED',
                };

                setRunData(aggregated);
            } catch (error) {
                console.error("Failed to fetch run data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRunData();
    }, [profile, runKey, router, companyId, sectorId]);

    const mapSegments = useMemo(() => processRunSegments(runData), [runData]);
    const displayedSegments = useMemo(() => {
        if (!highlightedSegmentId) return mapSegments.map(s => ({ ...s, opacity: 0.9 }));
        return mapSegments.map(s => ({ ...s, opacity: s.id === highlightedSegmentId ? 1.0 : 0.3 }));
    }, [mapSegments, highlightedSegmentId]);

    if (isLoading) {
        return <div className="flex h-screen w-screen items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }
    if (!runData) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-4">
                <p className="text-xl font-semibold">Rota não encontrada</p>
                <Button onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen relative">
            <RealTimeMap
                segments={displayedSegments}
                fullLocationHistory={runData.locationHistory?.map((p: LocationPoint) => ({ latitude: p.latitude, longitude: p.longitude })) || []}
                vehicleId={runData.vehicleId}
            />
            <Button onClick={() => router.back()} variant="secondary" size="icon" className="absolute top-4 left-4 h-12 w-12 rounded-full shadow-lg">
                <ArrowLeft className="h-6 w-6" /><span className="sr-only">Voltar</span>
            </Button>
            <div className="absolute top-4 right-4 w-full max-w-sm">
                <Card className="bg-background/80 backdrop-blur-sm">
                    <CardHeader><CardTitle>Legenda da Rota</CardTitle></CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[calc(100vh-10rem)]">
                            <LegendContent run={runData} onSegmentClick={setHighlightedSegmentId} highlightedSegmentId={highlightedSegmentId} />
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const LegendContent = ({ run, onSegmentClick, highlightedSegmentId }: { run: AggregatedRun; onSegmentClick?: (id: string) => void; highlightedSegmentId?: string | null }) => {
    const getStatusInfo = (status: string) => ({
        'COMPLETED': { icon: CheckCircle, color: 'text-green-500' },
        'IN_PROGRESS': { icon: PlayCircle, color: 'text-blue-500' },
        'PENDING': { icon: Clock, color: 'text-gray-500' },
        'CANCELED': { icon: X, color: 'text-red-500' },
    })[status] || { icon: Clock, color: 'text-gray-500' };

    const formatTime = (ts: string | null) => ts ? format(new Date(ts), 'HH:mm') : '--:--';
    let segmentCounter = 0;

    return (
        <div className="space-y-2 pr-4">
            {run.stops.filter((s: any) => s.status !== 'CANCELED').map((stop: any) => {
                const { icon: Icon, color } = getStatusInfo(stop.status);
                const segmentId = stop.status !== 'PENDING' ? `segment-${segmentCounter}` : '';
                if (stop.status !== 'PENDING') segmentCounter++;
                return (
                    <div key={stop.name}
                        className={cn("flex items-start gap-3 p-3 rounded-md transition-colors", segmentId && "cursor-pointer hover:bg-muted", highlightedSegmentId === segmentId && "bg-muted ring-2 ring-primary")}
                        onClick={() => onSegmentClick && segmentId && onSegmentClick(segmentId)}>
                        <Icon className={`h-4 w-4 flex-shrink-0 mt-1 ${color}`} />
                        <div className="flex-1">
                            <p className="font-medium text-sm">{stop.name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                                {stop.arrivalTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-gray-400" /> {formatTime(stop.arrivalTime)}</span>}
                                {stop.mileageAtStop !== null && <span className="flex items-center gap-1"><Milestone className="h-3 w-3 text-gray-400" /> {stop.mileageAtStop} km</span>}
                                {stop.collectedOccupiedCars !== null && <span className="flex items-center gap-1"><Car className="h-3 w-3 text-gray-400" /> {stop.collectedOccupiedCars}</span>}
                                {stop.collectedEmptyCars !== null && <span className="flex items-center gap-1"><Package className="h-3 w-3 text-gray-400" /> {stop.collectedEmptyCars}</span>}
                                {stop.occupancy !== null && <span className="flex items-center gap-1"><Warehouse className="h-3 w-3 text-gray-400" /> {stop.occupancy}%</span>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
