'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Car, Play, StopCircle, Eye, Clock, ClipboardCheck,
  Fuel, BarChart2, Download, LogOut, Calendar, Wrench,
  Loader2, RefreshCw, CreditCard, Shield, UserCheck,
} from 'lucide-react';
import {
  getCarUsuario,
  clearCarUsuario,
  fetchVeiculos,
  fetchVeiculosMultiSetor,
  fetchCorridasMultiSetor,
  fetchTodosAgendamentos,
  fetchAgendamentosMultiSetor,
  agendamentoAtivoAgora,
  type CarUsuario,
  type CarVeiculo,
  type CarCorrida,
  type CarAgendamento,
  veiculoEmCorridaAtiva,
  fetchTodosCartoes,
} from '@/lib/car-rtdb';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CarHeader } from '@/components/car-header';

type VehicleStatus = {
  id: string;
  nome: string;
  placa: string;
  status: string;
  motorista?: string;
  gasolina?: number | string;
  km?: string | number;
  saldo?: number;
  classe: 'disponivel' | 'em-corrida' | 'manutencao' | 'agendado';
  agendamento?: CarAgendamento;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  badge?: number;
};

export default function DashboardCarPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [vehicles, setVehicles] = useState<VehicleStatus[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [temCorridaAtiva, setTemCorridaAtiva] = useState(false);
  const [agendamentosCount, setAgendamentosCount] = useState(0);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);
  }, [router]);

  const loadData = async (u: CarUsuario) => {
    setIsLoadingVehicles(true);
    try {
      const isGrupo = u.setoresGrupo && u.setoresGrupo.length > 0;
      const setores = isGrupo ? u.setoresGrupo! : [u.setor];

      const [veiculosData, corridasData, agendamentosData] = await Promise.all([
        isGrupo
          ? fetchVeiculosMultiSetor(u.empresa, setores)
          : fetchVeiculos(u.empresa, u.setor),
        isGrupo
          ? fetchCorridasMultiSetor(u.empresa, setores)
          : fetch(
              `https://lslcda-default-rtdb.firebaseio.com/${u.empresa}/${u.setor}/corridas.json`,
              { cache: 'no-store' }
            ).then((r) => r.json() as Promise<Record<string, CarCorrida> | null>),
        isGrupo
          ? fetchAgendamentosMultiSetor(u.empresa, setores)
          : fetchTodosAgendamentos(u.empresa, u.setor),
      ]);

      // Verifica corrida ativa do usuário
      if (corridasData) {
        const corridaAtiva = Object.values(corridasData).some(
          (c: any) => c && c.responsavel === u.nome && !c.horario_fim
        );
        setTemCorridaAtiva(corridaAtiva);
      }

      // Conta agendamentos do usuário
      if (agendamentosData) {
        let count = 0;
        for (const agsVeiculo of Object.values(agendamentosData)) {
          if (!agsVeiculo) continue;
          for (const ag of Object.values(agsVeiculo)) {
            if (ag && ag.matricula === u.mat && ag.status === 'confirmado') count++;
          }
        }
        setAgendamentosCount(count);
      }

      if (veiculosData) {
        // Carrega cartões para todos os setores
        let cartoesData: Record<string, any> = {};
        for (const setor of setores) {
          try {
            const cartoes = await fetchTodosCartoes(u.empresa, setor);
            if (cartoes) Object.assign(cartoesData, cartoes);
          } catch { /* ignore */ }
        }

        const statuses: VehicleStatus[] = Object.entries(veiculosData).map(([id, v]) => {
          const vehicleName = id.includes('/') ? id.split('/').slice(1).join('/') : id;
          const corridaVeiculo = corridasData ? veiculoEmCorridaAtiva(corridasData, vehicleName) : null;

          // Busca agendamento ativo para este veículo
          const agendamentosVeiculo = agendamentosData?.[id] ?? null;
          const agendAtivo = agendamentoAtivoAgora(agendamentosVeiculo);

          let classe: VehicleStatus['classe'] = 'disponivel';
          let status = 'DISPONÍVEL';
          if (v.status === 'EM MANUTENÇÃO') { classe = 'manutencao'; status = 'MANUTENÇÃO'; }
          else if (corridaVeiculo) { classe = 'em-corrida'; status = 'EM CORRIDA'; }
          else if (agendAtivo && agendAtivo.matricula !== u.mat) { classe = 'agendado'; status = 'AGENDADO'; }
          // Se o agendamento é do próprio usuário, fica como DISPONÍVEL para ele

          return {
            id,
            nome: id,
            placa: v.placa ?? id.split('/').pop() ?? id,
            status,
            motorista: corridaVeiculo?.responsavel || (agendAtivo?.matricula !== u.mat ? agendAtivo?.responsavel : undefined),
            gasolina: v.gasolina,
            km: v.km_rodados,
            saldo: cartoesData?.[vehicleName]?.saldo ?? 0,
            classe,
            agendamento: agendAtivo ?? undefined,
          };
        });
        setVehicles(statuses);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  useEffect(() => {
    if (!usuario) return;
    loadData(usuario);
    const interval = setInterval(() => loadData(usuario), 30_000);
    return () => clearInterval(interval);
  }, [usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    clearCarUsuario();
    router.replace('/');
  };

  const sections: NavSection[] = [
    {
      title: 'Corridas',
      items: [
        { id: 'iniciar-corrida', href: '/dashboard-car/run', label: 'Iniciar Corrida', icon: Play, disabled: temCorridaAtiva },
        { id: 'encerrar-corrida', href: '/dashboard-car/active-run', label: 'Encerrar Corrida', icon: StopCircle, disabled: !temCorridaAtiva },
        { id: 'visualizar-corridas', href: '/dashboard-car/view-runs', label: 'Visualizar Corridas', icon: Eye },
      ],
    },
    {
      title: 'Agendamentos',
      items: [
        { id: 'agendar-corrida', href: '/dashboard-car/schedule', label: 'Agendar Corrida', icon: Calendar },
        { id: 'ver-agendamentos', href: '/dashboard-car/view-schedule', label: 'Ver Agendamentos', icon: Clock, badge: agendamentosCount || undefined },
      ],
    },
    {
      title: 'Checklist',
      items: [
        { id: 'preencher-checklist', href: '/dashboard-car/checklist', label: 'Preencher Checklist', icon: ClipboardCheck },
        { id: 'ver-checklist', href: '/dashboard-car/view-checklist', label: 'Visualizar Checklist', icon: Eye },
      ],
    },
    {
      title: 'Abastecimento',
      items: [
        { id: 'registrar-abastecimento', href: '/dashboard-car/refuel', label: 'Registrar Abastecimento', icon: Fuel },
        { id: 'ver-abastecimento', href: '/dashboard-car/view-refuel', label: 'Visualizar Abastecimento', icon: Eye },
        { id: 'cartao-abastecimento', href: '/dashboard-car/card', label: 'Cartão de Abastecimento', icon: CreditCard },
      ],
    },
    {
      title: 'Veículos',
      items: [
        { id: 'consultar-veiculo', href: '/dashboard-car/view-vehicle', label: 'Consultar Veículo', icon: Car },
      ],
    },
    ...(usuario?.adm || usuario?.role === 'adm' || usuario?.op ? [{
      title: 'Administração',
      items: [
        { id: 'painel-admin', href: '/dashboard-car/admin', label: 'Painel Admin', icon: Shield },
      ],
    }] : []),
    {
      title: 'Conta',
      items: [
        { id: 'logout', href: '#', label: 'Sair', icon: LogOut },
      ],
    },
  ];

  if (!usuario) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-background flex flex-col flex-grow min-h-screen">
      <CarHeader usuario={usuario} onLogout={handleLogout} />

      <main className="flex-grow">
        {/* Vehicle Status Section */}
        <section className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Status dos Veículos
            </h2>
            <button
              onClick={() => loadData(usuario)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {isLoadingVehicles ? (
              <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : vehicles.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Nenhum veículo cadastrado</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-border">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Nav Sections */}
        <div className="px-4 pb-8 sm:px-6 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {section.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isLogout = item.id === 'logout';

                  if (isLogout) {
                    return (
                      <button
                        key={item.id}
                        id={item.id}
                        onClick={handleLogout}
                        className="group relative bg-card border rounded-xl h-24 p-3.5 flex flex-col justify-between items-start shadow-sm hover:bg-destructive/5 hover:border-destructive/40 transition-all text-left"
                      >
                        <div className="p-2 bg-destructive/10 rounded-lg group-hover:bg-destructive/20 transition-colors">
                          <Icon className="h-5 w-5 text-destructive group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-sm text-foreground group-hover:text-destructive transition-colors font-semibold leading-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.id}
                      href={item.disabled ? '#' : item.href}
                      id={item.id}
                      className={cn(
                        'group relative bg-card border rounded-xl h-24 p-3.5 flex flex-col justify-between items-start shadow-sm transition-all',
                        item.disabled
                          ? 'opacity-40 cursor-not-allowed pointer-events-none grayscale'
                          : 'hover:bg-accent/30 hover:border-primary/40 hover:shadow-md'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg transition-colors',
                        item.disabled ? 'bg-muted' : 'bg-primary/10 group-hover:bg-primary/15'
                      )}>
                        <Icon className={cn(
                          'h-5 w-5 transition-transform',
                          item.disabled ? 'text-muted-foreground' : 'text-primary group-hover:scale-110'
                        )} />
                      </div>
                      <span className={cn(
                        'text-sm transition-colors font-semibold leading-tight',
                        item.disabled ? 'text-muted-foreground' : 'text-foreground group-hover:text-primary'
                      )}>
                        {item.label}
                      </span>
                      {item.badge && item.badge > 0 && (
                        <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                          {item.badge}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: VehicleStatus }) {
  const gasLevel = typeof vehicle.gasolina === 'string'
    ? parseInt(vehicle.gasolina)
    : (vehicle.gasolina ?? 0);

  const gasPercent = Math.max(0, Math.min(100, (gasLevel / 4) * 100));
  const gasColor = gasPercent >= 75 ? '#22c55e' : gasPercent >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className={cn(
      'bg-card p-3 flex flex-col gap-1.5',
    )}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-foreground truncate">{vehicle.nome}</span>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white',
          vehicle.classe === 'disponivel' && 'bg-green-500',
          vehicle.classe === 'em-corrida' && 'bg-red-500',
          vehicle.classe === 'manutencao' && 'bg-amber-500',
          vehicle.classe === 'agendado' && 'bg-purple-500',
        )}>
          {vehicle.status === 'DISPONÍVEL' ? 'DISP.' : vehicle.status === 'EM CORRIDA' ? 'CORRIDA' : vehicle.status === 'MANUTENÇÃO' ? 'MANUT.' : 'AGEND.'}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">{vehicle.placa} {vehicle.km ? `· ${vehicle.km} km` : ''}</span>
      {vehicle.motorista && (
        <span className="text-[10px] text-muted-foreground italic truncate">{vehicle.motorista}</span>
      )}
      {vehicle.agendamento && (
        <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
          <UserCheck className="w-3 h-3" />
          <span className="truncate">{vehicle.agendamento.responsavel}</span>
          <span>{vehicle.agendamento.hora_inicio} - {vehicle.agendamento.hora_fim}</span>
        </div>
      )}

      <div className="flex items-center gap-1 mt-0.5">
        <CreditCard className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.saldo || 0)}
        </span>
      </div>

      {/* Gas bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${gasPercent}%`, backgroundColor: gasColor }}
        />
      </div>
    </div>
  );
}
