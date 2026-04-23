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

  // Data mínima = hoje
  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);

    const load = async () => {
      setIsLoading(true);
      try {
        const v = await fetchVeiculos(u.empresa, u.setor);
        if (v) setVeiculos(Object.keys(v).map((id) => ({ id })));
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os veículos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  /** Verifica conflito de horário ao mudar horário/veiculo */
  const checkConflict = async () => {
    if (!usuario || !selectedVeiculo || !data || !horaInicio || !horaFim) {
      setConflictMsg(null);
      return;
    }
    if (horaInicio >= horaFim) {
      setConflictMsg('A hora de início deve ser anterior à hora de fim.');
      return;
    }
    try {
      const agendamentos = await fetchAgendamentosVeiculo(usuario.empresa, usuario.setor, selectedVeiculo);
      if (!agendamentos) { setConflictMsg(null); return; }

      const dataBR = (() => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
      })();

      const temConflito = Object.values(agendamentos).some((ag) => {
        if (!ag || ag.status !== 'confirmado' || ag.data !== dataBR) return false;
        // Sobreposição de intervalos
        return !(horaFim <= ag.hora_inicio || horaInicio >= ag.hora_fim);
      });

      setConflictMsg(temConflito ? 'Já existe um agendamento neste horário.' : null);
    } catch {
      setConflictMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !selectedVeiculo || !data || !horaInicio || !horaFim || !motivo) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }
    if (conflictMsg) {
      toast({ variant: 'destructive', title: 'Conflito', description: conflictMsg });
      return;
    }

    const agora = new Date();
    const dataHoraInicio = new Date(`${data}T${horaInicio}`);
    if (dataHoraInicio <= agora) {
      toast({ variant: 'destructive', title: 'Data inválida', description: 'Não é possível agendar para datas ou horários passados.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const [ano, mes, dia] = data.split('-');
      const dataBR = `${dia}/${mes}/${ano}`;

      await criarAgendamento(usuario.empresa, usuario.setor, selectedVeiculo, {
        data: dataBR,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        responsavel: usuario.nome,
        matricula: usuario.mat,
        status: 'confirmado',
        veiculo: selectedVeiculo,
        motivo: motivo.trim().toUpperCase(),
      });

      toast({ title: 'Agendado!', description: `${selectedVeiculo} reservado para ${dataBR} das ${horaInicio} às ${horaFim}.` });
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
            <p className="text-sm text-muted-foreground">Reserve um veículo com antecedência</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Veículo e Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Veículo */}
              <div className="space-y-1">
                <Label htmlFor="sched-veiculo">Veículo</Label>
                <Select
                  value={selectedVeiculo}
                  onValueChange={(v) => { setSelectedVeiculo(v); setConflictMsg(null); }}
                  disabled={isLoading}
                >
                  <SelectTrigger id="sched-veiculo" className="h-12">
                    <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione o veículo'} />
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

              {/* Hora Início / Hora Fim */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sched-inicio" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Hora Início
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
                  placeholder="Ex: REUNIÃO, VISITA TÉCNICA..."
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
