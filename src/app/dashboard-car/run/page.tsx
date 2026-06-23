'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Car, Loader2, MapPin, Milestone, AlertCircle, ClipboardCheck } from 'lucide-react';
import {
  getCarUsuario,
  fetchVeiculos,
  fetchVeiculosPermitidos,
  fetchVeiculosMultiSetor,
  fetchVeiculosPermitidosMultiSetor,
  fetchCorridas,
  criarCorrida,
  updateVeiculo,
  updateUsuarioStatus,
  veiculoEmCorridaAtiva,
  agendamentoAtivoAgora,
  agendamentoAntecedencia,
  fetchAgendamentosVeiculo,
  verificarChecklistHoje,
  type CarUsuario,
  type CarVeiculo,
  CAR_RTDB_URL,
} from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';

type VeiculoOpt = { id: string; nome: string; placa: string; km?: string | number; status?: string };

export default function CarRunPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [selectedVeiculo, setSelectedVeiculo] = useState('');
  const [destino, setDestino] = useState('');
  const [quilometragem, setQuilometragem] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [veiculoBlockMsg, setVeiculoBlockMsg] = useState<string | null>(null);
  const [checklistOk, setChecklistOk] = useState<boolean | null>(null);
  const [checklistMotivo, setChecklistMotivo] = useState('');
  const [checklistLoading, setChecklistLoading] = useState(true);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);
  }, [router]);

  // Verificar checklist obrigatorio
  useEffect(() => {
    if (!usuario) return;
    const check = async () => {
      setChecklistLoading(true);
      try {
        const result = await verificarChecklistHoje(
          usuario.empresa,
          usuario.setor,
          usuario.mat,
          usuario.nome,
          usuario.setoresGrupo
        );
        setChecklistOk(result.ok);
        setChecklistMotivo(result.motivo);
      } catch {
        setChecklistOk(false);
        setChecklistMotivo('Erro ao verificar checklist.');
      } finally {
        setChecklistLoading(false);
      }
    };
    check();
  }, [usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega veículos permitidos ao usuário
  useEffect(() => {
    if (!usuario) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const isGrupo = usuario.setoresGrupo && usuario.setoresGrupo.length > 0;
        const setores = isGrupo ? usuario.setoresGrupo! : [usuario.setor];

        // Fetch user permitidos first
        let permitidos: string[] = [];
        try {
          const userData = await fetch(
            `${CAR_RTDB_URL}/${usuario.empresa}/${usuario.setor}/users/${usuario.mat}.json`,
            { cache: 'no-store' }
          ).then((r) => r.json());
          permitidos = userData?.permitidos ?? [];
        } catch { /* ignore */ }

        // Fetch vehicles: if permitidos is empty, fetch all; otherwise filter
        let all: Record<string, CarVeiculo> | null;
        if (isGrupo) {
          all = await fetchVeiculosMultiSetor(usuario.empresa, setores);
        } else if (permitidos.length > 0) {
          all = await fetchVeiculosPermitidos(usuario.empresa, usuario.setor, permitidos);
        } else {
          all = await fetchVeiculos(usuario.empresa, usuario.setor);
        }

        if (all) {
          const opts: VeiculoOpt[] = Object.entries(all)
            .filter(([, v]) => v)
            .map(([id, v]) => ({
              id,
              nome: id,
              placa: v.placa ?? id.split('/').pop() ?? id,
              km: v.km_rodados,
              status: v.status,
            }));
          setVeiculos(opts);
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os veículos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [usuario, toast]);

  // Valida veículo selecionado
  useEffect(() => {
    if (!selectedVeiculo || !usuario) return;
    const validate = async () => {
      setIsValidating(true);
      setVeiculoBlockMsg(null);
      setQuilometragem('');

      try {
        // Resolve setor/veiculo from selected ID
        const parts = selectedVeiculo.split('/');
        const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
        const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : selectedVeiculo;

        const agora = new Date();
        const dataAtual = agora.toLocaleDateString('pt-BR');
        const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Verificar agendamentos
        const agendamentos = await fetchAgendamentosVeiculo(usuario.empresa, targetSetor, targetVeiculo);
        const agendAtivo = agendamentoAtivoAgora(agendamentos);
        if (agendAtivo) {
          const extraPermitidos: string[] = agendAtivo.permitidos_extra || [];
          if (agendAtivo.matricula !== usuario.mat && !extraPermitidos.includes(usuario.mat)) {
            setVeiculoBlockMsg(`Reservado por ${agendAtivo.responsavel} até ${agendAtivo.hora_fim}`);
            setIsValidating(false);
            return;
          }
        }

        // Verificar agendamento proximo (15 min de antecedencia)
        const agendProximo = agendamentoAntecedencia(agendamentos, usuario.mat, 15);
        if (agendProximo) {
          setVeiculoBlockMsg(
            `Veiculo reservado para ${agendProximo.responsavel} as ${agendProximo.hora_inicio}. Aguarde o inicio do agendamento ou a liberacao.`
          );
          setIsValidating(false);
          return;
        }

        // Verificar corridas ativas
        const corridas = await fetchCorridas(usuario.empresa, targetSetor);
        const corridaAtiva = veiculoEmCorridaAtiva(corridas, targetVeiculo);
        if (corridaAtiva) {
          if (corridaAtiva.responsavel !== usuario.nome) {
            setVeiculoBlockMsg(`Veículo em uso por ${corridaAtiva.responsavel}`);
            setIsValidating(false);
            return;
          } else {
            setVeiculoBlockMsg('Você já tem uma corrida ativa com este veículo.');
            setIsValidating(false);
            return;
          }
        }

        // Preenche km com o último registrado
        const veiculo = veiculos.find((v) => v.id === selectedVeiculo);
        if (veiculo?.km) setQuilometragem(String(veiculo.km));

        // Verifica status
        if (veiculo?.status === 'EM MANUTENÇÃO') {
          setVeiculoBlockMsg('Veículo em manutenção. Indisponível.');
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao verificar veículo.' });
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [selectedVeiculo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !selectedVeiculo || !destino || !quilometragem) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }
    if (veiculoBlockMsg) {
      toast({ variant: 'destructive', title: 'Veículo bloqueado', description: veiculoBlockMsg });
      return;
    }

    setIsSubmitting(true);
    try {
      // Resolve setor/veiculo from selected ID (handles grupo prefix like "SETOR-A/V-01")
      const parts = selectedVeiculo.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : selectedVeiculo;

      const agora = new Date();
      const novaCorrida = {
        data: agora.toLocaleDateString('pt-BR'),
        destino: destino.trim().toUpperCase(),
        horario_inicio: agora.toLocaleTimeString('pt-BR'),
        km_inicial: quilometragem,
        responsavel: usuario.nome,
        'veículo': targetVeiculo,
      };

      await criarCorrida(usuario.empresa, targetSetor, novaCorrida);
      await updateVeiculo(usuario.empresa, targetSetor, targetVeiculo, {
        status: 'EM CORRIDA',
        motorista: usuario.nome,
        destino: destino.trim().toUpperCase(),
        km_rodados: quilometragem,
      });
      await updateUsuarioStatus(usuario.empresa, usuario.mat, { em_corrida: true });

      toast({ title: 'Corrida iniciada!', description: `Destino: ${destino.trim().toUpperCase()}` });
      router.push('/dashboard-car');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !!selectedVeiculo && !!destino && !!quilometragem && !veiculoBlockMsg && !isValidating;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => { router.replace('/'); }} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-lg pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Iniciar Corrida</h1>
            {usuario?.setor && <p className="text-sm text-primary font-medium">Setor: {usuario.setor}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Checklist obrigatorio */}
          {checklistOk === false && !checklistLoading && (
            <Card className="border-t-4 border-t-amber-500 shadow-md bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      Checklist obrigatorio nao realizado hoje
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      {checklistMotivo || 'Voce precisa preencher o checklist diario antes de iniciar qualquer corrida.'}
                    </p>
                    <Link
                      href="/dashboard-car/checklist"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Ir para o Checklist
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {checklistLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando checklist do dia...
            </div>
          )}
          {/* Veículo */}
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="veiculo" className="text-sm font-bold flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" /> 1. SELECIONE O VEÍCULO
                </Label>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando veículos...
                  </div>
                ) : (
                  <Select value={selectedVeiculo} onValueChange={setSelectedVeiculo}>
                    <SelectTrigger id="veiculo" className="h-12 text-base">
                      <SelectValue placeholder="Toque para escolher" />
                    </SelectTrigger>
                    <SelectContent>
                      {veiculos.map((v) => (
                        <SelectItem key={v.id} value={v.id} disabled={v.status === 'EM MANUTENÇÃO'}>
                          {v.nome} — {v.placa} {v.status === 'EM MANUTENÇÃO' ? '(MANUTENÇÃO)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {isValidating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando disponibilidade...
                  </div>
                )}

                {veiculoBlockMsg && (
                  <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{veiculoBlockMsg}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Destino + KM */}
          {selectedVeiculo && !veiculoBlockMsg && !isValidating && (
            <Card className="shadow-md animate-in fade-in slide-in-from-bottom-4 duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="destino" className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> 2. DESTINO
                  </Label>
                  <Input
                    id="destino"
                    placeholder="Para onde vai?"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value.toUpperCase())}
                    className="h-12 text-base font-bold uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="km" className="text-sm font-bold flex items-center gap-2">
                    <Milestone className="w-4 h-4 text-primary" /> 3. QUILOMETRAGEM ATUAL
                  </Label>
                  <Input
                    id="km"
                    type="number"
                    inputMode="numeric"
                    placeholder="KM atual no painel"
                    value={quilometragem}
                    onChange={(e) => setQuilometragem(e.target.value)}
                    className="h-12 text-xl font-bold"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-base font-bold"
            disabled={!canSubmit || isSubmitting || checklistOk === false}
            title={checklistOk === false ? 'Preencha o checklist diario antes de iniciar uma corrida' : undefined}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            INICIAR CORRIDA
          </Button>
        </form>
      </main>
    </div>
  );
}
