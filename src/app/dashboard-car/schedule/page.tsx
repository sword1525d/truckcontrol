'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Clock, Loader2, Car, FileText, AlertCircle } from 'lucide-react';
import {
  getCarUsuario,
  fetchVeiculos,
  criarAgendamento,
  fetchAgendamentosVeiculo,
  type CarUsuario,
  CAR_RTDB_URL,
} from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';

export default function CarSchedulePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [veiculos, setVeiculos] = useState<{ id: string }[]>([]);
  const [selectedVeiculo, setSelectedVeiculo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  // Helper: subtrai minutos de uma string HH:MM
  const subtractMinutes = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number);
    const totalMin = h * 60 + m - minutes;
    const newH = Math.floor(totalMin / 60);
    const newM = totalMin % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  // Data minima = hoje
  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);

    const load = async () => {
      setIsLoading(true);
      try {
        const isGrupo = u.setoresGrupo && u.setoresGrupo.length > 0;
        const setores = isGrupo ? u.setoresGrupo! : [u.setor];
        let allVeiculos: { id: string }[] = [];
        for (const setor of setores) {
          const v = await fetchVeiculos(u.empresa, setor);
          if (v) {
            for (const id of Object.keys(v)) {
              allVeiculos.push({ id: isGrupo ? `${setor}/${id}` : id });
            }
          }
        }
        setVeiculos(allVeiculos);
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel carregar os veiculos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  /** Logica pura de verificacao de conflito - recebe valores explicitos */
  const checkConflictValues = async (
    veiculo: string,
    dt: string,
    inicio: string,
    fim: string,
  ): Promise<string | null> => {
    if (!usuario || !veiculo || !dt || !inicio || !fim) return null;
    if (inicio >= fim) return 'A hora de inicio deve ser anterior a hora de fim.';
    try {
      const parts = veiculo.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : veiculo;
      const agendamentos = await fetchAgendamentosVeiculo(usuario.empresa, targetSetor, targetVeiculo);
      if (!agendamentos) return null;

      const [ano, mes, dia] = dt.split('-');
      const dataBR = `${dia}/${mes}/${ano}`;

      const temConflito = Object.values(agendamentos).some((ag) => {
        if (!ag || ag.status !== 'confirmado' || ag.data !== dataBR) return false;
        // Se o agendamento existente eh do mesmo usuario, ignora a antecedencia
        const isOwner = ag.matricula === usuario.mat;
        // Adiciona 15 min de buffer antes do inicio do agendamento existente
        const bufferInicio = isOwner ? ag.hora_inicio : subtractMinutes(ag.hora_inicio, 15);
        // Sobreposicao de intervalos (com buffer para outros usuarios)
        return !(fim <= bufferInicio || inicio >= ag.hora_fim);
      });

      return temConflito ? 'Ja existe um agendamento neste horario.' : null;
    } catch {
      return null;
    }
  };

  /** Verifica conflito de horario ao mudar horario/veiculo (usa state atual) */
  const checkConflict = async () => {
    const msg = await checkConflictValues(selectedVeiculo, data, horaInicio, horaFim);
    setConflictMsg(msg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !selectedVeiculo || !data || !horaInicio || !horaFim || !motivo) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }

    // Revalida conflito no momento do submit para evitar bypass
    const finalConflict = await checkConflictValues(selectedVeiculo, data, horaInicio, horaFim);
    if (finalConflict) {
      setConflictMsg(finalConflict);
      toast({ variant: 'destructive', title: 'Conflito', description: finalConflict });
      return;
    }

    const agora = new Date();
    const dataHoraInicio = new Date(`${data}T${horaInicio}`);
    if (dataHoraInicio <= agora) {
      toast({ variant: 'destructive', title: 'Data invalida', description: 'Nao e possivel agendar para datas ou horarios passados.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const [ano, mes, dia] = data.split('-');
      const dataBR = `${dia}/${mes}/${ano}`;

      const parts = selectedVeiculo.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : selectedVeiculo;

      await criarAgendamento(usuario.empresa, targetSetor, targetVeiculo, {
        data: dataBR,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        responsavel: usuario.nome,
        matricula: usuario.mat,
        status: 'confirmado',
        veiculo: selectedVeiculo,
        motivo: motivo.trim().toUpperCase(),
      });

      toast({ title: 'Agendado!', description: `${selectedVeiculo} reservado para ${dataBR} das ${horaInicio} as ${horaFim}.` });
      router.push('/dashboard-car');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-lg pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agendar Corrida</h1>
            <p className="text-sm text-muted-foreground">Reserve um veiculo com antecedencia</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Veiculo e Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Veiculo */}
              <div className="space-y-1">
                <Label htmlFor="sched-veiculo">Veiculo</Label>
                <Select
                  value={selectedVeiculo}
                  onValueChange={async (v) => {
                    setSelectedVeiculo(v);
                    // Revalida conflito com o novo veiculo se o restante do form estiver preenchido
                    if (data && horaInicio && horaFim) {
                      const msg = await checkConflictValues(v, data, horaInicio, horaFim);
                      setConflictMsg(msg);
                    } else {
                      setConflictMsg(null);
                    }
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger id="sched-veiculo" className="h-12">
                    <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione o veiculo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data */}
              <div className="space-y-1">
                <Label htmlFor="sched-data" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Data
                </Label>
                <Input
                  id="sched-data"
                  type="date"
                  min={hoje}
                  value={data}
                  onChange={(e) => { setData(e.target.value); setConflictMsg(null); }}
                  className="h-12"
                />
              </div>

              {/* Hora Inicio / Hora Fim */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sched-inicio" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Hora Inicio
                  </Label>
                  <Input
                    id="sched-inicio"
                    type="time"
                    value={horaInicio}
                    onChange={(e) => { setHoraInicio(e.target.value); setConflictMsg(null); }}
                    onBlur={checkConflict}
                    className="h-12"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sched-fim" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Hora Fim
                  </Label>
                  <Input
                    id="sched-fim"
                    type="time"
                    value={horaFim}
                    onChange={(e) => { setHoraFim(e.target.value); setConflictMsg(null); }}
                    onBlur={checkConflict}
                    className="h-12"
                  />
                </div>
              </div>

              {/* Motivo */}
              <div className="space-y-1">
                <Label htmlFor="sched-motivo" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Motivo
                </Label>
                <Input
                  id="sched-motivo"
                  placeholder="Ex: REUNIAO, VISITA TECNICA..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value.toUpperCase())}
                  className="h-12 font-medium"
                />
              </div>

              {/* Conflict warning */}
              {conflictMsg && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{conflictMsg}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full h-12 font-bold"
                disabled={isSubmitting || !!conflictMsg}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                CONFIRMAR AGENDAMENTO
              </Button>
            </CardFooter>
          </Card>
        </form>
      </main>
    </div>
  );
}

