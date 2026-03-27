
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Play, Clock, MapPin, Truck, Milestone, ClipboardCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { startOfDay, endOfDay, format } from 'date-fns';

type UserData = {
  id: string;
  name: string;
  companyId: string;
  sectorId: string;
  sectorName?: string;
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
  isFixed?: boolean;
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
  
  // Validation and Step states
  const [isValidatingVehicle, setIsValidatingVehicle] = useState(false);
  const [vehicleInUse, setVehicleInUse] = useState<string | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [activeTab, setActiveTab] = useState<'programmed' | 'manual'>('programmed');
  const [todayRuns, setTodayRuns] = useState<any[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');

    if (storedUser && companyId && sectorId && authUser) {
      const parsedUser = JSON.parse(storedUser);
      const sectorName = localStorage.getItem('sectorName') || '';
      setUser({ ...parsedUser, id: authUser.uid, companyId, sectorId, sectorName });
      
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
    const isMilkrun = user?.sectorName?.toUpperCase().includes('MILKRUN');
    const isMilkrunAstec = user?.sectorName?.toUpperCase() === 'MILKRUN ASTEC';

    if (!firestore || !user || !isMilkrun || isMilkrunAstec) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const routesCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/routes`);
    const q = query(routesCol, where('date', 'in', [todayStr, 'fixed']));

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const routes = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Route));
      // Prioritize specific date routes over fixed routes if both exist for same truck
      const seenVehicles = new Set();
      const filteredRoutes = routes.sort((a: any, b: any) => {
        if (a.date !== 'fixed' && b.date === 'fixed') return -1;
        if (a.date === 'fixed' && b.date !== 'fixed') return 1;
        return 0;
      }).filter((r: any) => {
        if (seenVehicles.has(r.vehicleId)) return false;
        seenVehicles.add(r.vehicleId);
        return true;
      });

      setMilkrunRoutes(filteredRoutes);
    });

    // Watch progress of routes
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const runsColToday = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
    const qRuns = query(runsColToday, where('startTime', '>=', todayStart), where('startTime', '<=', todayEnd));

    const unsubscribeRuns = onSnapshot(qRuns, (snapshot) => {
      setTodayRuns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeRuns();
    };
  }, [firestore, user]);

  useEffect(() => {
    if (selectedVehicle) {
      const v = vehicles.find((v: any) => v.id === selectedVehicle);
      if (v && v.lastMileage !== undefined) {
        setMileage(v.lastMileage.toString());
      }
      validateVehicle(selectedVehicle);
    } else {
      setHasValidated(false);
      setVehicleInUse(null);
    }
  }, [selectedVehicle, vehicles]);

  const validateVehicle = async (vehicleId: string) => {
    if (!firestore || !user) return;
    setIsValidatingVehicle(true);
    setVehicleInUse(null);
    setHasValidated(false);

    try {
      const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
      const q = query(runsCol, where('vehicleId', '==', vehicleId), where('status', '==', 'IN_PROGRESS'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const activeRun = snapshot.docs[0].data();
        if (activeRun.driverId !== user.id) {
          setVehicleInUse(activeRun.driverName || 'Outro motorista');
          setActiveRunId(null);
          toast({
            variant: 'destructive',
            title: 'Veículo em Uso',
            description: `Este veículo já está sendo utilizado por: ${activeRun.driverName || 'outro motorista'}.`
          });
        } else {
          setActiveRunId(snapshot.docs[0].id);
          setHasValidated(true);
        }
      } else {
        setActiveRunId(null);
        setHasValidated(true);
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao validar status do veículo.' });
    } finally {
      setIsValidatingVehicle(false);
    }
  };

  const handleResumeRun = async (runId: string, currentDriverId: string) => {
    if(!firestore || !user) return;
    
    try {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);
      
      const runSnap = await getDoc(runRef);
      if (runSnap.exists()) {
        const runData = runSnap.data();
        // If not mine, confirm take over
        if (runData.driverId !== user.id) {
          const confirmTakeover = window.confirm(`Deseja assumir o trajeto de ${runData.driverName || 'outro motorista'}?`);
          if (!confirmTakeover) return;
          
          await updateDoc(runRef, {
            driverId: user.id,
            driverName: user.name
          });
        }
        router.push(`/dashboard-truck/active-run?id=${runId}`);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível retomar o trajeto.' });
    }
  }

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
        tripId: milkrunTrip?.id || null,
        tripName: milkrunTrip?.name || null,
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

  const isMilkrunAstec = user?.sectorName?.toUpperCase() === 'MILKRUN ASTEC';
  const vehicleRoute = milkrunRoutes.find(r => r.vehicleId === selectedVehicle);
  const showProgrammed = !isMilkrunAstec && vehicleRoute && vehicleRoute.trips.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto container mx-auto max-w-2xl pb-32">
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-truck')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Iniciar Trajeto</h1>
            {user?.sectorName && <p className="text-sm text-primary font-medium">Setor: {user.sectorName}</p>}
          </div>
        </div>

        {/* STEP 1: VEÍCULO */}
        <Card className="border-t-4 border-t-primary shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="veiculo" className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" /> 1. SELECIONE O CAMINHÃO
              </Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger id="veiculo" className="h-12 text-lg">
                  <SelectValue placeholder="Toque para escolher" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{`${v.id} - ${v.model}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isValidatingVehicle && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verificando disponibilidade...
              </div>
            )}

            {vehicleInUse && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl text-destructive">
                <p className="text-sm font-bold flex items-center gap-2">
                  ⚠️ Veículo em uso por: {vehicleInUse}
                </p>
                <p className="text-xs mt-1">Escolha outro veículo para prosseguir.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STEP 2: KM E ROTA (SÓ APARECE SE VEÍCULO VALIDADO) */}
        {hasValidated && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-md">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quilometragem" className="text-sm font-bold flex items-center gap-2">
                    <Milestone className="w-4 h-4 text-primary" /> 2. QUILOMETRAGEM ATUAL
                  </Label>
                  <Input 
                    id="quilometragem" 
                    type="number" 
                    inputMode="numeric"
                    placeholder="KM atual no painel" 
                    value={mileage} 
                    onChange={(e: any) => setMileage(e.target.value)} 
                    className="h-12 text-xl font-bold"
                  />
                  {selectedVehicle && vehicles.find(v => v.id === selectedVehicle)?.lastMileage !== undefined && (
                    <p className="text-[10px] text-muted-foreground px-1 italic">
                      Último registro: {vehicles.find(v => v.id === selectedVehicle)?.lastMileage} km
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {showProgrammed ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-xl border border-primary/20">
                   <div className="bg-primary p-2 rounded-lg">
                      <Clock className="w-4 h-4 text-white" />
                   </div>
                   <div className="flex-1">
                      <h2 className="text-xs font-black uppercase text-primary">Viagens Programadas</h2>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Detectamos rotas salvas para este veículo</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {vehicleRoute!.trips.map((trip: RouteTrip) => {
                    const existingRun = todayRuns.find(r => r.tripId === trip.id && r.vehicleId === selectedVehicle);
                    const isCompleted = existingRun?.status === 'COMPLETED';
                    const isInProgress = existingRun?.status === 'IN_PROGRESS';
                    const isMine = existingRun?.driverId === user?.id;

                    return (
                      <Card key={trip.id} className={cn("border-l-4 shadow-sm transition-shadow overflow-hidden", 
                        isCompleted ? "border-l-green-500 opacity-60" : "border-l-primary",
                        isInProgress ? "border-l-blue-500 ring-2 ring-blue-500/20" : ""
                      )}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={cn("font-bold text-lg", isCompleted ? "text-green-600 line-through" : "text-primary")}>{trip.name}</span>
                                {isCompleted && <Badge className="bg-green-500 text-white text-[8px] h-4">CONCLUÍDO</Badge>}
                                {isInProgress && <Badge className="bg-blue-500 text-white text-[8px] h-4 animate-pulse">EM ANDAMENTO</Badge>}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge variant="outline" className="text-[10px]">{trip.stops.length} paradas</Badge>
                                {vehicleRoute!.isFixed && <Badge variant="secondary" className="text-[8px] h-4">PROGRAMAÇÃO FIXA</Badge>}
                              </div>
                            </div>
                            {isCompleted ? <ClipboardCheck className="w-8 h-8 text-green-500/20" /> : <Play className="w-8 h-8 text-primary/20" />}
                          </div>
                          
                          <div className="space-y-2 mb-6 bg-muted/50 p-3 rounded-lg">
                            {trip.stops.slice(0, 3).map((stop: RouteStop, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className={cn("w-1.5 h-1.5 rounded-full", isCompleted ? "bg-green-400" : "bg-primary")} />
                                <span className="flex-1 truncate font-medium">{stop.name}</span>
                                <span className="text-muted-foreground font-mono">{stop.plannedArrival}</span>
                              </div>
                            ))}
                            {trip.stops.length > 3 && (
                                <p className="text-[10px] text-center text-muted-foreground font-bold">+{trip.stops.length - 3} MAIS PARADAS</p>
                            )}
                          </div>

                          {isInProgress ? (
                            <Button 
                              className="w-full text-md font-bold h-12 gap-2 shadow-sm bg-blue-600 hover:bg-blue-700" 
                              onClick={() => handleResumeRun(existingRun.id, user?.id || '')}
                            >
                              {isMine ? <Play className="w-4 h-4 fill-current" /> : <Clock className="w-4 h-4" />}
                              {isMine ? 'RETOMAR MINHA VIAGEM' : `ASSUMIR DE: ${existingRun.driverName}`}
                            </Button>
                          ) : (
                            <Button 
                              className={cn("w-full text-md font-bold h-12 gap-2 shadow-sm", isCompleted && "bg-muted text-muted-foreground")} 
                              onClick={() => handleStartRun(trip, selectedVehicle)}
                              disabled={isSubmitting || !mileage || isCompleted}
                            >
                              <Play className="w-4 h-4 fill-current" /> {isCompleted ? 'VIAGEM CONCLUÍDA' : 'INICIAR ESTA ROTA'}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-muted-foreground text-[10px] font-bold uppercase py-4"
                    onClick={() => setHasValidated(true)} 
                  >
                    Ou iniciar trajeto manual (não listado acima)
                  </Button>
                </div>
              </section>
            ) : (
              <Card className="shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> SELECIONE O DESTINO
                  </h2>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {recentStops.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-[10px] text-muted-foreground uppercase font-black">Destinos Recentes</Label>
                      <div className="flex flex-wrap gap-2">
                        {recentStops.map(s => (
                          <Button key={s} variant="outline" size="sm" className={cn("h-8 text-xs font-medium", stopPoint === s ? "bg-primary text-white border-primary" : "bg-white dark:bg-zinc-900")} onClick={() => setStopPoint(s)}>
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t border-dashed">
                    <Input 
                      placeholder="🔎 Procurar destino..." 
                      value={stopFilter} 
                      onChange={(e: any) => setStopFilter(e.target.value)}
                      className="h-10 text-sm"
                    />
                    <Select value={stopPoint} onValueChange={setStopPoint}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione na lista geral" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {PREDEFINED_STOP_POINTS
                          .filter(p => !stopFilter || p.toLowerCase().includes(stopFilter.toLowerCase()))
                          .map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full text-lg h-14 mt-4 shadow-lg font-bold"
                    onClick={() => activeRunId ? handleResumeRun(activeRunId, user.id) : handleStartRun()}
                    disabled={(!activeRunId && (!selectedVehicle || !mileage || !stopPoint)) || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (activeRunId ? <Clock className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5 fill-current" />)}
                    {activeRunId ? 'RETOMAR TRAJETO ATUAL' : 'INICIAR TRAJETO'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
