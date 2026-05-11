'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
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
import { ArrowLeft, Loader2, Play, Clock, MapPin, Truck, Milestone, ClipboardCheck, Wrench } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import type { VehicleDto, RouteDto, RunDto, CreateRunRequest } from '@/types/api';

const PREDEFINED_STOP_POINTS: string[] = [
  "PINTURA ABS", "DIVISAO PECAS", "ARO", "PINT ALUMINIO", "LINHA FUN",
  "USINAGEM", "MOCOM 2", "POLIMENTO", "ESTOQUE F", "PINTURA SPC",
  "FUNDICAO", "INJECAO PLASTICA", "MOCOM 4", "MONT RODA", "SINTERIZACAO",
  "LINHA 2", "JUTAI", "PINTURA PO", "PINT TANQUE", "PINT ALTA TEMP",
  "SOLDA TANQUE", "PINTURA FAIXA", "CX DE ASSESORIO", "HDA 1", "MOCOM MOTOR",
  "PINT ESCAPAMENTO", "LINHA 4", "GALVANOPLASTIA", "PRENSA 1", "MOCOM 1",
  "HDA 2", "MOCOM 5", "POWER TRAIN", "MOCOM ABS", "NACIONAL",
  "IMPORTADO", "SOLDA GARFO", "DEPOSITO F", "FAB ASSENTO 2", "SOLDA COMPONENTE",
  "DEPOSITO D", "MOTOR", "HCA", "FAB ASSENTO", "SOLDA ESCAPAMENTO",
  "MOCOM 3", "SOLDA CHASSI", "FAB TUBO", "LM ATV", "FAIXA ABS",
  "FILTRO", "KABEL", "ESTAMPARIA", "MONT LINHA FAN", "PINTURA ABS 2",
  "MOCOM MOTOR 2", "MANUTENCAO", "PRENSA 2", "CENTRAL DE RESIDUOS",
  "POSTO DE GASOLINA", "REFEITORIO 1", "REFEITORIO 2", "REFEITORIO 3",
  "REFEITORIO 4", "REFEITORIO 5"
].sort((a, b) => a.localeCompare(b));

export default function TruckRunPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [milkrunRoutes, setMilkrunRoutes] = useState<RouteDto[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [replacedVehicleId, setReplacedVehicleId] = useState('');
  const [manualPlate, setManualPlate] = useState('');
  const [noMileage, setNoMileage] = useState(false);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const [mileage, setMileage] = useState('');
  const [stopPoint, setStopPoint] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stopFilter, setStopFilter] = useState('');
  const [recentStops, setRecentStops] = useState<string[]>([]);

  const [isValidatingVehicle, setIsValidatingVehicle] = useState(false);
  const [vehicleInUse, setVehicleInUse] = useState<string | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [activeTab, setActiveTab] = useState<'programmed' | 'manual'>('programmed');
  const [todayRuns, setTodayRuns] = useState<RunDto[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';
  const sectorName = profile?.sectorId || '';

  useEffect(() => {
    if (profile) {
      const saved = localStorage.getItem(`recent_stops_${profile.id}`);
      if (saved) setRecentStops(JSON.parse(saved));
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || !companyId || !sectorId) return;

    const fetchVehicles = async () => {
      try {
        const data = await api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`);
        setVehicles(data);
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel carregar os veiculos.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchVehicles();
  }, [profile, companyId, sectorId, toast]);

  useEffect(() => {
    const isMilkrun = sectorName.toUpperCase().includes('MILKRUN');
    const isMilkrunAstec = sectorName.toUpperCase() === 'MILKRUN ASTEC';

    if (!profile || !companyId || !sectorId || !isMilkrun || isMilkrunAstec) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const fetchRoutes = async () => {
      try {
        const data = await api.get<RouteDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/routes?date=${todayStr}&date=fixed`);
        const driverShift = profile.shift || '1 NORMAL';

        const seenKeys = new Set<string>();
        const filtered = data
          .filter(r => (r.shift || '1 NORMAL') === driverShift)
          .sort((a, b) => {
            if (a.date !== 'fixed' && b.date === 'fixed') return -1;
            if (a.date === 'fixed' && b.date !== 'fixed') return 1;
            return 0;
          })
          .filter(r => {
            const key = r.vehicleId;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

        setMilkrunRoutes(filtered);
      } catch (e) {
        console.error("Erro ao carregar rotas:", e);
      }
    };
    fetchRoutes();
  }, [profile, companyId, sectorId, sectorName]);

  // Fetch today's runs for progress tracking
  useEffect(() => {
    if (!profile || !companyId || !sectorId) return;

    const fetchTodayRuns = async () => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const data = await api.get<RunDto[]>(
          `/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${todayStr}T00:00&dateTo=${todayStr}T23:59`
        );
        setTodayRuns(data);
      } catch { /* ignore */ }
    };
    fetchTodayRuns();
  }, [profile, companyId, sectorId]);

  useEffect(() => {
    if (selectedVehicle) {
      if (selectedVehicle !== 'OUTRO') {
        const v = vehicles.find(v => v.id === selectedVehicle);
        if (v && v.lastMileage != null) {
          setMileage(v.lastMileage.toString());
        } else {
          setMileage('');
        }
      }
      validateVehicle(selectedVehicle);
    } else {
      setHasValidated(false);
      setVehicleInUse(null);
    }
  }, [selectedVehicle, vehicles]);

  const validateVehicle = async (vehicleId: string) => {
    if (vehicleId === 'OUTRO') {
      setActiveRunId(null);
      setHasValidated(true);
      return;
    }
    if (!profile || !companyId || !sectorId) return;
    setIsValidatingVehicle(true);
    setVehicleInUse(null);
    setHasValidated(false);

    try {
      const runs = await api.get<RunDto[]>(
        `/api/companies/${companyId}/sectors/${sectorId}/runs?vehicleId=${vehicleId}&status=IN_PROGRESS`
      );

      if (Array.isArray(runs) && runs.length > 0) {
        const activeRun = runs[0];
        if (activeRun.driverId !== profile.id) {
          setVehicleInUse(activeRun.driverName || 'Outro motorista');
          setActiveRunId(null);
          toast({
            variant: 'destructive',
            title: 'Veiculo em Uso',
            description: `Este veiculo ja esta sendo utilizado por: ${activeRun.driverName || 'outro motorista'}.`
          });
        } else {
          setActiveRunId(runs[0].id);
          setHasValidated(true);
        }
      } else {
        setActiveRunId(null);
        setHasValidated(true);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao validar status do veiculo.' });
    } finally {
      setIsValidatingVehicle(false);
    }
  };

  const handleResumeRun = async (runId: string, currentDriverId: string) => {
    if (!profile) return;

    try {
      const runData = await api.get<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs/${runId}`);

      if (runData.driverId !== profile.id) {
        const confirmTakeover = window.confirm(`Deseja assumir o trajeto de ${runData.driverName || 'outro motorista'}?`);
        if (!confirmTakeover) return;

        await api.put(`/api/companies/${companyId}/sectors/${sectorId}/runs/${runId}/takeover`, {
          driverId: profile.id
        });
      }
      router.push(`/dashboard-truck/active-run?id=${runId}`);
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel retomar o trajeto.' });
    }
  }

  const handleMarkMaintenance = async () => {
    if (!profile || !selectedVehicle || selectedVehicle === 'OUTRO') return;

    if (!window.confirm(`Deseja realmente marcar o veiculo ${selectedVehicle} como EM MANUTENCAO?`)) {
      return;
    }

    setIsMaintenanceLoading(true);
    try {
      await api.post(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle}/maintenance/start`);

      setVehicles(prev => prev.map(v => v.id === selectedVehicle ? { ...v, status: 'EM_MANUTENCAO' } : v));
      toast({ title: 'Sucesso', description: 'Veiculo marcado como em manutencao.' });
      setSelectedVehicle('');
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao registrar manutencao.' });
    } finally {
      setIsMaintenanceLoading(false);
    }
  };

  const handleStartRun = async (milkrunTrip?: RouteDto['trips'][0], milkrunVehicleId?: string) => {
    let finalVehicleId = milkrunVehicleId || selectedVehicle;

    if (finalVehicleId === 'OUTRO') {
      if (!manualPlate || manualPlate.trim() === '') {
        toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, digite a placa do caminhao para prosseguir.' });
        return;
      }
      finalVehicleId = manualPlate.toUpperCase().trim();
    }

    if (!profile || !finalVehicleId || (!noMileage && !mileage) || (!milkrunTrip && !stopPoint)) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos para iniciar a corrida.' });
      return;
    }

    const chosenVehicle = vehicles.find(v => v.id === finalVehicleId);

    if (chosenVehicle && chosenVehicle.status === 'BLOQUEADO_CHECKLIST') {
      toast({ variant: 'destructive', title: 'Veiculo Bloqueado', description: 'Este caminhao esta bloqueado devido a nao conformidades graves no checklist. Contate o gestor para liberacao.' });
      return;
    }

    const currentMileage = noMileage ? (chosenVehicle?.lastMileage || 0) : Number(mileage);

    if (!noMileage) {
      if (currentMileage <= 0) {
        toast({ variant: 'destructive', title: 'KM Invalido', description: 'A quilometragem nao pode ser zero ou negativa.' });
        return;
      }

      if (chosenVehicle && chosenVehicle.lastMileage !== undefined && currentMileage < chosenVehicle.lastMileage) {
        toast({
          variant: 'destructive',
          title: 'KM Invalido',
          description: `A quilometragem não pode ser menor que a ultima registrada (${chosenVehicle.lastMileage} km).`
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Check for daily checklist
      if (selectedVehicle !== 'OUTRO') {
        let hasChecklist = false;
        try {
          await api.get(
            `/api/companies/${companyId}/sectors/${sectorId}/vehicles/${finalVehicleId}/checklists/today`
          );
          hasChecklist = true;
        } catch {
          // 404 means no checklist today
        }

        if (!hasChecklist) {
          toast({
            variant: 'destructive',
            title: 'Checklist Requerido',
            description: `Voce deve preencher o checklist diario para o veiculo ${finalVehicleId} antes de iniciar um trajeto.`,
            duration: 5000,
          });
          setIsSubmitting(false);
          return;
        }
      }

      const stopsToUse = milkrunTrip ? milkrunTrip.stops.map(s => ({
        name: s.name,
        plannedArrival: s.plannedArrival,
        plannedDeparture: s.plannedDeparture,
      })) : [{
        name: stopPoint,
      }];

      const vehicleRoute = milkrunRoutes.find(r => r.vehicleId === finalVehicleId);

      const body: CreateRunRequest = {
        driverId: profile.id,
        driverName: profile.name,
        vehicleId: finalVehicleId,
        routeId: milkrunTrip && vehicleRoute ? vehicleRoute.id : undefined,
        tripId: milkrunTrip?.id || undefined,
        tripName: milkrunTrip?.name || undefined,
        shift: profile.shift,
        startMileage: Number(mileage),
        stops: stopsToUse,
      };

      const newRun = await api.post<RunDto>(`/api/companies/${companyId}/sectors/${sectorId}/runs`, body);

      if (!milkrunTrip && stopPoint) {
        const updated = [stopPoint, ...recentStops.filter(s => s !== stopPoint)].slice(0, 3);
        setRecentStops(updated);
        localStorage.setItem(`recent_stops_${profile.id}`, JSON.stringify(updated));
      }

      toast({ title: 'Sucesso', description: 'Trajeto iniciado! Redirecionando...' });
      router.push(`/dashboard-truck/active-run?id=${newRun.id}`);

    } catch (error) {
      console.error("Erro ao iniciar corrida: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel iniciar o trajeto.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isMilkrunAstec = sectorName.toUpperCase() === 'MILKRUN ASTEC';
  const vehicleRoute = milkrunRoutes.find(r => r.vehicleId === (selectedVehicle === 'OUTRO' && replacedVehicleId !== 'none' ? replacedVehicleId : selectedVehicle));
  const showProgrammed = !isMilkrunAstec && vehicleRoute && vehicleRoute.trips.length > 0 && activeTab === 'programmed';
  const hasRouteAvailable = !isMilkrunAstec && vehicleRoute && vehicleRoute.trips.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto container mx-auto max-w-2xl pb-32">

        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-truck')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Iniciar Trajeto</h1>
            {sectorName && <p className="text-sm text-primary font-medium">Setor: {sectorName}</p>}
          </div>
        </div>

        {/* STEP 1: VEICULO */}
        <Card className="border-t-4 border-t-primary shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="veiculo" className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" /> 1. SELECIONE O CAMINHAO
              </Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger id="veiculo" className="h-12 text-lg">
                  <SelectValue placeholder="Toque para escolher" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id} disabled={v.status === 'EM_MANUTENCAO' || v.status === 'BLOQUEADO_CHECKLIST'}>
                      {`${v.id} - ${v.model}`}
                      {v.status === 'EM_MANUTENCAO' && ' (EM MANUTENCAO)'}
                      {v.status === 'BLOQUEADO_CHECKLIST' && ' (BLOQUEADO)'}
                    </SelectItem>
                  ))}
                  <SelectItem value="OUTRO" className="font-bold text-primary">Outro Caminhao (Digitar Placa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedVehicle === 'OUTRO' && (
              <div className="space-y-4 mt-4 pt-4 border-t border-dashed animate-in fade-in zoom-in duration-300">
                <div className="space-y-2">
                  <Label htmlFor="manualPlate" className="text-sm font-bold flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" /> PLACA DO CAMINHAO
                  </Label>
                  <Input
                    id="manualPlate"
                    placeholder="EX: ABC-1234"
                    value={manualPlate}
                    onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                    className="h-12 text-lg font-bold uppercase"
                  />
                </div>
                {!isMilkrunAstec && milkrunRoutes.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="replacedVehicle" className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                      Qual rota este veiculo fara? (Opcional)
                    </Label>
                    <Select value={replacedVehicleId} onValueChange={setReplacedVehicleId}>
                      <SelectTrigger id="replacedVehicle" className="h-12">
                        <SelectValue placeholder="Selecione o caminhao para puxar a programacao" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma (Apenas Manual)</SelectItem>
                        {milkrunRoutes.map(r => (
                          <SelectItem key={r.vehicleId} value={r.vehicleId}>
                            Herdar Programacao do Veiculo: {r.vehicleId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {selectedVehicle && selectedVehicle !== 'OUTRO' && (
              <div className="flex justify-end mt-2 animate-in fade-in duration-300">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkMaintenance}
                  disabled={isMaintenanceLoading}
                  className="text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20"
                >
                  {isMaintenanceLoading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Wrench className="w-3 h-3 mr-2" />}
                  Informar Manutencao
                </Button>
              </div>
            )}

            {isValidatingVehicle && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verificando disponibilidade...
              </div>
            )}

            {vehicleInUse && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl text-destructive">
                <p className="text-sm font-bold flex items-center gap-2">
                  Veiculo em uso por: {vehicleInUse}
                </p>
                <p className="text-xs mt-1">Escolha outro veiculo para prosseguir.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STEP 2: KM E ROTA */}
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
                    onChange={(e) => setMileage(e.target.value)}
                    className={cn("h-12 text-xl font-bold", noMileage && "opacity-50")}
                    disabled={noMileage}
                  />
                  <div className="flex items-center space-x-2 pt-2 pb-2">
                    <input
                      type="checkbox"
                      id="no-mileage-start"
                      checked={noMileage}
                      onChange={(e) => setNoMileage(e.target.checked)}
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
                    />
                    <Label htmlFor="no-mileage-start" className="text-sm font-medium cursor-pointer">
                      Veiculo nao exibe quilometragem
                    </Label>
                  </div>
                  {selectedVehicle && vehicles.find(v => v.id === selectedVehicle)?.lastMileage !== undefined && (
                    <p className="text-[10px] text-muted-foreground px-1 italic">
                      Ultimo registro: {vehicles.find(v => v.id === selectedVehicle)?.lastMileage} km
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
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Detectamos rotas salvas para este veiculo</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {vehicleRoute!.trips.map(trip => {
                    const existingRun = todayRuns.find(r => r.tripId === trip.id && r.vehicleId === selectedVehicle);
                    const isCompleted = existingRun?.status === 'COMPLETED';
                    const isInProgress = existingRun?.status === 'IN_PROGRESS';
                    const isMine = existingRun?.driverId === profile?.id;

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
                                {isCompleted && <Badge className="bg-green-500 text-white text-[8px] h-4">CONCLUIDO</Badge>}
                                {isInProgress && <Badge className="bg-blue-500 text-white text-[8px] h-4 animate-pulse">EM ANDAMENTO</Badge>}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge variant="outline" className="text-[10px]">{trip.stops.length} paradas</Badge>
                                {vehicleRoute!.isFixed && <Badge variant="secondary" className="text-[8px] h-4">PROGRAMACAO FIXA</Badge>}
                              </div>
                            </div>
                            {isCompleted ? <ClipboardCheck className="w-8 h-8 text-green-500/20" /> : <Play className="w-8 h-8 text-primary/20" />}
                          </div>

                          <div className="space-y-2 mb-6 bg-muted/50 p-3 rounded-lg">
                            {trip.stops.slice(0, 3).map((stop, idx) => (
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
                              onClick={() => handleResumeRun(existingRun.id, profile?.id || '')}
                            >
                              {isMine ? <Play className="w-4 h-4 fill-current" /> : <Clock className="w-4 h-4" />}
                              {isMine ? 'RETOMAR MINHA VIAGEM' : `ASSUMIR DE: ${existingRun.driverName}`}
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  className={cn("w-full text-md font-bold h-12 gap-2 shadow-sm", isCompleted && "bg-muted text-muted-foreground")}
                                  disabled={isSubmitting || (!noMileage && !mileage) || isCompleted}
                                >
                                  <Play className="w-4 h-4 fill-current" /> {isCompleted ? 'VIAGEM CONCLUIDA' : 'INICIAR ESTA ROTA'}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deseja iniciar esta viagem?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Voce esta prestes a iniciar a {trip.name} com o veiculo {selectedVehicle}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleStartRun(trip, selectedVehicle)}>Confirmar e Iniciar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  <div className="pt-4 border-t border-dashed">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-muted-foreground text-[10px] font-bold uppercase h-10 border-dashed"
                      onClick={() => setActiveTab('manual')}
                    >
                      <MapPin className="w-3 h-3 mr-2" /> Outro trajeto manual (fora da roteirizacao)
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                {hasRouteAvailable && (
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">MODO MANUAL ATIVADO</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] font-black text-blue-600 hover:text-blue-700 p-0"
                      onClick={() => setActiveTab('programmed')}
                    >
                      VOLTAR PARA ROTEIRIZACAO →
                    </Button>
                  </div>
                )}
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
                        placeholder="Procurar destino..."
                        value={stopFilter}
                        onChange={(e) => setStopFilter(e.target.value)}
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

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="w-full text-lg h-14 mt-4 shadow-lg font-bold"
                          disabled={(!activeRunId && (!selectedVehicle || (!noMileage && !mileage) || !stopPoint)) || isSubmitting}
                        >
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (activeRunId ? <Clock className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5 fill-current" />)}
                          {activeRunId ? 'RETOMAR TRAJETO ATUAL' : 'INICIAR TRAJETO'}
                        </Button>
                      </AlertDialogTrigger>
                      {!activeRunId && (
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar inicio de trajeto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Destino: {stopPoint} no veiculo {selectedVehicle}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleStartRun()}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      )}
                    </AlertDialog>
                  </CardContent>
                </Card>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
