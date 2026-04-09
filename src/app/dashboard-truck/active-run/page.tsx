'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Loader2, Milestone, Truck, User, X } from 'lucide-react';
import { OccupancySelector } from './OccupancySelector';
import { Textarea } from '@/components/ui/textarea';


type StopStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

type Stop = {
  name: string;
  status: StopStatus;
  arrivalTime: any;
  departureTime: any;
  collectedOccupiedCars: number | null;
  collectedEmptyCars: number | null;
  mileageAtStop: number | null;
  occupancy: number | null;
  observation?: string;
};

type LocationPoint = {
  latitude: number;
  longitude: number;
  timestamp: any;
}

type Run = {
  id: string;
  driverName: string;
  vehicleId: string;
  startMileage: number;
  startTime: any;
  status: 'IN_PROGRESS' | 'COMPLETED';
  stops: Stop[];
  endTime: any;
  endMileage: number | null;
  locationHistory?: LocationPoint[];
  tripId?: string | null;
  tripName?: string | null;
};

// Custom hook for location tracking with batching
const useLocationTracking = (runId: string | null, isActive: boolean) => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const watchIdRef = useRef<number | null>(null);
  const locationBatchRef = useRef<LocationPoint[]>([]);

  const flushLocationBatch = useCallback(() => {
    if (locationBatchRef.current.length === 0 || !runId || !firestore) {
      return;
    }

    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');
    if (!companyId || !sectorId) return;
    
    const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);
    const batchToFlush = [...locationBatchRef.current];
    locationBatchRef.current = [];

    updateDoc(runRef, {
      locationHistory: arrayUnion(...batchToFlush)
    }).catch(error => {
      console.error("Erro ao salvar lote de localização: ", error);
      // If flushing fails, add the batch back to be retried later
      locationBatchRef.current = [...batchToFlush, ...locationBatchRef.current];
    });
  }, [runId, firestore]);

  useEffect(() => {
    if (!runId || !isActive || !firestore) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const newLocation: LocationPoint = {
        latitude,
        longitude,
        timestamp: new Date(),
      };
      locationBatchRef.current.push(newLocation);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error("Erro de geolocalização: ", error);
      toast({ variant: 'destructive', title: 'Erro de Localização', description: `Não foi possível obter sua localização: ${error.message}` });
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 1000,
      });
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: 'Geolocalização não é suportada neste navegador.' });
    }
    
    // Set up an interval to flush the batch periodically
    const flushInterval = setInterval(flushLocationBatch, 30000); // Flush every 30 seconds

    // Flush when the component unmounts or dependencies change
    return () => {
      clearInterval(flushInterval);
      flushLocationBatch();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [runId, isActive, firestore, toast, flushLocationBatch]);
};


function ActiveRunContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const [run, setRun] = useState<Run | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [observation, setObservation] = useState('');
  const [noMileage, setNoMileage] = useState(false);
  const [stopData, setStopData] = useState<{ occupied: string; empty: string; mileage: string, occupancy: number; }>({ occupied: '', empty: '', mileage: '', occupancy: 0 });
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  
  const runId = searchParams.get('id');

  // Activate location tracking
  useLocationTracking(runId, run?.status === 'IN_PROGRESS');

  const fetchRun = useCallback(async () => {
    if (!firestore || !user || !runId) return;
    setIsLoading(true);
    try {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      if (!companyId || !sectorId) {
        throw new Error('Informações de empresa/setor não encontradas.');
      }
      
      const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);
      const runSnap = await getDoc(runRef);

      if (runSnap.exists()) {
        const runData = runSnap.data() as Omit<Run, 'id'>;
        const transformedRunData: Run = { id: runSnap.id, ...runData };
        setRun(transformedRunData);
        
        // Find the first non-completed stop index
        const firstIncompleteIdx = transformedRunData.stops.findIndex(s => s.status !== 'COMPLETED');
        const activeIdx = firstIncompleteIdx === -1 ? transformedRunData.stops.length - 1 : firstIncompleteIdx;
        setCurrentStopIndex(activeIdx);

        const stop = transformedRunData.stops[activeIdx];
        if (stop && (stop.status === 'IN_PROGRESS' || stop.status === 'COMPLETED')) {
          setStopData({
            occupied: stop.collectedOccupiedCars?.toString() || '',
            empty: stop.collectedEmptyCars?.toString() || '',
            mileage: stop.mileageAtStop?.toString() || (activeIdx > 0 ? (transformedRunData.stops[activeIdx-1].mileageAtStop?.toString() || transformedRunData.startMileage.toString()) : transformedRunData.startMileage.toString()),
            occupancy: stop.occupancy ?? 0
          });
          setObservation(stop.observation || '');
        } else {
           // If pending, use previous stop's mileage or start mileage as default
           const previousMileage = activeIdx > 0 ? (transformedRunData.stops[activeIdx-1].mileageAtStop?.toString() || transformedRunData.startMileage.toString()) : transformedRunData.startMileage.toString();
           setStopData(prev => ({ ...prev, mileage: previousMileage }));
        }
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Trajeto não encontrado.' });
        router.push('/dashboard-truck');
      }
    } catch (error) {
      console.error("Erro ao buscar trajeto:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados do trajeto.' });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, user, runId, router, toast]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const handleRegisterArrival = async () => {
    if (!run || !firestore || !runId || run.stops.length <= currentStopIndex) return;
    
    const stop = run.stops[currentStopIndex];
    if (stop.status !== 'PENDING') return;
    
    const arrivalTime = new Date();

    try {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);
      
      const updatedStops = [...run.stops];
      updatedStops[currentStopIndex] = {
          ...updatedStops[currentStopIndex],
          status: 'IN_PROGRESS',
          arrivalTime: arrivalTime,
          observation: observation || ''
      };

      await updateDoc(runRef, {
        stops: updatedStops,
      });
      
      setRun(prevRun => {
          if (!prevRun) return null;
          const newStops = [...prevRun.stops];
          newStops[currentStopIndex] = { ...newStops[currentStopIndex], status: 'IN_PROGRESS', arrivalTime, observation: observation || '' };
          return { ...prevRun, stops: newStops };
      });
      
      toast({ title: 'Chegada registrada!', description: `Você chegou em ${stop.name}.` });
    } catch (error) {
      console.error("Erro ao registrar chegada: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível registrar a chegada.' });
    }
  };

  const handleFinishStop = async () => {
    if (!run || !firestore || !runId || run.stops.length <= currentStopIndex) return;
    
    const stop = run.stops[currentStopIndex];
    const { occupied, empty, mileage, occupancy } = stopData;

    const previousMileage = currentStopIndex > 0 ? (run.stops[currentStopIndex - 1].mileageAtStop || run.startMileage) : run.startMileage;
    let finalMileage: number;

    if (noMileage) {
       if (!occupied || !empty) {
          toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha carros ocupados e vazios.' });
          return;
       }
       finalMileage = previousMileage;
    } else {
       if (!occupied || !empty || !mileage) {
         toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha todos os campos para finalizar a parada.' });
         return;
       }
       finalMileage = Number(mileage);
       if (finalMileage <= previousMileage) {
         toast({ 
           variant: 'destructive', 
           title: 'KM Inválido', 
           description: `A quilometragem deve ser superior à última registrada (${previousMileage} km).` 
         });
         return;
       }
    }
    
    const departureTime = new Date();

    try {
      const companyId = localStorage.getItem('companyId');
      const sectorId = localStorage.getItem('sectorId');
      const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);

      const finalOccupied = Number(occupied);
      const finalEmpty = Number(empty);

      const updatedStops = [...run.stops];
      updatedStops[currentStopIndex] = {
        ...updatedStops[currentStopIndex],
        status: 'COMPLETED',
        departureTime: departureTime,
        collectedOccupiedCars: finalOccupied,
        collectedEmptyCars: finalEmpty,
        mileageAtStop: finalMileage,
        occupancy: occupancy,
      };

      await updateDoc(runRef, {
        stops: updatedStops,
      });

      setRun(prevRun => {
          if (!prevRun) return null;
          const newStops = [...prevRun.stops];
          newStops[currentStopIndex] = {
              ...newStops[currentStopIndex],
              status: 'COMPLETED',
              departureTime,
              collectedOccupiedCars: finalOccupied,
              collectedEmptyCars: finalEmpty,
              mileageAtStop: finalMileage,
              occupancy,
          };
          return { ...prevRun, stops: newStops };
      });
      
      toast({ title: 'Parada finalizada!', description: `Parada em ${stop.name} concluída.` });

      // After finishing, advance to next or prepare summary
      if (currentStopIndex < run.stops.length - 1) {
          const nextIdx = currentStopIndex + 1;
          setCurrentStopIndex(nextIdx);
          setStopData({
              occupied: '',
              empty: '',
              mileage: finalMileage.toString(),
              occupancy: 0
          });
          setObservation('');
          setNoMileage(false);
      }

    } catch (error) {
       console.error("Erro ao finalizar parada: ", error);
       toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível finalizar a parada.' });
    }
  };

  const handleStopDataChange = (field: 'occupied' | 'empty' | 'mileage' | 'occupancy', value: string | number) => {
    setStopData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleFinishRun = async () => {
    if (!run || !firestore || !runId || run.stops.length === 0) return;
    
    const lastStop = run.stops[run.stops.length - 1];
    if (lastStop.status !== 'COMPLETED' || !lastStop.mileageAtStop) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Todas as paradas devem estar concluídas para finalizar a corrida.' });
        return;
    }

    try {
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);

        await updateDoc(runRef, {
            status: 'COMPLETED',
            endTime: new Date(),
            endMileage: lastStop.mileageAtStop
        });

        toast({ title: 'Trajeto Finalizado!', description: 'Sua rota foi concluída com sucesso.' });
        router.push('/dashboard-truck');

    } catch (error) {
        console.error("Erro ao finalizar trajeto: ", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível finalizar o trajeto.' });
    }
  }

  const handleCancelRun = async () => {
    if (!run || !firestore || !runId) return;

    try {
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const runRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/runs`, runId);

        await updateDoc(runRef, {
            status: 'CANCELED',
            endTime: new Date()
        });

        toast({ title: 'Trajeto Cancelado', description: 'O trajeto foi descartado com sucesso.' });
        router.push('/dashboard-truck');
    } catch (error) {
        console.error("Erro ao cancelar trajeto: ", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cancelar o trajeto.' });
    }
  }

  if (isLoading || !run || run.stops.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const stop = run.stops[currentStopIndex];
  const stopNameIdentifier = stop.name.replace(/\s+/g, '-');
  const isPending = stop.status === 'PENDING';
  const isInProgress = stop.status === 'IN_PROGRESS';
  const isCompleted = stop.status === 'COMPLETED';

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="mb-6 space-y-5">
            <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-truck')} className="rounded-full shadow-sm">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                
                <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2 h-9 px-3">
                                <ArrowLeft className="w-4 h-4" /> Sair
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Deseja sair deste trajeto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    O trajeto continuará em aberto. Você poderá retomá-lo mais tarde no menu inicial.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Continuar aqui</AlertDialogCancel>
                                <AlertDialogAction onClick={() => router.push('/dashboard-truck')} className="bg-orange-600 hover:bg-orange-700 rounded-xl">Sair agora</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="h-9 px-4 font-bold shadow-sm">
                                <X className="mr-2 h-4 w-4" /> Cancelar Trajeto
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl border-destructive/20">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive">Deseja CANCELAR este trajeto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação irá descartar todos os registros desta corrida. Use apenas se você iniciou o trajeto por engano.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Voltar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancelRun} className="bg-destructive hover:bg-destructive text-destructive-foreground rounded-xl">Confirmar Cancelamento</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Trajeto Ativo</h1>
                    {run.tripName && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold px-3 py-1">
                            {run.tripName}
                        </Badge>
                    )}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm bg-muted/30 p-3 rounded-xl border border-dashed">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-1.5 rounded-lg">
                            <Truck className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-bold">{run.vehicleId}</span>
                    </div>
                    
                    <div className="hidden sm:block w-px h-4 bg-border" />
                    
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-1.5 rounded-lg">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-muted-foreground">{run.driverName}</span>
                    </div>
                </div>
            </div>
        </div>

        <main className="space-y-4">
          <Card className={`group ${isCompleted ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-card'}`}>
              <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                          {isCompleted ? <CheckCircle2 className="text-green-600"/> : <Milestone className="text-muted-foreground"/>}
                          {stop.name}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          isInProgress ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                          {isCompleted ? 'CONCLUÍDO' : isInProgress ? 'EM ANDAMENTO' : 'PENDENTE'}
                      </span>
                  </CardTitle>
              </CardHeader>
              
              {(isPending || isInProgress) && (
                <CardContent className="space-y-6 pt-0">
                    {isInProgress && (
                      <>
                        <OccupancySelector 
                              initialValue={stopData.occupancy}
                              onValueChange={(value) => handleStopDataChange('occupancy', value)}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                  <Label htmlFor={`occupied-${stopNameIdentifier}`} className="text-sm">Carros ocupados</Label>
                                  <Input id={`occupied-${stopNameIdentifier}`} type="number" inputMode="numeric" placeholder="Qtd." 
                                      value={stopData.occupied}
                                      onChange={(e) => handleStopDataChange('occupied', e.target.value)}
                                  />
                              </div>
                              <div className="space-y-1">
                                  <Label htmlFor={`empty-${stopNameIdentifier}`} className="text-sm">Carros vazios</Label>
                                  <Input id={`empty-${stopNameIdentifier}`} type="number" inputMode="numeric" placeholder="Qtd." 
                                      value={stopData.empty}
                                      onChange={(e) => handleStopDataChange('empty', e.target.value)}
                                  />
                              </div>
                              <div className="space-y-1">
                                  <Label htmlFor={`mileage-${stopNameIdentifier}`} className="text-sm">Km atual</Label>
                                  <Input id={`mileage-${stopNameIdentifier}`} type="number" inputMode="numeric" placeholder="Quilometragem"
                                      value={stopData.mileage}
                                      onChange={(e) => handleStopDataChange('mileage', e.target.value)}
                                      disabled={noMileage}
                                      className={noMileage ? 'opacity-50' : ''}
                                  />
                              </div>
                          </div>
                          <div className="flex items-center space-x-2 pt-2">
                              <input 
                                type="checkbox" 
                                id={`no-mileage-${stopNameIdentifier}`} 
                                checked={noMileage} 
                                onChange={(e) => setNoMileage(e.target.checked)} 
                                className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
                              />
                              <Label htmlFor={`no-mileage-${stopNameIdentifier}`} className="text-sm font-medium cursor-pointer">
                                  Veículo não exibe quilometragem
                              </Label>
                          </div>
                      </>
                    )}
                     <div className="space-y-1">
                        <Label htmlFor={`observation-${stopNameIdentifier}`} className="text-sm">Observação (Opcional)</Label>
                        <Textarea id={`observation-${stopNameIdentifier}`} placeholder="Adicione uma observação sobre a parada..."
                            value={observation}
                            onChange={(e) => setObservation(e.target.value)}
                            disabled={isCompleted}
                         />
                     </div>
                </CardContent>
              )}
              
              {isCompleted && (
                 <CardContent className="space-y-4 pt-0 text-sm text-muted-foreground">
                        <OccupancySelector initialValue={stop.occupancy ?? 0} onValueChange={() => {}} disabled />
                       {stop.observation && (
                          <div className="border-t pt-4">
                              <p className="font-semibold text-card-foreground">Observação:</p>
                              <p>{stop.observation}</p>
                          </div>
                      )}
                      <div className="grid grid-cols-3 gap-4 border-t pt-4">
                          <p>Ocupados: <strong>{stop.collectedOccupiedCars}</strong></p>
                          <p>Vazios: <strong>{stop.collectedEmptyCars}</strong></p>
                          <p>KM: <strong>{stop.mileageAtStop}</strong></p>
                      </div>
                  </CardContent>
              )}

              <CardFooter>
              {isPending && (
                      <Button onClick={handleRegisterArrival}>
                          Registrar Chegada
                      </Button>
              )}
              {isInProgress && (
                      <Button onClick={handleFinishStop} variant="secondary" className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800">
                          <CheckCircle2 className="mr-2 h-4 w-4"/> Finalizar Parada
                      </Button>
              )}
              </CardFooter>
          </Card>
            
          {isCompleted && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <CardHeader>
                      <CardTitle>Corrida Concluída!</CardTitle>
                      <CardDescription>A parada foi finalizada. Você pode encerrar o trajeto.</CardDescription>
                  </CardHeader>
                  <CardFooter>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button className="w-full sm:w-auto">Finalizar Trajeto</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar finalização?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      Ao confirmar, a rota será marcada como concluída e não poderá ser reaberta.
                                      A quilometragem da parada será salva como a quilometragem final.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleFinishRun}>Confirmar e Finalizar</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  </CardFooter>
              </Card>
          )}
        </main>
    </div>
  );
}

export default function ActiveRunPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin"/></div>}>
            <ActiveRunContent />
        </Suspense>
    )
}
