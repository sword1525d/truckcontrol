'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Car, Loader2, Milestone, Fuel, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getCarUsuario,
  getCorridaAtiva,
  encerrarCorrida,
  updateVeiculo,
  updateUsuarioStatus,
  type CarUsuario,
  type CarCorrida,
} from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';

type FuelLevel = 1 | 2 | 3 | 4;

const GAS_LEVELS: { level: FuelLevel; label: string; percent: number; color: string }[] = [
  { level: 1, label: 'Vazio', percent: 25, color: '#ef4444' },
  { level: 2, label: '¼', percent: 50, color: '#f59e0b' },
  { level: 3, label: '½', percent: 75, color: '#eab308' },
  { level: 4, label: 'Cheio', percent: 100, color: '#22c55e' },
];

export default function CarActiveRunPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [corridaKey, setCorridaKey] = useState<string | null>(null);
  const [corrida, setCorrida] = useState<CarCorrida | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [kmFinal, setKmFinal] = useState('');
  const [gasolina, setGasolina] = useState<FuelLevel>(4);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);

    const load = async () => {
      setIsLoading(true);
      try {
        const ativa = await getCorridaAtiva(u.empresa, u.setor, u.nome);
        if (!ativa) {
          toast({ variant: 'destructive', title: 'Nenhuma corrida ativa', description: 'Você não tem nenhuma corrida em aberto.' });
          router.push('/dashboard-car');
          return;
        }
        setCorridaKey(ativa.key);
        setCorrida(ativa.corrida);
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar a corrida ativa.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const handleEncerrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !corridaKey || !corrida) return;
    if (!kmFinal) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Informe a quilometragem final.' });
      return;
    }

    const kmFinalNum = parseFloat(kmFinal);
    const kmInicialNum = parseFloat(String(corrida.km_inicial));
    if (kmFinalNum <= kmInicialNum) {
      toast({
        variant: 'destructive',
        title: 'KM Inválido',
        description: `A quilometragem final deve ser maior que a inicial (${corrida.km_inicial} km).`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const horario_fim = new Date().toLocaleTimeString('pt-BR');

      await encerrarCorrida(usuario.empresa, usuario.setor, corridaKey, {
        km_final: kmFinal,
        horario_fim,
        gasolina,
      });

      await updateVeiculo(usuario.empresa, usuario.setor, corrida['veículo'], {
        status: 'NO ESTACIONAMENTO',
        'ÚLTIMO A USAR': usuario.nome,
        motorista: '',
        destino: '',
        km_rodados: kmFinal,
        gasolina,
      });

      await updateUsuarioStatus(usuario.empresa, usuario.mat, { em_corrida: false });

      toast({ title: 'Corrida encerrada!', description: `Km percorridos: ${(kmFinalNum - kmInicialNum).toFixed(1)} km` });
      router.push('/dashboard-car');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !usuario) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-lg pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Encerrar Corrida</h1>
            {corrida && (
              <p className="text-sm text-primary font-medium">
                {corrida['veículo']} → {corrida.destino}
              </p>
            )}
          </div>
        </div>

        {corrida && (
          <div className="mb-4 bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{corrida['veículo']}</p>
                <p className="text-xs text-muted-foreground">
                  Iniciado: {corrida.horario_inicio} · KM inicial: {corrida.km_inicial}
                </p>
                <p className="text-xs text-muted-foreground">Destino: {corrida.destino}</p>
              </div>
              <div className="ml-auto bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                EM CURSO
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleEncerrar} className="space-y-4">
          {/* KM Final */}
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardContent className="p-6 space-y-2">
              <Label htmlFor="km-final" className="text-sm font-bold flex items-center gap-2">
                <Milestone className="w-4 h-4 text-primary" /> QUILOMETRAGEM FINAL
              </Label>
              <Input
                id="km-final"
                type="number"
                inputMode="numeric"
                placeholder="KM final no painel"
                value={kmFinal}
                onChange={(e) => setKmFinal(e.target.value)}
                className="h-12 text-xl font-bold"
              />
              {corrida && (
                <p className="text-xs text-muted-foreground italic">KM inicial: {corrida.km_inicial}</p>
              )}
            </CardContent>
          </Card>

          {/* Nível de Gasolina */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Fuel className="w-4 h-4 text-primary" /> NÍVEL DE GASOLINA
              </CardTitle>
              <CardDescription className="text-xs">Toque na barra para selecionar o nível atual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Interactive fuel bar */}
              <div
                className="relative h-10 bg-muted rounded-2xl overflow-hidden cursor-pointer border border-border shadow-inner"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  if (pct < 25) setGasolina(1);
                  else if (pct < 50) setGasolina(1);
                  else if (pct < 62.5) setGasolina(2);
                  else if (pct < 87.5) setGasolina(3);
                  else setGasolina(4);
                }}
              >
                <div
                  className="absolute top-0 left-0 bottom-0 rounded-2xl transition-all duration-300"
                  style={{
                    width: `${GAS_LEVELS.find((g) => g.level === gasolina)?.percent ?? 100}%`,
                    backgroundColor: GAS_LEVELS.find((g) => g.level === gasolina)?.color,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-white drop-shadow z-10">
                    {GAS_LEVELS.find((g) => g.level === gasolina)?.label}
                  </span>
                </div>
              </div>

              {/* Level buttons */}
              <div className="grid grid-cols-4 gap-2">
                {GAS_LEVELS.map((g) => (
                  <button
                    key={g.level}
                    type="button"
                    onClick={() => setGasolina(g.level)}
                    className="py-2 rounded-lg text-xs font-bold border transition-all"
                    style={{
                      backgroundColor: gasolina === g.level ? g.color : undefined,
                      color: gasolina === g.level ? 'white' : undefined,
                      borderColor: gasolina === g.level ? g.color : undefined,
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            variant="destructive"
            className="w-full h-14 text-base font-bold"
            disabled={!kmFinal || isSubmitting}
          >
            {isSubmitting
              ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              : <CheckCircle2 className="mr-2 h-5 w-5" />}
            ENCERRAR CORRIDA
          </Button>
        </form>
      </main>
    </div>
  );
}
