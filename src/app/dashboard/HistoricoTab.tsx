'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { RunDto, RunSummaryDto, UserDto } from '@/types/api';
import type { AggregatedRun, LocationPoint, Segment } from './types';
import { SHIFT_NUM_TO_NAME, SEGMENT_COLORS } from './types';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Truck, User, Calendar as CalendarIcon, FileText, Trash2, Download, Route, Timer, Milestone, Clock, Car, Package, Warehouse, Hourglass, MapIcon, Maximize, EyeOff, X, CheckCircle, PlayCircle } from 'lucide-react';
import { format, formatDistanceStrict, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

const RealTimeMap = dynamic(() => import('./RealTimeMap'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

// --- Helpers for segment processing (ISO string compatible) ---

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

const processRunSegments = (run: AggregatedRun | RunDto | null, isAggregated: boolean = true): Segment[] => {
  if (!run || !run.locationHistory || run.locationHistory.length === 0) return [];

  const getTimestamp = (item: any) => new Date(item.timestamp).getTime();
  const sortedLocations = filterLocationOutliers([...run.locationHistory].sort((a, b) => getTimestamp(a) - getTimestamp(b)));

  const stopsToProcess = 'stops' in run ? run.stops.filter((s: any) => s.status === 'COMPLETED' || s.status === 'IN_PROGRESS') : [];
  const sortedStops = stopsToProcess.sort((a: any, b: any) =>
    (a.arrivalTime ? new Date(a.arrivalTime).getTime() : Infinity) - (b.arrivalTime ? new Date(b.arrivalTime).getTime() : Infinity));

  const segments: Segment[] = [];
  let lastDepartureTime: string = isAggregated && 'startTime' in run ? run.startTime : (sortedLocations[0]?.timestamp || new Date().toISOString());
  let lastMileage: number = 'startMileage' in run ? run.startMileage : 0;

  for (let i = 0; i < sortedStops.length; i++) {
    const stop: any = sortedStops[i];
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
      const startTime = 'startTime' in run ? run.startTime : sortedLocations[0]?.timestamp;
      if (startTime) {
        const firstPoint = sortedLocations.find(l => new Date(l.timestamp).getTime() >= new Date(startTime).getTime());
        if (firstPoint) segmentPath.unshift([firstPoint.longitude, firstPoint.latitude]);
      }
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
  return segments;
};

// --- Sub-components ---

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');

const HistoryTableRow = ({ run, users, onViewDetails, isSuperAdmin, onDelete, isDeleting }: {
  run: RunDto;
  users: Map<string, UserDto>;
  onViewDetails: () => void;
  isSuperAdmin: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) => {
  const driver = users.get(run.driverId);
  const distance = run.endMileage && run.startMileage ? run.endMileage - run.startMileage : 0;
  const destination = run.stops.slice(-1)[0]?.name || 'N/A';

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={onViewDetails}>
      <TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />{run.vehicleId}</div></TableCell>
      <TableCell>
        <div className="font-medium flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={driver?.photoURL} alt={run.driverName} />
            <AvatarFallback className="text-xs">{getInitials(run.driverName)}</AvatarFallback>
          </Avatar>
          {run.driverName}
        </div>
      </TableCell>
      <TableCell><Badge variant="secondary" className="text-[10px]">{driver ? SHIFT_NUM_TO_NAME[driver.shift] || 'N/A' : 'N/A'}</Badge></TableCell>
      <TableCell><div className="text-xs max-w-[200px] truncate">{destination}</div></TableCell>
      <TableCell><div className="flex items-center gap-1 font-medium">{distance > 0 ? `${distance.toFixed(1)} km` : '--'}</div></TableCell>
      <TableCell><div className="text-xs">{format(new Date(run.startTime), 'dd/MM/yy HH:mm')}</div></TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onViewDetails}><FileText className="h-4 w-4" /></Button>
          {isSuperAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isDeleting}>{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Deseja realmente excluir este registro de corrida? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

const RunDetailsDialog = ({ run, isOpen, onClose, sectorId }: { run: AggregatedRun | null; isOpen: boolean; onClose: () => void; sectorId: string }) => {
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [mapRun, setMapRun] = useState<AggregatedRun | RunDto | null>(null);
  const [isAggregatedMap, setIsAggregatedMap] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) { setMapRun(run); setIsAggregatedMap(true); }
    if (!isOpen) { setHighlightedSegmentId(null); }
  }, [isOpen, run]);

  const mapSegments = useMemo(() => processRunSegments(mapRun, isAggregatedMap), [mapRun, isAggregatedMap]);
  const displayedSegments = useMemo(() => {
    if (!highlightedSegmentId) return mapSegments.map(s => ({ ...s, opacity: 0.9 }));
    return mapSegments.map(s => ({ ...s, opacity: s.id === highlightedSegmentId ? 1.0 : 0.3 }));
  }, [mapSegments, highlightedSegmentId]);

  if (!run) return null;

  const handleViewFullscreen = () => { if (run) router.push(`/dashboard/map-view/${run.key}`); };
  const fullLocationHistory = mapRun?.locationHistory?.map((p: any) => ({ latitude: p.latitude, longitude: p.longitude })) || [];

  const formatTime = (ts: string | null) => ts ? format(new Date(ts), 'HH:mm') : '--:--';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] lg:max-w-7xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 flex-row items-start justify-between">
          <div>
            <DialogTitle>Detalhes da Rota - {run.driverName} ({run.vehicleId})</DialogTitle>
            <DialogDescription>Visualização detalhada da rota e paradas da corrida de {run.date} ({run.shift}).</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleViewFullscreen}><Maximize className="h-5 w-5" /><span className="sr-only">Tela Cheia</span></Button>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 pt-0 min-h-0">
          <div className="lg:col-span-2 bg-muted rounded-md min-h-[300px] lg:min-h-0">
            <RealTimeMap segments={displayedSegments} fullLocationHistory={fullLocationHistory} vehicleId={run.vehicleId} />
          </div>
          <div className="lg:col-span-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Detalhes da Rota</h4>
              <div className="flex items-center gap-2">
                {highlightedSegmentId && (
                  <Button variant="ghost" size="sm" onClick={() => setHighlightedSegmentId(null)}><EyeOff className="mr-2 h-4 w-4" /> Limpar</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setMapRun(run); setIsAggregatedMap(true); setHighlightedSegmentId(null); }}>
                  <Route className="mr-2 h-4 w-4" /> Rota Completa
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 -mr-6 pr-6">
              <div className="space-y-4 p-1">
                {run.originalRuns.map((originalRun: any, runIndex: number) => {
                  const previousRun = runIndex > 0 ? run.originalRuns[runIndex - 1] : null;
                  let idleTime: string | null = null;
                  if (previousRun && previousRun.endTime) {
                    idleTime = formatDistanceStrict(new Date(previousRun.endTime), new Date(originalRun.startTime), { locale: ptBR, unit: 'minute' });
                  }
                  return (
                    <div key={originalRun.id}>
                      {idleTime && parseFloat(idleTime) > 0 && (
                        <div className="flex items-center gap-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 my-2">
                          <Hourglass className="h-6 w-6 flex-shrink-0 text-amber-500" />
                          <div className="flex-1"><p className="font-medium">Tempo Parado</p><p className="text-xs text-muted-foreground">O veículo ficou parado entre as corridas.</p></div>
                          <div className="text-right text-sm text-muted-foreground"><p><strong>{idleTime}</strong></p></div>
                        </div>
                      )}
                      {originalRun.stops?.filter((s: any) => s.status === 'COMPLETED').map((stop: any, stopIndex: number) => {
                        const globalStopIndex = run.stops.findIndex((s: any) => s.arrivalTime === stop.arrivalTime);
                        const previousStop = globalStopIndex > 0 ? run.stops[globalStopIndex - 1] : null;
                        const segmentStartTime = previousStop?.departureTime ?? originalRun.startTime;
                        const startMileage = previousStop?.mileageAtStop ?? run.startMileage;
                        const segmentDistance = (stop.mileageAtStop && startMileage) ? stop.mileageAtStop - startMileage : null;
                        const segmentId = `segment-${globalStopIndex}`;
                        return (
                          <Card
                            key={`${originalRun.id}-${stopIndex}`}
                            className={cn("bg-muted/50 mb-2 cursor-pointer transition-all hover:bg-muted", highlightedSegmentId === segmentId && "ring-2 ring-primary bg-muted")}
                            onClick={() => { setMapRun(run); setIsAggregatedMap(true); setHighlightedSegmentId(segmentId); }}
                          >
                            <CardHeader className="pb-3 flex-row items-center justify-between">
                              <CardTitle className="text-base flex items-center gap-2"><Milestone className="h-5 w-5 text-muted-foreground" />{stop.name}</CardTitle>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setMapRun(originalRun); setIsAggregatedMap(false); setHighlightedSegmentId(null); }}>
                                <MapIcon className="h-4 w-4" />
                              </Button>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" /><span>{formatTime(segmentStartTime)} - {formatTime(stop.arrivalTime)}</span></div>
                                <div className="flex items-center gap-1"><Route className="h-3 w-3 text-muted-foreground" /><span>{segmentDistance !== null && segmentDistance > 0 ? `${segmentDistance.toFixed(1)} km` : 'N/A'}</span></div>
                                <div className="flex items-center gap-1"><Car className="h-3 w-3 text-muted-foreground" /><span>Ocup: {stop.collectedOccupiedCars ?? 'N/A'}</span></div>
                                <div className="flex items-center gap-1"><Package className="h-3 w-3 text-muted-foreground" /><span>Vaz: {stop.collectedEmptyCars ?? 'N/A'}</span></div>
                                <div className="flex items-center gap-1 col-span-2"><Warehouse className="h-3 w-3 text-muted-foreground" /><span>Lotação: {stop.occupancy ?? 'N/A'}%</span></div>
                                {stop.observation && <div className="col-span-full border-t mt-2 pt-2"><p className="text-xs text-muted-foreground"><strong>Obs:</strong> {stop.observation}</p></div>}
                              </div>
                            </CardContent>
                          </Card>
                        );
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
  );
};

// --- Main Component ---

export default function HistoricoTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';
  const isSuperAdmin = profile?.matricula === '801231';

  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
  const [selectedRunForDialog, setSelectedRunForDialog] = useState<AggregatedRun | null>(null);

  const [users, setUsers] = useState<Map<string, UserDto>>(new Map());
  const [allRuns, setAllRuns] = useState<RunDto[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [selectedShift, setSelectedShift] = useState<string>('1° NORMAL');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !companyId || !sectorId || !date?.from || activeTab !== 'historico') return;

    const fetchData = async () => {
      setIsLoading(true);
      setPage(1);
      try {
        const usersMap = new Map<string, UserDto>();

        const sectorUsers = await api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`);
        sectorUsers.forEach(u => usersMap.set(u.id, u));

        const from = startOfDay(date.from!).toISOString();
        const to = endOfDay(date.to || date.from!).toISOString();

        const summaries = await api.get<RunSummaryDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${from}&dateTo=${to}`);
        const completedSummaries = summaries.filter(s => s.status === 'COMPLETED');

        const details = await Promise.all(completedSummaries.map(s =>
          api.get<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs/${s.id}`).catch(() => null)
        ));

        const runs = (details.filter(Boolean) as RunDto[]).sort((a, b) =>
          (new Date(b.endTime || 0).getTime()) - (new Date(a.endTime || 0).getTime())
        );

        setUsers(usersMap);
        setAllRuns(runs);
      } catch (error) {
        console.error("Error fetching history data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile, companyId, sectorId, date, activeTab]);

  const { filteredRuns, allFilteredRuns, vehicleList, driverList, hasMore, totalFiltered } = useMemo(() => {
    const vehicles = new Set<string>();
    allRuns.forEach(run => vehicles.add(run.vehicleId));

    const drivers = new Map<string, UserDto>();
    allRuns.forEach(run => {
      if (!drivers.has(run.driverId)) {
        const driverInfo = users.get(run.driverId);
        if (driverInfo) drivers.set(run.driverId, driverInfo);
      }
    });

    const finalFiltered = allRuns.filter(run => {
      const driver = users.get(run.driverId);
      const driverShiftName = driver ? SHIFT_NUM_TO_NAME[driver.shift] : '';
      if (selectedShift !== 'TODOS' && driverShiftName !== selectedShift) return false;
      if (selectedVehicle !== 'all' && run.vehicleId !== selectedVehicle) return false;
      if (selectedDriver !== 'all' && run.driverId !== selectedDriver) return false;
      return true;
    });

    const paginated = finalFiltered.slice(0, page * pageSize);
    return {
      filteredRuns: paginated,
      allFilteredRuns: finalFiltered,
      totalFiltered: finalFiltered.length,
      hasMore: finalFiltered.length > page * pageSize,
      vehicleList: Array.from(vehicles).sort(),
      driverList: Array.from(drivers.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [allRuns, selectedShift, selectedVehicle, selectedDriver, users, page]);

  const aggregatedRunsMap = useMemo(() => {
    const groupedRuns = new Map<string, RunDto[]>();
    filteredRuns.forEach(run => {
      const driver = users.get(run.driverId);
      const runDate = format(new Date(run.startTime), 'yyyy-MM-dd');
      const key = `${run.vehicleId}-${driver ? SHIFT_NUM_TO_NAME[driver.shift] || 'sem-turno' : 'sem-turno'}-${runDate}`;
      if (!groupedRuns.has(key)) groupedRuns.set(key, []);
      groupedRuns.get(key)!.push(run);
    });

    const aggregatedMap = new Map<string, AggregatedRun>();
    groupedRuns.forEach((runs, key) => {
      runs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      const firstRun = runs[0];
      const lastRun = runs[runs.length - 1];
      const driver = users.get(firstRun.driverId);
      const allStops = runs.flatMap(r => r.stops).filter(s => s.status === 'COMPLETED').sort((a, b) =>
        (a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0) - (b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0));
      const allLocations = runs.flatMap(r => r.locationHistory || []).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const totalDistance = runs.reduce((acc, run) => acc + ((run.endMileage ?? 0) - run.startMileage > 0 ? (run.endMileage ?? 0) - run.startMileage : 0), 0);
      const totalDuration = lastRun.endTime ? (new Date(lastRun.endTime).getTime() - new Date(firstRun.startTime).getTime()) / 1000 : 0;

      const aggregated: AggregatedRun = {
        key, driverId: firstRun.driverId, driverName: firstRun.driverName,
        vehicleId: firstRun.vehicleId, shift: driver ? SHIFT_NUM_TO_NAME[driver.shift] || 'N/A' : 'N/A',
        date: format(new Date(firstRun.startTime), 'dd/MM/yyyy'),
        startTime: firstRun.startTime, endTime: lastRun.endTime ?? null,
        totalDistance, totalDuration, stops: allStops as any,
        locationHistory: allLocations as LocationPoint[],
        originalRuns: runs as any, startMileage: firstRun.startMileage,
        status: 'COMPLETED',
      };
      aggregatedMap.set(key, aggregated);
    });
    return aggregatedMap;
  }, [filteredRuns, users]);

  const handleViewDetails = useCallback((run: RunDto) => {
    const driver = users.get(run.driverId);
    const runDate = format(new Date(run.startTime), 'yyyy-MM-dd');
    const key = `${run.vehicleId}-${driver ? SHIFT_NUM_TO_NAME[driver.shift] || 'sem-turno' : 'sem-turno'}-${runDate}`;
    const aggregated = aggregatedRunsMap.get(key);
    if (aggregated) setSelectedRunForDialog(aggregated);
  }, [users, aggregatedRunsMap]);

  const handleDelete = useCallback(async (runToDelete: RunDto) => {
    if (!isSuperAdmin || deletingRunId) return;
    setDeletingRunId(runToDelete.id);
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/runs/${runToDelete.id}`);
      toast({ title: 'Sucesso', description: 'A corrida foi deletada.' });
      setAllRuns(prev => prev.filter(r => r.id !== runToDelete.id));
    } catch (error) {
      console.error("Error deleting run:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar a corrida.' });
    } finally {
      setDeletingRunId(null);
    }
  }, [companyId, sectorId, isSuperAdmin, deletingRunId, toast]);

  const handleExport = useCallback(() => {
    if (!allFilteredRuns.length) {
      toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
      return;
    }
    const runsByVehicle = allFilteredRuns.reduce((acc, run) => {
      if (!acc[run.vehicleId]) acc[run.vehicleId] = [];
      acc[run.vehicleId].push(run);
      return acc;
    }, {} as Record<string, RunDto[]>);

    const workbook = XLSX.utils.book_new();
    for (const vehicleId in runsByVehicle) {
      const vehicleRuns = runsByVehicle[vehicleId].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      const dataToExport = vehicleRuns.map((run) => {
        const driver = users.get(run.driverId);
        const distance = run.endMileage ? run.endMileage - run.startMileage : 0;
        const durationMs = run.endTime ? new Date(run.endTime).getTime() - new Date(run.startTime).getTime() : 0;
        const totalDuration = durationMs > 0 ? formatDistanceStrict(0, durationMs, { locale: ptBR }) : 'N/A';
        const totalStopTimeMs = run.stops.reduce((acc, stop) => {
          if (!stop.arrivalTime || !stop.departureTime) return acc;
          const dt = new Date(stop.departureTime).getTime() - new Date(stop.arrivalTime).getTime();
          return acc + (dt > 0 ? dt : 0);
        }, 0);
        const stopTime = totalStopTimeMs > 0 ? formatDistanceStrict(0, totalStopTimeMs, { locale: ptBR, unit: 'minute' }) : '0 min';
        const observations = run.stops.map(s => s.observation).filter(Boolean).join('; ');
        const occupancies = run.stops.map(s => s.occupancy !== null ? `${s.occupancy}%` : 'N/A').join(', ');

        return {
          'Data': format(new Date(run.startTime), 'dd/MM/yyyy'),
          'Horário Inicial': format(new Date(run.startTime), 'HH:mm'),
          'Horário Final': run.endTime ? format(new Date(run.endTime), 'HH:mm') : 'N/A',
          'Duração Total': totalDuration,
          'Tempo Parado (na corrida)': stopTime,
          'Setor': sectorId,
          'Veículo': run.vehicleId,
          'Motorista': run.driverName,
          'Turno': driver ? SHIFT_NUM_TO_NAME[driver.shift] || 'N/A' : 'N/A',
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
        const objectMaxLength = Object.keys(dataToExport[0]).map(key => ({
          wch: Math.max(...dataToExport.map(obj => (obj[key as keyof typeof obj] ?? '').toString().length), key.length)
        }));
        worksheet['!cols'] = objectMaxLength;
        XLSX.utils.book_append_sheet(workbook, worksheet, vehicleId);
      }
    }
    XLSX.writeFile(workbook, `Historico_Frotacontrol_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }, [allFilteredRuns, users, sectorId, toast]);

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
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: ptBR })} - {format(date.to, "LLL dd, y", { locale: ptBR })}</>) : (format(date.from, "LLL dd, y", { locale: ptBR }))) : (<span>Selecione uma data</span>)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>

          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar por Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os Turnos</SelectItem>
              {Object.values(SHIFT_NUM_TO_NAME).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar por veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><Truck className="h-4 w-4 inline-block mr-2" />Todos os Veículos</SelectItem>
              {vehicleList.map(v => <SelectItem key={v} value={v}><Truck className="h-4 w-4 inline-block mr-2" />{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Filtrar por motorista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><User className="h-4 w-4 inline-block mr-2" />Todos os Motoristas</SelectItem>
              {driverList.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="py-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
              <div>
                <CardTitle>Histórico de Corridas</CardTitle>
                <CardDescription>Lista de corridas concluídas com os filtros selecionados.</CardDescription>
              </div>
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
                      isDeleting={deletingRunId === run.id}
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

      <RunDetailsDialog run={selectedRunForDialog} isOpen={selectedRunForDialog !== null} onClose={() => setSelectedRunForDialog(null)} sectorId={sectorId} />
    </div>
  );
}
