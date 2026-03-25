
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Play, Clock, MapPin, Truck, Milestone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { startOfDay, endOfDay, format } from 'date-fns';

type UserData = {
  id: string;
  name: string;
  companyId: string;
  sectorId: string;
};

type Vehicle = {
  id: string;
  model: string;
  lastMileage?: number;
};

type RouteStop = {
  name: string;
  plannedArrival: string;
  plannedDeparture: string;
};

type RouteTrip = {
  id: string;
  name: string;
  stops: RouteStop[];
};

type Route = {
  id: string;
  vehicleId: string;
  trips: RouteTrip[];
  date: string;
};

type StopPoint = string;

const PREDEFINED_STOP_POINTS: StopPoint[] = [
  "PINTURA ABS",
  "DIVISÃO PEÇAS",
  "ARO",
  "PINT ALUMÍNIO",
  "LINHA FUN",
  "USINAGEM",
  "MOCOM 2",
  "POLIMENTO",
  "ESTOQUE F",
  "PINTURA SPC",
  "FUNDIÇÃO",
  "INJEÇÃO PLÁSTICA",
  "MOCOM 4",
  "MONT RODA",
  "SINTERIZAÇÃO",
  "LINHA 2",
  "JUTAI",
  "PINTURA PO",
  "PINT TANQUE",
  "PINT ALTA TEMP",
  "SOLDA TANQUE",
  "PINTURA FAIXA",
  "CX DE ASSESORIO",
  "HDA 1",
  "MOCOM MOTOR",
  "PINT ESCAPAMENTO",
  "LINHA 4",
  "GALVANOPLASTIA",
  "PRENSA 1",
  "MOCOM 1",
  "HDA 2",
  "MOCOM 5",
  "POWER TRAIN",
  "MOCOM ABS",
  "NACIONAL",
  "IMPORTADO",
  "SOLDA GARFO",
  "DEPOSITO F",
  "FAB ASSENTO 2",
  "SOLDA COMPONENTE",
  "DEPOSITO D",
  "MOTOR",
  "HCA",
  "FAB ASSENTO",
  "SOLDA ESCAPAMENTO",
  "MOCOM 3",
  "SOLDA CHASSI",
  "FAB TUBO",
  "LM ATV",
  "FAIXA ABS",
  "FILTRO",
  "KABEL",
  "ESTAMPARIA",
  "MONT LINHA FAN",
  "PINTURA ABS 2",
  "MOCOM MOTOR 2",
  "MANUTENÇÃO",
  "PRENSA 2",
  "CENTRAL DE RESÍDUOS",
  "POSTO DE GASOLINA",
  "REFEITÓRIO 1",
  "REFEITÓRIO 2",
  "REFEITÓRIO 3",
  "REFEITÓRIO 4",
  "REFEITÓRIO 5"
].sort((a, b) => a.localeCompare(b));

export default function TruckRunPage() {
  const router = useRouter();
  const { firestore, user: authUser } = useFirebase();
  const { toast } = useToast();

  const [user, setUser] = useState<UserData | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [milkrunRoutes, setMilkrunRoutes] = useState<Route[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [mileage, setMileage] = useState('');
  const [stopPoint, setStopPoint] = useState<StopPoint>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stopFilter, setStopFilter] = useState('');
  const [recentStops, setRecentStops] = useState<string[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');

    if (storedUser && companyId && sectorId && authUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser({ ...parsedUser, id: authUser.uid, companyId, sectorId });
      
      const saved = localStorage.getItem(`recent_stops_${parsedUser.id}`);
      if (saved) setRecentStops(JSON.parse(saved));
    } else if (!authUser && !isLoading) { // only redirect if auth is settled
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Sessão inválida. Faça login novamente.',
      });
      router.push('/login');
    }
  }, [router, toast, authUser, isLoading]);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchVehicles = async () => {
      try {
        const vehiclesCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/vehicles`);
        const querySnapshot = await getDocs(vehiclesCol);
        const vehiclesList = querySnapshot.docs
          .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
          .filter((v: any) => v.isTruck)
          .map((v: any) => ({ id: v.id, model: v.model, lastMileage: v.lastMileage }));
        setVehicles(vehiclesList);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os veículos.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchVehicles();
  }, [firestore, user, toast]);

  useEffect(() => {
    if (!firestore || !user || user.sectorId !== 'MILKRUN INTERNO') return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const routesCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/routes`);
    const q = query(routesCol, where('date', '==', todayStr));

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const routes = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Route));
      setMilkrunRoutes(routes);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  useEffect(() => {
    if (selectedVehicle) {
      const v = vehicles.find((v: any) => v.id === selectedVehicle);
      if (v && v.lastMileage !== undefined) {
        setMileage(v.lastMileage.toString());
      }
    }
  }, [selectedVehicle, vehicles]);

  const handleStartRun = async (milkrunTrip?: RouteTrip, milkrunVehicleId?: string) => {
    const finalVehicleId = milkrunVehicleId || selectedVehicle;
    
    if(!firestore || !user || !finalVehicleId || !mileage || (!milkrunTrip && !stopPoint)){
       toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos para iniciar a corrida.' });
       return;
    }

    const currentMileage = Number(mileage);
    const chosenVehicle = vehicles.find((v: any) => v.id === finalVehicleId);

    if (currentMileage <= 0) {
      toast({
        variant: 'destructive',
        title: 'KM Inválido',
        description: 'A quilometragem não pode ser zero ou negativa.'
      });
      return;
    }

    if (chosenVehicle && chosenVehicle.lastMileage !== undefined && currentMileage < chosenVehicle.lastMileage) {
      toast({
        variant: 'destructive',
        title: 'KM Inválido',
        description: `A quilometragem não pode ser inferior à última registrada (${chosenVehicle.lastMileage} km).`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check for daily checklist
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());

      const checklistCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/vehicles/${finalVehicleId}/checklists`);
      const q = query(checklistCol,
        where('timestamp', '>=', todayStart),
        where('timestamp', '<=', todayEnd)
      );

      const checklistSnapshot = await getDocs(q);

      if (checklistSnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Checklist Requerido',
          description: `Você deve preencher o checklist diário para o veículo ${finalVehicleId} antes de iniciar um trajeto.`,
          duration: 5000,
        });
        setIsSubmitting(false);
        return;
      }


      const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
      
      const stopsToUse = milkrunTrip ? milkrunTrip.stops.map((s: RouteStop) => ({
        name: s.name,
        status: 'PENDING' as const,
        arrivalTime: null,
        departureTime: null,
        collectedOccupiedCars: null,
        collectedEmptyCars: null,
        mileageAtStop: null,
        occupancy: null,
        plannedArrival: s.plannedArrival,
        plannedDeparture: s.plannedDeparture
      })) : [{
        name: stopPoint,
        status: 'PENDING' as const,
        arrivalTime: null,
        departureTime: null,
        collectedOccupiedCars: null,
        collectedEmptyCars: null,
        mileageAtStop: null,
        occupancy: null,
      }];

      const newRun = {
        driverId: user.id,
        driverName: user.name,
        vehicleId: finalVehicleId,
        startMileage: Number(mileage),
        startTime: serverTimestamp(),
        status: 'IN_PROGRESS' as const,
        stops: stopsToUse,
        endTime: null,
        endMileage: null,
      };

      const docRef = await addDoc(runsCol, newRun);

      if (!milkrunTrip && stopPoint) {
        const updated = [stopPoint, ...recentStops.filter(s => s !== stopPoint)].slice(0, 3);
        setRecentStops(updated);
        localStorage.setItem(`recent_stops_${user.id}`, JSON.stringify(updated));
      }

      toast({ title: 'Sucesso', description: 'Trajeto iniciado! Redirecionando...' });

      router.push(`/dashboard-truck/active-run?id=${docRef.id}`);

    } catch (error) {
      console.error("Erro ao iniciar corrida: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível iniciar o trajeto.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto container mx-auto max-w-2xl">
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-truck')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Iniciar Trajeto</h1>
            {user?.sectorId === 'MILKRUN INTERNO' && <p className="text-sm text-primary font-medium">Setor: Milkrun Interno</p>}
          </div>
        </div>

        {user?.sectorId === 'MILKRUN INTERNO' && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
              <Milestone className="w-5 h-5" /> HOJE: Roteirização Programada
            </h2>
            {milkrunRoutes.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed rounded-xl bg-white dark:bg-zinc-900/50">
                <p className="text-muted-foreground">Nenhuma rota programada para hoje.</p>
                <p className="text-xs mt-1">Use a opção manual abaixo se necessário.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {milkrunRoutes.map((route: Route) => (
                  <div key={route.id} className="space-y-3">
                    <h3 className="font-bold text-primary flex items-center gap-2">
                       <Truck className="w-4 h-4" /> Veículo: {route.vehicleId}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {route.trips.map((trip: RouteTrip) => (
                        <Card key={trip.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <span className="font-bold text-lg">{trip.name}</span>
                              <Badge variant="outline">{trip.stops.length} paradas</Badge>
                            </div>
                            <div className="space-y-2 mb-4">
                              {trip.stops.slice(0, 3).map((stop: RouteStop, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  <span className="flex-1 truncate">{stop.name}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {stop.plannedArrival}
                                  </span>
                                </div>
                              ))}
                              {trip.stops.length > 3 && (
                                <p className="text-[10px] text-center text-muted-foreground">+{trip.stops.length - 3} outras paradas</p>
                              )}
                            </div>
                            <Button 
                              className="w-full h-10 gap-2" 
                              onClick={() => handleStartRun(trip, route.vehicleId)}
                              disabled={isSubmitting || (selectedVehicle !== '' && selectedVehicle !== route.vehicleId)}
                            >
                              <Play className="w-4 h-4 fill-current" /> INICIAR ESTA VIAGEM
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 py-2">
              <Separator className="flex-1" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OU INICIAR MANUALMENTE</span>
              <Separator className="flex-1" />
            </div>
          </section>
        )}
        
        <section className={user?.sectorId === 'MILKRUN INTERNO' ? 'opacity-80' : ''}>
          <h2 className="text-xl font-semibold text-foreground mb-4">Informações da Corrida {user?.sectorId === 'MILKRUN INTERNO' ? 'Manual' : ''}</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="veiculo">Veículo</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger id="veiculo">
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{`${v.id} - ${v.model}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quilometragem">Quilometragem Atual</Label>
              <Input 
                id="quilometragem" 
                type="number" 
                inputMode="numeric"
                placeholder="KM atual do veículo" 
                value={mileage} 
                onChange={(e: any) => setMileage(e.target.value)} 
              />
            </div>
          </div>
        </section>

        <Separator />

        <section className={user?.sectorId === 'MILKRUN INTERNO' ? 'opacity-80' : ''}>
           <h2 className="text-xl font-semibold text-foreground mb-4">Destino</h2>
            <div className="space-y-4">
                {recentStops.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Mais usados:</Label>
                    <div className="flex flex-wrap gap-2">
                       {recentStops.map(s => (
                         <Button key={s} variant="outline" size="sm" className="h-8 text-xs bg-white dark:bg-zinc-900" onClick={() => setStopPoint(s)}>
                           {s}
                         </Button>
                       ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="stop-point">Ponto de Parada</Label>
                  <div className="space-y-2">
                    <Input 
                      placeholder="Filtrar destinos..." 
                      value={stopFilter} 
                      onChange={(e: any) => setStopFilter(e.target.value)}
                      className="h-10 border-dashed"
                    />
                    <Select value={stopPoint} onValueChange={setStopPoint}>
                      <SelectTrigger id="stop-point">
                        <SelectValue placeholder="Selecione o destino da corrida" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {PREDEFINED_STOP_POINTS
                          .filter(p => !stopFilter || p.toLowerCase().includes(stopFilter.toLowerCase()))
                          .map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
            </div>
        </section>

        <div className="h-24"></div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
        <div className="container mx-auto max-w-2xl">
          <Button
            className="w-full text-lg h-14"
            onClick={() => handleStartRun()}
            disabled={!selectedVehicle || !mileage || !stopPoint || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            INICIAR TRAJETO
          </Button>
        </div>
      </footer>
    </div>
  );
}
