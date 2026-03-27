
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Calendar, 
  Truck, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Edit3, 
  Eye, 
  LayoutDashboard, 
  Settings2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from "@/components/ui/progress";

type Stop = {
  name: string;
  plannedArrival: string;
  plannedDeparture: string;
};

type Trip = {
  id: string;
  name: string;
  stops: Stop[];
};

type Route = {
  id: string;
  vehicleId: string;
  trips: Trip[];
  date: string; // ISO string YYYY-MM-DD or 'fixed'
  shift: string; // 'Turno 1', 'Turno 2', 'Turno 3'
  isFixed?: boolean;
};

export default function RoutingPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [vehicles, setVehicles] = useState<{id: string, model: string}[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<string>('Turno 1');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sectorName = typeof window !== 'undefined' ? localStorage.getItem('sectorName') : '';
  const isAuthorized = sectorName?.toUpperCase().includes('MILKRUN') && sectorName?.toUpperCase() !== 'MILKRUN ASTEC';

  // Form State
  const [newRouteVehicle, setNewRouteVehicle] = useState('');
  const [newTrips, setNewTrips] = useState<Trip[]>([]);
  const [isFixedNewRoute, setIsFixedNewRoute] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

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
      
      const qRange = query(routesCol, where('date', '>=', start), where('date', '<=', end));
      const qFixed = query(routesCol, where('date', '==', 'fixed'));
      
      const [snapRange, snapFixed] = await Promise.all([getDocs(qRange), getDocs(qFixed)]);
      
      const listRange = snapRange.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      const listFixed = snapFixed.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      setRoutes([...listRange, ...listFixed]);
    } catch (error) {
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
    const newTrip: Trip = {
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

  const handleUpdateStop = (tripId: string, stopIndex: number, field: keyof Stop, value: string) => {
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
      const dateStr = isFixedNewRoute ? 'fixed' : format(selectedDate, 'yyyy-MM-dd');
      const shiftSuffix = `_${selectedShift.replace(' ', '')}`;
      const routeId = isFixedNewRoute ? `fixed_${newRouteVehicle}${shiftSuffix}` : `${dateStr}_${newRouteVehicle}${shiftSuffix}`;
      const routeRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/routes`, routeId);
      
      await setDoc(routeRef, {
        vehicleId: newRouteVehicle,
        date: dateStr,
        shift: selectedShift,
        isFixed: isFixedNewRoute,
        trips: newTrips
      });

      toast({ title: 'Sucesso', description: isFixedNewRoute ? 'Rota fixa salva!' : 'Rota salva com sucesso!' });
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
    setIsFixedNewRoute(false);
    setEditingRouteId(null);
  };

  const handleEditRoute = (route: Route) => {
    setNewRouteVehicle(route.vehicleId);
    setNewTrips(route.trips);
    setIsFixedNewRoute(!!route.isFixed);
    setSelectedShift(route.shift || 'Turno 1');
    setEditingRouteId(route.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRoute = async (routeId: string) => {
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');
    if (!firestore || !companyId || !sectorId) return;

    if (!confirm('Deseja realmente excluir esta rota?')) return;

    try {
      await deleteDoc(doc(firestore, `companies/${companyId}/sectors/${sectorId}/routes`, routeId));
      toast({ title: 'Sucesso', description: 'Rota excluída.' });
      fetchRoutes();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir rota.' });
    }
  };

  const routesForSelectedDate = routes.filter(r => 
    (r.date === format(selectedDate, 'yyyy-MM-dd') || r.date === 'fixed') && 
    (r.shift === selectedShift || (!r.shift && selectedShift === 'Turno 1'))
  );

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Acesso não autorizado</h1>
        <p className="text-muted-foreground text-center max-w-sm">O seu setor atual ({sectorName}) não possui acesso ao módulo de roteirização.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Roteirização</h1>
          <p className="text-muted-foreground">Defina as rotas e paradas dos motoristas.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
          <Calendar className="w-5 h-5 text-primary" />
          <Input 
            type="date" 
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
            className="border-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Criação/Edição */}
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingRouteId ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingRouteId ? 'Editar Programação' : 'Nova Roteirização'}
            </CardTitle>
            <CardDescription>
              Programação para o dia {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
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
                    <SelectValue placeholder="Selecione o Turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Turno 1">Turno 1</SelectItem>
                    <SelectItem value="Turno 2">Turno 2</SelectItem>
                    <SelectItem value="Turno 3">Turno 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between space-x-2 bg-primary/5 p-4 rounded-xl border-2 border-primary/20 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="fixed-route-standalone" className="text-base font-bold cursor-pointer">
                  Programação Fixa (Diária)
                </Label>
                <p className="text-xs text-muted-foreground">Esta rota aparecerá todos os dias para o caminhão selecionado.</p>
              </div>
              <Switch 
                id="fixed-route-standalone" 
                checked={isFixedNewRoute}
                onCheckedChange={setIsFixedNewRoute}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-lg font-semibold">Viagens e Paradas</Label>
                <Button variant="outline" size="sm" onClick={handleAddTrip}>
                  <Plus className="w-4 h-4 mr-1" /> Add Viagem
                </Button>
              </div>

              {newTrips.map((trip, tIndex) => (
                <div key={trip.id} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <Input 
                      value={trip.name} 
                      onChange={(e) => {
                        const next = [...newTrips];
                        next[tIndex].name = e.target.value;
                        setNewTrips(next);
                      }}
                      className="max-w-[200px] font-bold"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveTrip(trip.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {trip.stops.map((stop, sIndex) => (
                      <div key={sIndex} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b pb-3 last:border-0">
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Ponto de Parada</Label>
                          <Input 
                            placeholder="Ex: PINTURA ABS" 
                            value={stop.name}
                            onChange={(e) => handleUpdateStop(trip.id, sIndex, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ch. Prevista</Label>
                          <Input 
                            type="time" 
                            value={stop.plannedArrival}
                            onChange={(e) => handleUpdateStop(trip.id, sIndex, 'plannedArrival', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-1">
                           <div className="flex-1 space-y-1">
                            <Label className="text-xs">Sa. Prevista</Label>
                            <Input 
                              type="time" 
                              value={stop.plannedDeparture}
                              onChange={(e) => handleUpdateStop(trip.id, sIndex, 'plannedDeparture', e.target.value)}
                              className="w-full"
                            />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveStop(trip.id, sIndex)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full border-dashed border-2" onClick={() => handleAddStop(trip.id)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Parada
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button className="flex-1 h-12 text-lg" onClick={handleSaveRoute} disabled={isSaving || !newRouteVehicle}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingRouteId ? 'Atualizar Roteirização' : 'Salvar Roteirização'}
              </Button>
              {editingRouteId && (
                <Button variant="outline" className="h-12" onClick={resetForm}>Cancelar</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Rotas Salvas */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5" /> Programadas
          </h2>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : routesForSelectedDate.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 border rounded-lg border-dashed">
              Nenhuma rota programada para este turno.
            </p>
          ) : (
            routesForSelectedDate.map(route => (
              <Card key={route.id} className="overflow-hidden">
                <div className="bg-primary/5 p-3 flex justify-between items-center border-b">
                  <span className="font-bold flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4" /> {route.vehicleId}
                    {route.isFixed && <Badge variant="secondary" className="text-[10px] h-4">DIÁRIA</Badge>}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditRoute(route)}>
                      <Edit3 className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRoute(route.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4 space-y-4">
                  {route.trips.map((trip, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-xs font-bold text-primary">{trip.name}</p>
                      <div className="space-y-1 border-l-2 border-primary/20 ml-2 pl-3">
                        {trip.stops.map((stop, sIdx) => (
                          <div key={sIdx} className="text-[10px] flex justify-between">
                            <span>{stop.name}</span>
                            <span className="text-muted-foreground">{stop.plannedArrival} - {stop.plannedDeparture}</span>
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
