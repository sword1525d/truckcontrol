
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Route, Timer, Milestone, Car, Package, Warehouse, Clock, CheckCircle, PlayCircle, X } from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import type { Run, LocationPoint, FirestoreUser, AggregatedRun, Segment } from '../../tracking/page';

const RealTimeMap = dynamic(() => import('../../RealTimeMap'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

const SEGMENT_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899',
    '#6366f1', '#f59e0b', '#14b8a6', '#d946ef'
];
const MAX_DISTANCE_BETWEEN_POINTS_KM = 5;

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
};

const formatTimeDiff = (start: Date, end: Date) => {
    if (!start || !end) return 'N/A';
    return formatDistanceStrict(end, start, { locale: ptBR, unit: 'minute' });
}

const processRunSegments = (run: AggregatedRun | null): Segment[] => {
    if (!run || !run.locationHistory || run.locationHistory.length === 0) return [];

    const sortedAndFilteredLocations = filterLocationOutliers(
        [...run.locationHistory].sort((a, b) => a.timestamp.seconds - b.timestamp.seconds)
    );
    const sortedStops = [...run.stops].filter(s => s.status === 'COMPLETED' || s.status === 'IN_PROGRESS').sort((a, b) => (a.arrivalTime?.seconds || Infinity) - (b.arrivalTime?.seconds || Infinity));

    const segments: Segment[] = [];
    let lastDepartureTime = run.startTime;
    let lastMileage = run.startMileage;

    for (let i = 0; i < sortedStops.length; i++) {
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
            distance: segmentDistance !== null ? `${segmentDistance.toFixed(1)} km` : undefined
        });

        if (stop.departureTime) {
            lastDepartureTime = stop.departureTime;
        }
        if (stop.mileageAtStop) {
            lastMileage = stop.mileageAtStop;
        }
    }
     // Add final segment to current location if run is in progress
    if (run.status === 'IN_PROGRESS' && sortedAndFilteredLocations.length > 0) {
        const lastStop = sortedStops[sortedStops.length - 1];
        if (lastStop && lastStop.departureTime) {
            const lastDepartureTime = lastStop.departureTime;
            const finalSegmentPath = sortedAndFilteredLocations
                .filter(loc => loc.timestamp.seconds >= lastDepartureTime.seconds)
                .map(loc => [loc.longitude, loc.latitude] as [number, number]);

            if (finalSegmentPath.length > 0) {
                 segments.push({
                    id: `segment-current`,
                    label: `Posição Atual`,
                    path: finalSegmentPath,
                    color: '#71717a', // A neutral color
                    travelTime: formatTimeDiff(new Date(lastDepartureTime.seconds * 1000), new Date()),
                    stopTime: '',
                });
            }
        }
    }
    return segments;
};

export default function MapViewPage({ params }: { params: { runKey: string } }) {
    const router = useRouter();
    const { firestore } = useFirebase();
    const [runData, setRunData] = useState<AggregatedRun | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore || !params.runKey) return;

        const fetchRunData = async () => {
            setIsLoading(true);
            const companyId = localStorage.getItem('companyId');
            const sectorId = localStorage.getItem('sectorId');

            if (!companyId || !sectorId) {
                router.push('/login');
                return;
            }

            const [vehicleId, shift, date] = params.runKey.split('-');
            const runDate = new Date(`${date}T00:00:00`);

            try {
                // 1. Fetch Users to find all users in the specified shift
                const usersCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/users`);
                const usersQuery = query(usersCol, where('shift', '==', shift));
                const usersSnapshot = await getDocs(usersQuery);
                const userIds = usersSnapshot.docs.map(doc => doc.id);

                if (userIds.length === 0) {
                    throw new Error("Nenhum usuário encontrado para o turno especificado.");
                }

                // 2. Fetch all runs for that vehicle on that day
                const runsCol = collection(firestore, `companies/${companyId}/sectors/${sectorId}/runs`);
                const runsQuery = query(runsCol,
                    where('vehicleId', '==', vehicleId),
                    where('startTime', '>=', Timestamp.fromDate(new Date(runDate.setHours(0, 0, 0, 0)))),
                    where('startTime', '<=', Timestamp.fromDate(new Date(runDate.setHours(23, 59, 59, 999))))
                );
                const runsSnapshot = await getDocs(runsQuery);
                const runs = runsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Run))
                    .filter(run => userIds.includes(run.driverId)); // Ensure run was by a driver from that shift

                 if (runs.length === 0) {
                    throw new Error("Nenhuma corrida encontrada para os filtros.");
                 }

                // 3. Aggregate the runs
                runs.sort((a,b) => a.startTime.seconds - b.startTime.seconds);
                const firstRun = runs[0];
                const lastRun = runs[runs.length - 1];

                const allStops = runs.flatMap(r => r.stops).sort((a,b) => (a.arrivalTime?.seconds || 0) - (b.arrivalTime?.seconds || 0));
                const allLocations = runs.flatMap(r => r.locationHistory || []).sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
                const startMileage = firstRun.startMileage;
                const endMileage = lastRun.endMileage ?? allStops.filter(s => s.mileageAtStop).slice(-1)[0]?.mileageAtStop ?? null;

                const aggregated: AggregatedRun = {
                    key: params.runKey,
                    driverId: firstRun.driverId,
                    driverName: firstRun.driverName,
                    vehicleId: firstRun.vehicleId,
                    shift: shift,
                    date: format(firstRun.startTime.toDate(), 'dd/MM/yyyy'),
                    startTime: firstRun.startTime,
                    endTime: lastRun.endTime,
                    totalDistance: (endMileage && startMileage) ? endMileage - startMileage : 0,
                    stops: allStops,
                    locationHistory: allLocations,
                    originalRuns: runs,
                    startMileage: startMileage,
                    status: runs.some(r => r.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'COMPLETED',
                };

                setRunData(aggregated);

            } catch (error) {
                console.error("Failed to fetch run data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRunData();
    }, [firestore, params.runKey, router]);

    const mapSegments = useMemo(() => processRunSegments(runData), [runData]);

    const displayedSegments = useMemo(() => {
        if (!highlightedSegmentId) return mapSegments.map(s => ({ ...s, opacity: 0.9 }));
        return mapSegments.map(s => ({
            ...s,
            opacity: s.id === highlightedSegmentId ? 1.0 : 0.3,
        }));
    }, [mapSegments, highlightedSegmentId]);

    if (isLoading) {
        return <div className="flex h-screen w-screen items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    if (!runData) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-4">
                <p className="text-xl font-semibold">Rota não encontrada</p>
                <Button onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen relative">
            <RealTimeMap
                segments={displayedSegments}
                fullLocationHistory={runData.locationHistory?.map(p => ({ latitude: p.latitude, longitude: p.longitude })) || []}
                vehicleId={runData.vehicleId}
            />

            <Button onClick={() => router.back()} variant="secondary" size="icon" className="absolute top-4 left-4 h-12 w-12 rounded-full shadow-lg">
                <ArrowLeft className="h-6 w-6" />
                <span className="sr-only">Voltar</span>
            </Button>
            
            <div className="absolute top-4 right-4 w-full max-w-sm">
                <Card className="bg-background/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Legenda da Rota</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[calc(100vh-10rem)]">
                            <LegendContent run={runData} onSegmentClick={setHighlightedSegmentId} highlightedSegmentId={highlightedSegmentId}/>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const LegendContent = ({ run, onSegmentClick, highlightedSegmentId }: { run: AggregatedRun, onSegmentClick?: (segmentId: string) => void, highlightedSegmentId?: string | null }) => {
    
    const getStatusInfo = (status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED') => {
        switch (status) {
        case 'COMPLETED': return { icon: CheckCircle, color: 'text-green-500' };
        case 'IN_PROGRESS': return { icon: PlayCircle, color: 'text-blue-500' };
        case 'PENDING': return { icon: Clock, color: 'text-gray-500' };
        case 'CANCELED': return { icon: X, color: 'text-red-500' };
        default: return { icon: Clock, color: 'text-gray-500' };
        }
    };
    
    const formatFirebaseTime = (timestamp: Timestamp | null) => {
        if (!timestamp) return '--:--';
        return format(new Date(timestamp.seconds * 1000), 'HH:mm');
    };
    
    let segmentCounter = 0;

    return (
        <div className="space-y-2 pr-4">
             {run.stops.filter(s => s.status !== 'CANCELED').map(stop => {
                 const { icon: Icon, color } = getStatusInfo(stop.status);
                 const isCompletedStop = stop.status === 'COMPLETED';

                 const segmentId = stop.status !== 'PENDING' ? `segment-${segmentCounter}` : ``;
                 if (stop.status !== 'PENDING') segmentCounter++;
                 
                return (
                     <div 
                        key={stop.name}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-md transition-colors",
                           segmentId && "cursor-pointer hover:bg-muted",
                           highlightedSegmentId === segmentId && "bg-muted ring-2 ring-primary"
                        )}
                        onClick={() => onSegmentClick && segmentId && onSegmentClick(segmentId)}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 mt-1 ${color}`} />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{stop.name}</p>
                         <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                          {stop.arrivalTime && <span className='flex items-center gap-1'><Clock className="h-3 w-3 text-gray-400"/> {formatFirebaseTime(stop.arrivalTime)}</span>}
                          {stop.mileageAtStop !== null && <span className='flex items-center gap-1'><Milestone className="h-3 w-3 text-gray-400"/> {stop.mileageAtStop} km</span>}
                          {stop.collectedOccupiedCars !== null && <span className='flex items-center gap-1'><Car className="h-3 w-3 text-gray-400"/> {stop.collectedOccupiedCars}</span>}
                          {stop.collectedEmptyCars !== null && <span className='flex items-center gap-1'><Package className="h-3 w-3 text-gray-400"/> {stop.collectedEmptyCars}</span>}
                          {stop.occupancy !== null && <span className='flex items-center gap-1'><Warehouse className="h-3 w-3 text-gray-400"/> {stop.occupancy}%</span>}
                        </div>
                      </div>
                     </div>
                )
            })}
        </div>
    );
};
