'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Car, Gauge, Wrench, Navigation, ParkingCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CarHeader } from '@/components/car-header';
import { getCarUsuario, fetchVeiculos, type CarUsuario, type CarVeiculo, CAR_RTDB_URL } from '@/lib/car-rtdb';
import { cn } from '@/lib/utils';
import { Fuel } from 'lucide-react';

function FuelBar({ value }: { value: number }) {
  const level = Math.min(4, Math.max(0, Math.round(value)));
  const segments = 4;

  const barColor =
    level === 1 ? 'bg-red-500' :
    level === 2 ? 'bg-yellow-400' :
    'bg-green-500';

  const labelColor =
    level === 1 ? 'text-red-600 dark:text-red-400' :
    level === 2 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-green-600 dark:text-green-400';

  const labelText =
    level === 0 ? '⚠ Vazio — abastecer urgente' :
    level === 1 ? '⚠ Nível crítico — abastecer urgente' :
    level === 2 ? '⚠ Nível baixo' :
    level === 3 ? 'Nível médio' :
    'Nível cheio';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Fuel className="w-3.5 h-3.5" /> Combustível
        </span>
        <span className={cn('text-sm font-bold tabular-nums', labelColor)}>{level}/4</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-5 flex-1 rounded transition-all duration-500',
              i < level ? barColor : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{labelText}</p>
    </div>
  );
}

type VeiculoFull = CarVeiculo & { id: string };

export default function ViewVehiclePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [veiculos, setVeiculos] = useState<{ id: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [veiculo, setVeiculo] = useState<VeiculoFull | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingVeiculo, setIsLoadingVeiculo] = useState(false);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);
    fetchVeiculos(u.empresa, u.setor).then(data => {
      if (data) setVeiculos(Object.keys(data).map(id => ({ id })));
    }).finally(() => setIsLoadingList(false));
  }, [router]);

  const handleSelect = async (id: string) => {
    if (!usuario) return;
    setSelectedId(id);
    setVeiculo(null);
    setIsLoadingVeiculo(true);
    try {
      const res = await fetch(
        `${CAR_RTDB_URL}/${usuario.empresa}/${usuario.setor}/veiculos/${encodeURIComponent(id)}.json`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('Erro ao buscar veículo');
      const data: CarVeiculo = await res.json();
      setVeiculo({ ...data, id });
    } catch {
      setVeiculo(null);
    } finally {
      setIsLoadingVeiculo(false);
    }
  };

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'EM MANUTENÇÃO':
        return { label: 'Em Manutenção', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200', icon: Wrench };
      case 'EM CORRIDA':
        return { label: 'Em Corrida', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200', icon: Navigation };
      case 'NO ESTACIONAMENTO':
        return { label: 'No Estacionamento', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200', icon: ParkingCircle };
      default:
        return { label: status || 'Disponível', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200', icon: CheckCircle2 };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-2xl pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Consultar Veículo</h1>
            <p className="text-sm text-muted-foreground">Dados em tempo real da frota</p>
          </div>
        </div>

        {/* Seletor */}
        <Card className="mb-4">
          <CardContent className="p-6 space-y-2">
            <Label htmlFor="veiculo-select" className="text-sm font-bold flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" /> VEÍCULO
            </Label>
            <Select value={selectedId} onValueChange={handleSelect} disabled={isLoadingList}>
              <SelectTrigger id="veiculo-select" className="h-12">
                <SelectValue placeholder={isLoadingList ? 'Carregando...' : 'Selecione o veículo'} />
              </SelectTrigger>
              <SelectContent>
                {veiculos.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Loading do veículo */}
        {isLoadingVeiculo && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando dados do veículo...</span>
          </div>
        )}

        {/* Card do Veículo */}
        {veiculo && !isLoadingVeiculo && (() => {
          const statusConfig = getStatusConfig(veiculo.status);
          const StatusIcon = statusConfig.icon;

          return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Imagem do veículo */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center p-6 min-h-[200px]">
                  {veiculo.image ? (
                    <img
                      src={veiculo.image}
                      alt={veiculo.id}
                      className="max-h-48 w-auto object-contain drop-shadow-md"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/car.png'; }}
                    />
                  ) : (
                    <img
                      src="/car.png"
                      alt="Veículo"
                      className="max-h-48 w-auto object-contain opacity-70"
                    />
                  )}
                </div>
                <CardContent className="p-4">
                  <h2 className="text-xl font-bold">{veiculo.id}</h2>
                  {veiculo.modelo && <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>}
                </CardContent>
              </Card>

              {/* Status principal */}
              <Card className={cn('border-2', statusConfig.bg)}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn('p-3 rounded-full', statusConfig.bg)}>
                    <StatusIcon className={cn('w-6 h-6', statusConfig.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Status Atual</p>
                    <p className={cn('text-lg font-bold', statusConfig.color)}>{statusConfig.label}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Dados gerais */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  {/* KM */}
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 shrink-0">
                      <Gauge className="w-4 h-4" />
                      {veiculo.km_rodados ?? 'N/A'}
                    </div>
                    <span className="text-sm text-muted-foreground">km rodados</span>
                  </div>

                  <Separator />

                  {/* Placa */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Placa</span>
                    <span className="text-sm font-bold font-mono uppercase">{veiculo.placa ?? 'N/A'}</span>
                  </div>

                  {/* Gasolina — barra visual */}
                  {veiculo.gasolina !== undefined && (
                    <FuelBar value={Number(veiculo.gasolina)} />
                  )}

                  {/* Campos condicionais: NO ESTACIONAMENTO */}
                  {veiculo['ÚLTIMO A USAR'] && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Último a usar</span>
                      <span className="text-sm font-semibold">{veiculo['ÚLTIMO A USAR']}</span>
                    </div>
                  )}

                  {/* Campos condicionais: EM CORRIDA */}
                  {veiculo.status === 'EM CORRIDA' && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Corrida Ativa</p>
                        {veiculo.motorista && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Motorista</span>
                            <span className="text-sm font-semibold">{veiculo.motorista}</span>
                          </div>
                        )}
                        {veiculo.destino && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Destino</span>
                            <span className="text-sm font-semibold">{veiculo.destino}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Campos condicionais: EM MANUTENÇÃO */}
                  {veiculo.status === 'EM MANUTENÇÃO' && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Manutenção</p>
                        {veiculo.motivo && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Motivo</span>
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">{veiculo.motivo}</span>
                          </div>
                        )}
                        {veiculo.previsao && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Previsão</span>
                            <span className="text-sm font-semibold">{veiculo.previsao}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Empty state antes de selecionar */}
        {!selectedId && !isLoadingVeiculo && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="bg-muted rounded-full p-5">
              <Car className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[220px]">Selecione um veículo acima para visualizar os dados em tempo real</p>
          </div>
        )}
      </main>
    </div>
  );
}
