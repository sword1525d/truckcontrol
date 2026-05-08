'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { VehicleDto, RunSummaryDto, RunDto, RunStopDto, GpsPointDto, RouteDto, TripDto, UserDto, RefuelDto, ChecklistDto, ManagerDto, CompanyDto, SectorDto } from '@/types/api';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Truck, User, Wrench, PlayCircle, Route, Timer, X, MapIcon, CheckCircle, Clock, Calendar as CalendarIcon, Fuel, ClipboardCheck, Download, Trash2, MapPin, Plus, ArrowLeft, ArrowRight, Edit, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceStrict, isToday, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';

// ---- Helpers ----
const VEHICLE_STATUS_LABELS: Record<string, string> = {
  'PARADO': 'Parado', 'EM_CORRIDA': 'Em Corrida', 'EM_MANUTENCAO': 'Em Manutenção', 'BLOQUEADO_CHECKLIST': 'Bloqueado',
};
const VEHICLE_STATUS_COLORS: Record<string, string> = {
  'PARADO': 'bg-green-100 text-green-800', 'EM_CORRIDA': 'bg-blue-100 text-blue-800',
  'EM_MANUTENCAO': 'bg-yellow-100 text-yellow-800', 'BLOQUEADO_CHECKLIST': 'bg-red-100 text-red-800',
};

const formatTime = (ts: string | null | undefined) => ts ? format(new Date(ts), 'HH:mm') : '--:--';
const formatDateTime = (ts: string | null | undefined) => ts ? format(new Date(ts), 'dd/MM/yy HH:mm') : '--:--';
const formatDate = (ts: string | null | undefined) => ts ? format(new Date(ts), 'dd/MM/yyyy') : '--:--';
const formatTimeDiff = (start: Date, end: Date) => {
  if (!start || !end) return 'N/A';
  return formatDistanceStrict(end, start, { locale: ptBR, unit: 'minute' });
};

// ====================================================================
// TAB: Acompanhamento
// ====================================================================
function AcompanhamentoTab({ activeTab }: { activeTab: string; isMilkrunAstec?: boolean }) {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [runs, setRuns] = useState<RunSummaryDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const profile = auth.profile;

  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => {
    if (!profile || activeTab !== 'acompanhamento') return;
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [profile, activeTab]);

  const loadData = useCallback(async () => {
    if (!companyId || !sectorId) return;
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const [v, r, u, rt] = await Promise.all([
        api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`),
        api.get<RunSummaryDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${todayStart}&dateTo=${todayEnd}`),
        api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`),
        api.get<RouteDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/routes?date=${todayStr}&date=fixed`),
      ]);
      setVehicles(v);
      setRuns(r);
      setUsers(u);
      setRoutes(rt);
    } catch (e: any) {
      if (e.message?.includes('404')) { /* no data yet */ }
    } finally {
      setIsLoading(false);
    }
  }, [companyId, sectorId]);

  const activeRunMap = new Map(runs.filter(r => r.status === 'IN_PROGRESS' || r.status === 0).map(r => [r.vehicleId, r.driverName]));
  const vehicleStatuses = vehicles.map(v => ({
    ...v,
    driverName: activeRunMap.get(v.id),
    effectiveStatus: activeRunMap.has(v.id) ? 'EM_CORRIDA' : v.status,
  }));

  const cancelRun = async (runId: string) => {
    try {
      await api.put(`/api/companies/${companyId}/sectors/${sectorId}/runs/${runId}/cancel`);
      toast({ title: 'Corrida cancelada' });
      loadData();
    } catch { toast({ variant: 'destructive', title: 'Erro ao cancelar corrida' }); }
  };

  const unlockVehicle = async (vehicleId: string) => {
    try {
      await api.put(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vehicleId}/status`, { status: 'PARADO' });
      toast({ title: 'Veículo desbloqueado' });
      loadData();
    } catch { toast({ variant: 'destructive', title: 'Erro ao desbloquear' }); }
  };

  const kpi = {
    total: vehicles.length,
    running: vehicleStatuses.filter(v => v.effectiveStatus === 'EM_CORRIDA').length,
    parked: vehicleStatuses.filter(v => v.effectiveStatus === 'PARADO').length,
    maintenance: vehicleStatuses.filter(v => v.effectiveStatus === 'EM_MANUTENCAO').length,
    blocked: vehicleStatuses.filter(v => v.effectiveStatus === 'BLOQUEADO_CHECKLIST').length,
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Frota Total', value: kpi.total, icon: Truck, color: 'text-slate-600' },
          { label: 'Em Corrida', value: kpi.running, icon: PlayCircle, color: 'text-blue-600' },
          { label: 'Parados', value: kpi.parked, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Manutenção', value: kpi.maintenance, icon: Wrench, color: 'text-yellow-600' },
          { label: 'Bloqueados', value: kpi.blocked, icon: AlertCircle, color: 'text-red-600' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <k.icon className={cn("h-8 w-8", k.color)} />
              <div><div className="text-2xl font-bold">{k.value}</div><div className="text-xs text-muted-foreground">{k.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vehicle Status Grid */}
      <Card>
        <CardHeader><CardTitle>Status dos Veículos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicleStatuses.map(v => (
              <Card key={v.id} className="border-l-4" style={{ borderLeftColor: v.effectiveStatus === 'EM_CORRIDA' ? '#3b82f6' : v.effectiveStatus === 'PARADO' ? '#22c55e' : v.effectiveStatus === 'EM_MANUTENCAO' ? '#eab308' : '#ef4444' }}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{v.id}</div>
                      <div className="text-sm text-muted-foreground">{v.model}</div>
                    </div>
                    <Badge className={VEHICLE_STATUS_COLORS[v.effectiveStatus] || ''}>
                      {VEHICLE_STATUS_LABELS[v.effectiveStatus] || v.effectiveStatus}
                    </Badge>
                  </div>
                  {v.driverName && <div className="text-xs mt-1 text-blue-600">Motorista: {v.driverName}</div>}
                  <div className="flex gap-2 mt-2">
                    {v.effectiveStatus === 'BLOQUEADO_CHECKLIST' && (
                      <Button size="sm" variant="outline" onClick={() => unlockVehicle(v.id)}>Desbloquear</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Today's Runs */}
      <Card>
        <CardHeader><CardTitle>Corridas de Hoje</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma corrida hoje.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Status</TableHead>
                  <TableHead>Início</TableHead><TableHead>Paradas</TableHead><TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.vehicleId}</TableCell>
                    <TableCell>{run.driverName}</TableCell>
                    <TableCell><Badge className={run.status === 'IN_PROGRESS' || run.status === 0 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>{run.status === 'IN_PROGRESS' || run.status === 0 ? 'Em Corrida' : run.status === 'COMPLETED' || run.status === 1 ? 'Concluído' : 'Cancelado'}</Badge></TableCell>
                    <TableCell>{formatTime(run.startTime)}</TableCell>
                    <TableCell>{run.completedStops}/{run.stopCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/map-view/${run.id}`)}><MapPin className="h-3 w-3" /></Button>
                        {(run.status === 'IN_PROGRESS' || run.status === 0) && (
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelRun(run.id)}><X className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// TAB: Historico
// ====================================================================
function HistoricoTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [date, setDate] = useState<DateRange>({ from: subDays(new Date(), 7), to: new Date() });
  const [selectedRun, setSelectedRun] = useState<RunDto | null>(null);
  const isSuperAdmin = profile?.matricula === '801231';

  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => {
    if (!profile || !date?.from || activeTab !== 'historico') return;
    loadHistory();
  }, [profile, date, activeTab]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const from = startOfDay(date.from!).toISOString();
      const to = endOfDay(date.to || date.from!).toISOString();
      const data = await api.get<any[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${from}&dateTo=${to}`);
      // Map summary to detailed runs
      const detailed = await Promise.all(data.map(async (r: any) => {
        try {
          return await api.get<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs/${r.id}`);
        } catch { return r; }
      }));
      setRuns(detailed);
    } catch { /* no data */ }
    finally { setIsLoading(false); }
  };

  const deleteRun = async (runId: string) => {
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/runs/${runId}`);
      toast({ title: 'Corrida removida' });
      loadHistory();
    } catch { toast({ variant: 'destructive', title: 'Erro ao remover' }); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? format(date.from, 'dd/MM/yy') : 'Início'} - {date?.to ? format(date.to, 'dd/MM/yy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={date} onSelect={d => d && setDate(d)} numberOfMonths={2} /></PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Data</TableHead>
                  <TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Km Inicial</TableHead><TableHead>Km Final</TableHead>
                  <TableHead>Status</TableHead><TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.vehicleId}</TableCell>
                    <TableCell>{run.driverName}</TableCell>
                    <TableCell>{formatDate(run.startTime)}</TableCell>
                    <TableCell>{formatTime(run.startTime)}</TableCell>
                    <TableCell>{formatTime(run.endTime)}</TableCell>
                    <TableCell>{run.startMileage?.toFixed(1)}</TableCell>
                    <TableCell>{run.endMileage?.toFixed(1) || '-'}</TableCell>
                    <TableCell><Badge className={run.status === 'COMPLETED' || run.status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{(run.status === 'COMPLETED' || run.status === 1) ? 'Concluído' : 'Cancelado'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelectedRun(run)}><MapPin className="h-3 w-3" /></Button>
                        {isSuperAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-red-600"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Remover corrida?</AlertDialogTitle></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteRun(run.id)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Run Details Dialog */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalhes da Corrida</DialogTitle></DialogHeader>
          {selectedRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Veículo:</span> {selectedRun.vehicleId}</div>
                <div><span className="font-medium">Motorista:</span> {selectedRun.driverName}</div>
                <div><span className="font-medium">Início:</span> {formatDateTime(selectedRun.startTime)}</div>
                <div><span className="font-medium">Fim:</span> {formatDateTime(selectedRun.endTime)}</div>
                <div><span className="font-medium">Km Inicial:</span> {selectedRun.startMileage?.toFixed(1)}</div>
                <div><span className="font-medium">Km Final:</span> {selectedRun.endMileage?.toFixed(1) || '-'}</div>
              </div>
              <Separator />
              <h4 className="font-medium">Paradas ({selectedRun.stops?.length || 0})</h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {(selectedRun.stops || []).map((stop, i) => (
                  <div key={i} className="border rounded p-2 text-sm">
                    <div className="font-medium">{stop.name}</div>
                    <div className="text-muted-foreground">
                      Chegada: {formatTime(stop.arrivalTime)} | Saída: {formatTime(stop.departureTime)}
                      {stop.collectedOccupiedCars != null && ` | Ocupados: ${stop.collectedOccupiedCars}`}
                      {stop.collectedEmptyCars != null && ` | Vazios: ${stop.collectedEmptyCars}`}
                      {stop.mileageAtStop != null && ` | Km: ${stop.mileageAtStop}`}
                    </div>
                    {stop.observation && <div className="text-xs italic mt-1">Obs: {stop.observation}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// TAB: Roteirizacao
// ====================================================================
function RoteirizacaoTab() {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRoute, setEditingRoute] = useState<RouteDto | null>(null);
  const [formVehicle, setFormVehicle] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formShift, setFormShift] = useState(1);
  const [formIsFixed, setFormIsFixed] = useState(false);

  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => { loadData(); }, [profile]);

  const loadData = async () => {
    if (!companyId || !sectorId) return;
    setIsLoading(true);
    try {
      const [r, v] = await Promise.all([
        api.get<RouteDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/routes`),
        api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`),
      ]);
      setRoutes(r);
      setVehicles(v);
    } catch { /* no data */ }
    finally { setIsLoading(false); }
  };

  const saveRoute = async () => {
    if (!formVehicle) return;
    try {
      if (editingRoute) {
        await api.put(`/api/companies/${companyId}/sectors/${sectorId}/routes/${editingRoute.id}`, {
          vehicleId: formVehicle, date: formDate, shift: formShift, isFixed: formIsFixed, trips: [],
        });
      } else {
        await api.post(`/api/companies/${companyId}/sectors/${sectorId}/routes`, {
          vehicleId: formVehicle, date: formDate, shift: formShift, isFixed: formIsFixed, trips: [],
        });
      }
      toast({ title: 'Rota salva' });
      setEditingRoute(null);
      setFormVehicle('');
      setFormIsFixed(false);
      loadData();
    } catch { toast({ variant: 'destructive', title: 'Erro ao salvar rota' }); }
  };

  const deleteRoute = async (routeId: string) => {
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/routes/${routeId}`);
      toast({ title: 'Rota removida' });
      loadData();
    } catch { toast({ variant: 'destructive', title: 'Erro ao remover' }); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Form */}
      <Card>
        <CardHeader><CardTitle>{editingRoute ? 'Editar Rota' : 'Nova Rota'}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label>Veículo</Label>
              <Select value={formVehicle} onValueChange={setFormVehicle}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Veículo" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={String(formShift)} onValueChange={v => setFormShift(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1º Turno</SelectItem>
                  <SelectItem value="2">2º Turno</SelectItem>
                  <SelectItem value="3">3º Turno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch checked={formIsFixed} onCheckedChange={setFormIsFixed} />
              <Label>Fixa</Label>
            </div>
            <Button onClick={saveRoute}>Salvar</Button>
            {editingRoute && <Button variant="outline" onClick={() => setEditingRoute(null)}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Routes List */}
      <Card>
        <CardHeader><CardTitle>Rotas Programadas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Veículo</TableHead><TableHead>Data</TableHead><TableHead>Turno</TableHead><TableHead>Fixa</TableHead><TableHead>Viagens</TableHead><TableHead>Ações</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {routes.map(route => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.vehicleId}</TableCell>
                  <TableCell>{route.date}</TableCell>
                  <TableCell>{route.shift}º</TableCell>
                  <TableCell>{route.isFixed ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>{route.trips?.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setEditingRoute(route); setFormVehicle(route.vehicleId); setFormDate(route.date); setFormShift(route.shift); setFormIsFixed(route.isFixed); }}><Edit className="h-3 w-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-red-600"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remover rota?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteRoute(route.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// TAB: Abastecimentos
// ====================================================================
function AbastecimentosTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const [refuels, setRefuels] = useState<RefuelDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [date, setDate] = useState<DateRange>({ from: subDays(new Date(), 30), to: new Date() });
  const isSuperAdmin = profile?.matricula === '801231';
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => {
    if (!profile || activeTab !== 'abastecimentos') return;
    loadRefuels();
  }, [profile, date, activeTab]);

  const loadRefuels = async () => {
    if (!date?.from) return;
    setIsLoading(true);
    try {
      const from = startOfDay(date.from).toISOString();
      const to = endOfDay(date.to || date.from).toISOString();
      const data = await api.get<RefuelDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/refuels?dateFrom=${from}&dateTo=${to}`);
      setRefuels(data);
    } catch { /* no data */ }
    finally { setIsLoading(false); }
  };

  const deleteRefuel = async (refuelId: string) => {
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/refuels/${refuelId}`);
      toast({ title: 'Abastecimento removido' });
      loadRefuels();
    } catch { toast({ variant: 'destructive', title: 'Erro ao remover' }); }
  };

  const totalLiters = refuels.reduce((s, r) => s + r.liters, 0);
  const totalAmount = refuels.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />Período</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={date} onSelect={d => d && setDate(d)} numberOfMonths={2} /></PopoverContent>
          </Popover>
          <div className="flex gap-4 ml-auto">
            <div><span className="text-muted-foreground text-sm">Total Litros: </span><span className="font-bold">{totalLiters.toFixed(1)}L</span></div>
            <div><span className="text-muted-foreground text-sm">Total: </span><span className="font-bold">R$ {totalAmount.toFixed(2)}</span></div>
          </div>
        </div>
      </CardContent></Card>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Litros</TableHead><TableHead>Valor</TableHead>{isSuperAdmin && <TableHead>Ações</TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {refuels.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateTime(r.timestamp)}</TableCell>
                    <TableCell className="font-medium">{r.vehicleId}</TableCell>
                    <TableCell>{r.driverName}</TableCell>
                    <TableCell>{r.liters.toFixed(1)} L</TableCell>
                    <TableCell>R$ {r.amount?.toFixed(2)}</TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-red-600"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Remover abastecimento?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteRefuel(r.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ====================================================================
// TAB: Checklists
// ====================================================================
function ChecklistsTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const [checklists, setChecklists] = useState<ChecklistDto[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistDto | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const isSuperAdmin = profile?.matricula === '801231';
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => {
    if (!profile || activeTab !== 'checklists') return;
    loadData();
  }, [profile, activeTab, selectedVehicle]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [v] = await Promise.all([
        api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`),
      ]);
      setVehicles(v);

      if (selectedVehicle) {
        const cl = await api.get<ChecklistDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle}/checklists`);
        setChecklists(cl);
      } else {
        // Fetch checklists for all vehicles
        const allCl: ChecklistDto[] = [];
        for (const vh of v.slice(0, 20)) {
          try {
            const cl = await api.get<ChecklistDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vh.id}/checklists`);
            allCl.push(...cl);
          } catch { /* skip */ }
        }
        allCl.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setChecklists(allCl.slice(0, 100));
      }
    } catch { /* no data */ }
    finally { setIsLoading(false); }
  };

  const deleteChecklist = async (checklistId: string, vehicleId: string) => {
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vehicleId}/checklists/${checklistId}`);
      toast({ title: 'Checklist removido' });
      loadData();
    } catch { toast({ variant: 'destructive', title: 'Erro ao remover' }); }
  };

  const blockVehicle = async (vehicleId: string) => {
    try {
      await api.put(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vehicleId}/status`, { status: 'BLOQUEADO_CHECKLIST' });
      toast({ title: 'Veículo bloqueado' });
    } catch { toast({ variant: 'destructive', title: 'Erro ao bloquear' }); }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="flex gap-4 items-center">
          <div>
            <Label>Veículo</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent></Card>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Itens</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {checklists.map(cl => {
                  const ncCount = cl.items?.filter(i => i.status === 'nao_conforme' || i.status === 1).length || 0;
                  return (
                    <TableRow key={cl.id}>
                      <TableCell>{formatDateTime(cl.timestamp)}</TableCell>
                      <TableCell className="font-medium">{cl.vehicleId}</TableCell>
                      <TableCell>{cl.driverName}</TableCell>
                      <TableCell>{cl.items?.length || 0}</TableCell>
                      <TableCell>
                        {ncCount > 0
                          ? <Badge className="bg-red-100 text-red-800">{ncCount} NC</Badge>
                          : <Badge className="bg-green-100 text-green-800">Conforme</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setSelectedChecklist(cl)}>Ver</Button>
                          {ncCount > 0 && <Button size="sm" variant="outline" className="text-red-600" onClick={() => blockVehicle(cl.vehicleId)}>Bloquear</Button>}
                          {isSuperAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-red-600"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Remover checklist?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteChecklist(cl.id, cl.vehicleId)}>Remover</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Checklist Detail Dialog */}
      <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Checklist - {selectedChecklist?.vehicleId}</DialogTitle><DialogDescription>{selectedChecklist && formatDateTime(selectedChecklist.timestamp)} - {selectedChecklist?.driverName}</DialogDescription></DialogHeader>
          {selectedChecklist && (
            <div className="space-y-3">
              {(selectedChecklist.items || []).map((item, i) => (
                <div key={i} className={cn("border rounded p-3", item.status === 'nao_conforme' || item.status === 1 ? 'border-red-300 bg-red-50' : item.status === 'na' || item.status === 2 ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50')}>
                  <div className="font-medium">{item.location} - {item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                  <div className="flex justify-between items-center mt-1">
                    <Badge className={item.status === 'nao_conforme' || item.status === 1 ? 'bg-red-100 text-red-800' : item.status === 'na' || item.status === 2 ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}>
                      {item.status === 'nao_conforme' || item.status === 1 ? 'Não Conforme' : item.status === 'na' || item.status === 2 ? 'N/A' : 'Conforme'}
                    </Badge>
                  </div>
                  {item.observation && <div className="text-xs italic mt-1">Obs: {item.observation}</div>}
                  {item.images && (() => { try { const imgs = JSON.parse(item.images); return imgs.length > 0 ? <div className="flex gap-2 mt-2">{imgs.map((img: string, j: number) => <img key={j} src={img} alt="" className="h-16 w-16 object-cover rounded" />)}</div> : null; } catch { return null; } })()}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// TAB: Analise
// ====================================================================
function AnaliseTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const profile = auth.profile;
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [date, setDate] = useState<DateRange>({ from: subDays(new Date(), 30), to: new Date() });
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => {
    if (!profile || !date?.from || activeTab !== 'analise') return;
    loadRuns();
  }, [profile, date, activeTab]);

  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const from = startOfDay(date.from!).toISOString();
      const to = endOfDay(date.to || date.from!).toISOString();
      const data = await api.get<RunSummaryDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${from}&dateTo=${to}`);
      // Load full run details
      const detailed: RunDto[] = [];
      for (const r of data) {
        try {
          const full = await api.get<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs/${r.id}`);
          detailed.push(full);
        } catch { detailed.push(r as any); }
      }
      setRuns(detailed);
    } catch { /* no data */ }
    finally { setIsLoading(false); }
  };

  const completedRuns = runs.filter(r => r.status === 'COMPLETED' || r.status === 1);
  const totalDistance = completedRuns.reduce((s, r) => s + ((r.endMileage || 0) - (r.startMileage || 0)), 0);
  const totalStops = completedRuns.reduce((s, r) => s + (r.stops?.length || 0), 0);
  const avgDuration = completedRuns.length > 0
    ? completedRuns.reduce((s, r) => {
        const d = r.endTime ? (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 1000 : 0;
        return s + d;
      }, 0) / completedRuns.length / 60
    : 0;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="flex gap-4 items-center">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />Período</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={date} onSelect={d => d && setDate(d)} numberOfMonths={2} /></PopoverContent>
          </Popover>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Corridas', value: completedRuns.length },
          { label: 'Paradas', value: totalStops },
          { label: 'Distância Total (km)', value: totalDistance.toFixed(1) },
          { label: 'Duração Média (min)', value: avgDuration.toFixed(0) },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Corridas por Veículo</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Corridas</TableHead><TableHead>Distância (km)</TableHead><TableHead>Paradas</TableHead></TableRow></TableHeader>
            <TableBody>
              {(() => {
                const byVehicle = new Map<string, RunDto[]>();
                completedRuns.forEach(r => { if (!byVehicle.has(r.vehicleId)) byVehicle.set(r.vehicleId, []); byVehicle.get(r.vehicleId)!.push(r); });
                return Array.from(byVehicle.entries()).map(([vid, vRuns]) => (
                  <TableRow key={vid}>
                    <TableCell className="font-medium">{vid}</TableCell>
                    <TableCell>{vRuns.length}</TableCell>
                    <TableCell>{vRuns.reduce((s, r) => s + ((r.endMileage || 0) - (r.startMileage || 0)), 0).toFixed(1)}</TableCell>
                    <TableCell>{vRuns.reduce((s, r) => s + (r.stops?.length || 0), 0)}</TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// TAB: Configuracoes
// ====================================================================
function ConfiguracoesTab() {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const [confirmText, setConfirmText] = useState('');
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';
  const isOP = profile?.isOP;

  const massDeleteRuns = async () => {
    if (confirmText !== 'DELETAR') return;
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/runs`);
      toast({ title: 'Todas as corridas foram removidas' });
      setConfirmText('');
    } catch { toast({ variant: 'destructive', title: 'Erro ao remover corridas' }); }
  };

  if (!isOP) return <p className="text-center py-8 text-muted-foreground">Acesso restrito a OP.</p>;

  return (
    <Card className="border-red-300">
      <CardHeader><CardTitle className="text-red-600">Zona Crítica</CardTitle><CardDescription>Remover TODAS as corridas do setor. Esta ação é irreversível.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Digite DELETAR para confirmar</Label>
          <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETAR" className="max-w-xs" />
        </div>
        <Button variant="destructive" disabled={confirmText !== 'DELETAR'} onClick={massDeleteRuns}>Remover Todas as Corridas</Button>
      </CardContent>
    </Card>
  );
}

// ====================================================================
// MAIN DASHBOARD PAGE
// ====================================================================
export default function DashboardPage() {
  const isMobile = useIsMobile();
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState('acompanhamento');
  const profile = auth.profile;
  const sectorName = profile?.sectorId || '';
  const isMilkrunAstec = sectorName.toUpperCase() === 'MILKRUN ASTEC';

  if (!profile) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground">Visão geral do sistema Frotacontrol.</p>
      </div>

      <Tabs defaultValue="acompanhamento" className="w-full" onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full", isMobile ? "grid-cols-2" : (isMilkrunAstec ? "grid-cols-5" : "grid-cols-7"))}>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          {!isMilkrunAstec && <TabsTrigger value="roteirizacao">Roteirização</TabsTrigger>}
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          {!isMilkrunAstec && <TabsTrigger value="configuracoes">Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="acompanhamento" className="mt-6">
          <AcompanhamentoTab activeTab={activeTab} isMilkrunAstec={isMilkrunAstec} />
        </TabsContent>
        {!isMilkrunAstec && (
          <TabsContent value="roteirizacao" className="mt-6"><RoteirizacaoTab /></TabsContent>
        )}
        <TabsContent value="analise" className="mt-6"><AnaliseTab activeTab={activeTab} /></TabsContent>
        <TabsContent value="historico" className="mt-6"><HistoricoTab activeTab={activeTab} /></TabsContent>
        <TabsContent value="abastecimentos" className="mt-6"><AbastecimentosTab activeTab={activeTab} /></TabsContent>
        <TabsContent value="checklists" className="mt-6"><ChecklistsTab activeTab={activeTab} /></TabsContent>
        {!isMilkrunAstec && (
          <TabsContent value="configuracoes" className="mt-6"><ConfiguracoesTab /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}
