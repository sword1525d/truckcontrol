'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SHIFT_NUM_TO_NAME, SHIFT_NAME_TO_NUM } from './types';
import type { VehicleDto, RouteDto, CreateRouteRequest, CreateTripRequest, CreateTripStopRequest } from '@/types/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2, Plus, Truck, Trash2, Edit3, Copy, CheckCircle2,
  CalendarIcon, ArrowUp, ArrowDown, LayoutDashboard,
} from 'lucide-react';

interface LocalStop {
  tempId: string;
  name: string;
  plannedArrival: string;
  plannedDeparture: string;
}

interface LocalTrip {
  tempId: string;
  name: string;
  stops: LocalStop[];
}

function genId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function RoteirizacaoTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<string>('1° NORMAL');

  // Form state
  const [newRouteVehicle, setNewRouteVehicle] = useState('');
  const [newTrips, setNewTrips] = useState<LocalTrip[]>([]);
  const [isFixedNewRoute, setIsFixedNewRoute] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  const availableShifts = useMemo(() =>
    ['1° NORMAL', '2° NORMAL', '1° ESPECIAL', '2° ESPECIAL'], []);

  const fetchVehicles = useCallback(async () => {
    if (!companyId || !sectorId) return;
    try {
      const list = await api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`);
      setVehicles(list);
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar veículos.' });
    }
  }, [companyId, sectorId, toast]);

  const fetchRoutes = useCallback(async () => {
    if (!companyId || !sectorId) return;
    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const routes = await api.get<RouteDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/routes?date=${dateStr}`);
      setRoutes(routes);
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar rotas.' });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, sectorId, selectedDate, toast]);

  useEffect(() => {
    fetchVehicles();
    fetchRoutes();
  }, [fetchVehicles, fetchRoutes]);

  // Auto-load existing route when vehicle+date+shift matches
  useEffect(() => {
    if (!newRouteVehicle || editingRouteId) return;
    const dateStr = isFixedNewRoute ? 'fixed' : format(selectedDate, 'yyyy-MM-dd');
    const existing = routes.find(r =>
      r.vehicleId === newRouteVehicle &&
      r.date === dateStr &&
      SHIFT_NUM_TO_NAME[r.shift] === selectedShift
    );
    if (existing) {
      setNewTrips(existing.trips.map(t => ({
        tempId: genId(),
        name: t.name,
        stops: t.stops.map(s => ({
          tempId: genId(),
          name: s.name,
          plannedArrival: s.plannedArrival,
          plannedDeparture: s.plannedDeparture,
        })),
      })));
      setIsFixedNewRoute(existing.isFixed);
      setEditingRouteId(existing.id);
      toast({ title: 'Editando plano existente', description: `Já existe uma programação para ${newRouteVehicle} neste turno.` });
    }
  }, [newRouteVehicle, selectedDate, selectedShift, isFixedNewRoute, routes, editingRouteId, toast]);

  const handleAddTrip = () => {
    setNewTrips([...newTrips, {
      tempId: genId(),
      name: `Viagem ${newTrips.length + 1}`,
      stops: [{ tempId: genId(), name: '', plannedArrival: '', plannedDeparture: '' }],
    }]);
  };

  const handleAddStop = (tripTempId: string) => {
    setNewTrips(newTrips.map(trip =>
      trip.tempId === tripTempId
        ? { ...trip, stops: [...trip.stops, { tempId: genId(), name: '', plannedArrival: '', plannedDeparture: '' }] }
        : trip
    ));
  };

  const handleRemoveStop = (tripTempId: string, stopIdx: number) => {
    setNewTrips(newTrips.map(trip =>
      trip.tempId === tripTempId
        ? { ...trip, stops: trip.stops.filter((_, i) => i !== stopIdx) }
        : trip
    ));
  };

  const handleRemoveTrip = (tripTempId: string) => {
    setNewTrips(newTrips.filter(t => t.tempId !== tripTempId));
  };

  const handleCloneTrip = (trip: LocalTrip) => {
    setNewTrips([...newTrips, {
      tempId: genId(),
      name: `${trip.name} (Cópia)`,
      stops: trip.stops.map(s => ({ ...s, tempId: genId() })),
    }]);
    toast({ title: 'Viagem Clonada', description: `'${trip.name} (Cópia)' foi adicionada.` });
  };

  const handleMoveTrip = (index: number, direction: 'up' | 'down') => {
    const next = [...newTrips];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setNewTrips(next);
  };

  const resetForm = () => {
    setNewRouteVehicle('');
    setNewTrips([]);
    setIsFixedNewRoute(false);
    setEditingRouteId(null);
  };

  const handleSaveRoute = async () => {
    if (!companyId || !sectorId || !newRouteVehicle) return;
    if (newTrips.length === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Adicione pelo menos uma viagem.' });
      return;
    }

    setIsSaving(true);
    try {
      const dateStr = isFixedNewRoute ? 'fixed' : format(selectedDate, 'yyyy-MM-dd');
      const shiftNum = SHIFT_NAME_TO_NUM[selectedShift] ?? 0;

      const trips: CreateTripRequest[] = newTrips.map((t, tIdx) => ({
        name: t.name,
        sortOrder: tIdx,
        stops: t.stops.map((s, sIdx): CreateTripStopRequest => ({
          name: s.name,
          plannedArrival: s.plannedArrival,
          plannedDeparture: s.plannedDeparture,
          sortOrder: sIdx,
        })),
      }));

      const body: CreateRouteRequest = {
        vehicleId: newRouteVehicle,
        date: dateStr,
        shift: shiftNum,
        isFixed: isFixedNewRoute,
        trips,
      };

      if (editingRouteId) {
        await api.put(`/api/companies/${companyId}/sectors/${sectorId}/routes/${editingRouteId}`, body);
        toast({ title: 'Sucesso', description: 'Rota atualizada!' });
      } else {
        await api.post(`/api/companies/${companyId}/sectors/${sectorId}/routes`, body);
        toast({ title: 'Sucesso', description: isFixedNewRoute ? 'Rota fixa salva!' : 'Rota salva!' });
      }
      resetForm();
      fetchRoutes();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao salvar rota.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRoute = (route: RouteDto) => {
    setNewRouteVehicle(route.vehicleId);
    setNewTrips(route.trips.map(t => ({
      tempId: genId(),
      name: t.name,
      stops: t.stops.map(s => ({
        tempId: genId(),
        name: s.name,
        plannedArrival: s.plannedArrival,
        plannedDeparture: s.plannedDeparture,
      })),
    })));
    setIsFixedNewRoute(route.isFixed);
    setSelectedShift(SHIFT_NUM_TO_NAME[route.shift] || '1° NORMAL');
    setEditingRouteId(route.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!companyId || !sectorId) return;
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/routes/${routeId}`);
      toast({ title: 'Sucesso', description: 'Rota excluída.' });
      setRoutes(prev => prev.filter(r => r.id !== routeId));
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir rota.' });
    }
  };

  const routesForSelectedDate = useMemo(() => {
    const shiftNum = SHIFT_NAME_TO_NUM[selectedShift];
    return routes.filter(r =>
      (r.date === format(selectedDate, 'yyyy-MM-dd') || r.date === 'fixed') &&
      (r.shift === shiftNum)
    );
  }, [routes, selectedDate, selectedShift]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-lg border">
        <div>
          <h2 className="text-2xl font-bold text-primary">Gestão de Rotas</h2>
          <p className="text-sm text-muted-foreground">Planejamento diário e fixo dos veículos.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <Input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
            className="border-none focus-visible:ring-0 p-0 h-8 font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <Card className="lg:col-span-2 shadow-sm border-t-4 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingRouteId ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingRouteId ? 'Editar Programação' : 'Nova Roteirização'}
            </CardTitle>
            <CardDescription>
              Programação para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Veículo</Label>
                <Select value={newRouteVehicle} onValueChange={setNewRouteVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.id} - {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className="flex items-center justify-between space-x-2 bg-primary/5 p-4 rounded-lg border shadow-sm hover:bg-primary/10 transition-colors cursor-pointer"
              onClick={() => setIsFixedNewRoute(!isFixedNewRoute)}
            >
              <div className="space-y-0.5">
                <Label className="text-base font-bold cursor-pointer">Programação Fixa (Diária)</Label>
                <p className="text-xs text-muted-foreground">Esta rota aparecerá todos os dias para o caminhão selecionado.</p>
              </div>
              <Switch
                checked={isFixedNewRoute}
                onCheckedChange={setIsFixedNewRoute}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <Label className="text-lg font-semibold">Viagens e Paradas</Label>
                <Button variant="outline" size="sm" onClick={handleAddTrip}>
                  <Plus className="w-4 h-4 mr-1" /> Add Viagem
                </Button>
              </div>

              {newTrips.map((trip, tIndex) => (
                <div key={trip.tempId} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Button variant="ghost" size="icon" className="h-4 w-4"
                          onClick={() => handleMoveTrip(tIndex, 'up')} disabled={tIndex === 0}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-4 w-4"
                          onClick={() => handleMoveTrip(tIndex, 'down')} disabled={tIndex === newTrips.length - 1}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <Input
                        value={trip.name}
                        onChange={(e) => {
                          const next = [...newTrips];
                          next[tIndex].name = e.target.value;
                          setNewTrips(next);
                        }}
                        className="max-w-[200px] font-bold"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleCloneTrip(trip)} title="Clonar Viagem">
                        <Copy className="w-4 h-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveTrip(trip.tempId)} title="Remover Viagem">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 pl-4 border-l-2 border-primary/20 bg-muted/10 p-4 rounded-r-lg">
                    {trip.stops.map((stop, sIdx) => (
                      <div key={stop.tempId} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b pb-3 last:border-0 border-primary/10">
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ponto de Parada</Label>
                          <Input
                            placeholder="Ex: PINTURA ABS"
                            value={stop.name}
                            onChange={(e) => {
                              const next = [...newTrips];
                              next[tIndex].stops[sIdx].name = e.target.value;
                              setNewTrips(next);
                            }}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Chegada</Label>
                          <Input
                            type="time"
                            value={stop.plannedArrival}
                            onChange={(e) => {
                              const next = [...newTrips];
                              next[tIndex].stops[sIdx].plannedArrival = e.target.value;
                              setNewTrips(next);
                            }}
                            className="h-8"
                          />
                        </div>
                        <div className="flex gap-1">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Saída</Label>
                            <Input
                              type="time"
                              value={stop.plannedDeparture}
                              onChange={(e) => {
                                const next = [...newTrips];
                                next[tIndex].stops[sIdx].plannedDeparture = e.target.value;
                                setNewTrips(next);
                              }}
                              className="h-8 w-full"
                            />
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleRemoveStop(trip.tempId, sIdx)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full border-dashed border-2 hover:bg-primary/5 py-1"
                      onClick={() => handleAddStop(trip.tempId)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Parada
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <Button className="flex-1 h-12 text-lg font-bold" onClick={handleSaveRoute}
                disabled={isSaving || !newRouteVehicle}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {editingRouteId ? 'Atualizar Programação' : 'Finalizar Roteirização'}
              </Button>
              {editingRouteId && (
                <Button variant="outline" className="h-12" onClick={resetForm}>Cancelar</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Routes List Column */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-primary tracking-tight">
            <LayoutDashboard className="w-5 h-5" /> Ativas no Turno
          </h2>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : routesForSelectedDate.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 border rounded-lg border-dashed bg-muted/20">
              Sem programações para {selectedShift}.
            </p>
          ) : (
            routesForSelectedDate.map(route => (
              <Card key={route.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
                <div className="bg-primary/5 p-3 flex justify-between items-center border-b">
                  <span className="font-extrabold flex items-center gap-2 text-sm uppercase">
                    <Truck className="w-4 h-4 text-primary" /> {route.vehicleId}
                    {route.isFixed && (
                      <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20">
                        DIÁRIA
                      </Badge>
                    )}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditRoute(route)}>
                      <Edit3 className="w-4 h-4 text-primary" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Rota?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja realmente excluir a rota de {route.vehicleId}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteRoute(route.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardContent className="p-4 space-y-4">
                  {route.trips.map((trip, idx) => (
                    <div key={trip.id || idx} className="space-y-1.5">
                      <p className="text-[11px] font-black text-primary/80 uppercase tracking-wider">{trip.name}</p>
                      <div className="space-y-1 border-l-2 border-primary/10 ml-1 pl-3">
                        {trip.stops.map((stop, sIdx) => (
                          <div key={stop.id || sIdx} className="text-[10px] flex justify-between group">
                            <span className="font-medium group-hover:text-primary transition-colors">{stop.name}</span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {stop.plannedArrival} - {stop.plannedDeparture}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
