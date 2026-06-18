'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LayoutDashboard, Users, Car, Play, ClipboardCheck, LogOut, Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Calendar, Clock, Building2, Grid, Layers, AlertCircle, FileText, MapPin, ChevronDown, ChevronUp, Gauge, GitBranch, Navigation, Fuel, CreditCard, DollarSign, History, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getCarUsuario, clearCarUsuario, type CarUsuario, CAR_RTDB_URL, fetchEmpresas, fetchSetores, criarEmpresa, removerEmpresa, criarSetor, removerSetor, fetchGrupos, criarGrupo, removerGrupo, assignSetorToGrupo, removeSetorFromGrupo, criarAgendamento, fetchAgendamentosVeiculo, fetchTodosCartoes, registrarRecarga, finalizarAgendamento, getEffectiveStatus, updateCorridaDivergencia, type CartaoData, type CartaoRecarga } from '@/lib/car-rtdb';
import { cn } from '@/lib/utils';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Section = 'dashboard' | 'users' | 'vehicles' | 'races' | 'checklists' | 'schedules' | 'cards' | 'empresas' | 'setores' | 'grupos';

const BASE_SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'vehicles', label: 'Veículos', icon: Car },
  { id: 'races', label: 'Corridas', icon: Play },
  { id: 'checklists', label: 'Checklists', icon: ClipboardCheck },
  { id: 'schedules', label: 'Agendamentos', icon: Calendar },
  { id: 'cards', label: 'Cartoes', icon: CreditCard },
];

const OP_SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'empresas', label: 'Empresas', icon: Building2 },
  { id: 'setores', label: 'Setores', icon: Grid },
  { id: 'grupos', label: 'Grupos', icon: Layers },
];

const PAGE_SIZE = 30;

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [section, setSection] = useState<Section>('dashboard');
  const [data, setData] = useState<Record<string, any>>({});
  const [allUsers, setAllUsers] = useState<Record<string, any>>({});
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ users: 0, vehicles: 0, racesToday: 0, checklists: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // OP state
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedSetor, setSelectedSetor] = useState('');
  const [allEmpresas, setAllEmpresas] = useState<string[]>([]);
  const [allSetores, setAllSetores] = useState<string[]>([]);
  const [allGrupos, setAllGrupos] = useState<Record<string, { nome: string }>>({});
  const [grupoSetores, setGrupoSetores] = useState<Record<string, string>>({});
  const [newGrupoName, setNewGrupoName] = useState('');
  const [assignSetorData, setAssignSetorData] = useState<{ grupoId: string; setor: string } | null>(null);
  const [isOpLoading, setIsOpLoading] = useState(false);

  // Default: mes atual
  const mesAtualInicio = '2026-06-01';
  const mesAtualFim = '2026-06-17';

  // Specific filters
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRace, setFilterRace] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState(mesAtualInicio);
  const [filterDateEnd, setFilterDateEnd] = useState(mesAtualFim);
  const [filterDriver, setFilterDriver] = useState('all');

  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [newItemModal, setNewItemModal] = useState<{ open: boolean; type: 'empresa' | 'setor' | null }>({ open: false, type: null });
  const [newItemName, setNewItemName] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [gallery, setGallery] = useState<{ open: boolean; images: string[]; idx: number }>({ open: false, images: [], idx: 0 });
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [agToCancel, setAgToCancel] = useState<{ veiculo: string, id: string } | null>(null);

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleVeiculo, setScheduleVeiculo] = useState('');
  const [scheduleData, setScheduleData] = useState('');
  const [scheduleHoraInicio, setScheduleHoraInicio] = useState('');
  const [scheduleHoraFim, setScheduleHoraFim] = useState('');
  const [scheduleMotivo, setScheduleMotivo] = useState('');
  const [scheduleDriver, setScheduleDriver] = useState('');
  const [scheduleExtraDrivers, setScheduleExtraDrivers] = useState<string[]>([]);
  const [scheduleConflictMsg, setScheduleConflictMsg] = useState<string | null>(null);
  const [scheduleIsSubmitting, setScheduleIsSubmitting] = useState(false);
  const [expandedRaceKey, setExpandedRaceKey] = useState<string | null>(null);
  const [divergenciaEditingId, setDivergenciaEditingId] = useState<string | null>(null);
  const [divergenciaText, setDivergenciaText] = useState('');
  const [divergenciaSaving, setDivergenciaSaving] = useState(false);
  const [cardsData, setCardsData] = useState<Record<string, CartaoData>>({});
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardModalVehicle, setCardModalVehicle] = useState('');
  const [cardRecargaValor, setCardRecargaValor] = useState('');
  const [cardEditSaldo, setCardEditSaldo] = useState('');
  const [cardIsSubmitting, setCardIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const subtractMinutes = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number);
    const totalMin = h * 60 + m - minutes;
    const newH = Math.floor(totalMin / 60);
    const newM = totalMin % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const u = getCarUsuario();
    if (!u || (!u.adm && u.role !== 'adm' && !u.op)) { router.replace('/dashboard-car'); return; }
    setUsuario(u);
    setSelectedEmpresa(u.empresa);
    setSelectedSetor(u.setor);
  }, [router]);

  const isOP = usuario?.op === true;
  const SECTIONS = isOP ? [...BASE_SECTIONS, ...OP_SECTIONS] : BASE_SECTIONS;

  const fbUrl = (() => {
    if (!usuario) return '';
    const emp = isOP ? selectedEmpresa : usuario.empresa;
    const set = isOP ? selectedSetor : usuario.setor;
    if (!emp || !set) return '';
    return `${CAR_RTDB_URL}/${emp}/${set}`;
  })();

  // Load empresas list for OP
  useEffect(() => {
    if (!isOP) return;
    const load = async () => {
      try {
        const data = await fetchEmpresas();
        if (data) setAllEmpresas(Object.keys(data));
      } catch { /* silent */ }
    };
    load();
  }, [isOP]);

  // Load setores list for OP when empresa changes
  useEffect(() => {
    if (!isOP || !selectedEmpresa) return;
    const load = async () => {
      try {
        const data = await fetchSetores(selectedEmpresa);
        if (data) {
          const keys = Object.keys(data);
          setAllSetores(keys);
          if (!keys.includes(selectedSetor)) {
            setSelectedSetor(keys[0] || '');
          }
        } else {
          setAllSetores([]);
          setSelectedSetor('');
        }
      } catch { /* silent */ }
    };
    load();
  }, [isOP, selectedEmpresa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load grupos data for OP
  const loadGruposData = useCallback(async () => {
    if (!isOP || !selectedEmpresa) return;
    try {
      const [grupos, gsMap] = await Promise.all([
        fetchGrupos(selectedEmpresa),
        fetch(`${CAR_RTDB_URL}/${selectedEmpresa}/GRUPOS_SETORES.json`).then(r => r.json()) as Promise<Record<string, string> | null>,
      ]);
      setAllGrupos(grupos || {});
      setGrupoSetores(gsMap || {});
    } catch { /* silent */ }
  }, [isOP, selectedEmpresa]);

  useEffect(() => {
    if (section === 'grupos') loadGruposData();
  }, [section, loadGruposData]);

  const loadData = useCallback(async () => {
    if (!fbUrl) return;
    setIsLoading(true);
    try {
      if (section === 'empresas' || section === 'setores' || section === 'grupos') {
        setIsLoading(false);
        return;
      }

      // Carrega apenas os dados da secao atual para otimizar performance
      const fetchUsers = fetch(`${fbUrl}/users.json`).then(r => r.json());
      const fetchVehicles = fetch(`${fbUrl}/veiculos.json`).then(r => r.json());
      const fetchRaces = (section === 'races' || section === 'dashboard')
        ? fetch(`${fbUrl}/corridas.json`).then(r => r.json())
        : Promise.resolve(null);
      const fetchChecks = (section === 'checklists' || section === 'dashboard')
        ? fetch(`${fbUrl}/relatorio.json`).then(r => r.json())
        : Promise.resolve(null);
      const fetchSchedules = (section === 'schedules' || section === 'dashboard')
        ? fetch(`${fbUrl}/agendamentos.json`).then(r => r.json())
        : Promise.resolve(null);

      const [resUsers, resVehicles, resRaces, resChecks, resSchedules] = await Promise.all([
        fetchUsers, fetchVehicles, fetchRaces, fetchChecks, fetchSchedules,
      ]);
      const veh = resVehicles || {};
      const usr = resUsers || {};
      setVehicles(veh);
      setAllUsers(usr);
      const today = new Date().toLocaleDateString('pt-BR');
      setStats({
        users: Object.keys(usr).length,
        vehicles: Object.keys(veh).length,
        racesToday: Object.values(resRaces || {}).filter((r: any) => r?.data === today).length,
        checklists: Object.keys(resChecks || {}).length,
      });
      if (section === 'users') setData(usr);
      else if (section === 'vehicles') setData(veh);
      else if (section === 'races') setData(resRaces || {});
      else if (section === 'checklists') setData(resChecks || {});
      else if (section === 'schedules') {
        const flat: Record<string, any> = {};
        Object.entries(resSchedules || {}).forEach(([vKey, agends]: [string, any]) => {
          Object.entries(agends || {}).forEach(([aKey, ag]: [string, any]) => {
            flat[`${vKey}_${aKey}`] = { ...ag, veiculo: vKey, id: aKey };
          });
        });
        setData(flat);
      }
      else if (section === 'cards') {
        const emp = isOP ? selectedEmpresa : usuario!.empresa;
        const set = isOP ? selectedSetor : usuario!.setor;
        if (!emp || !set) return;
        const cartoes = await fetchTodosCartoes(emp, set);
        setCardsData(cartoes || {});
      }
    } catch { toast({ variant: 'destructive', title: 'Erro ao carregar dados' }); }
    finally { setIsLoading(false); }
  }, [fbUrl, section, toast]);

  useEffect(() => { if (usuario) loadData(); }, [usuario, section, selectedEmpresa, selectedSetor, loadData]);

  const pathMap: Record<Section, string> = { dashboard: '', users: 'users', vehicles: 'veiculos', races: 'corridas', checklists: 'relatorio', schedules: 'agendamentos', cards: 'cartao', empresas: '', setores: '', grupos: '' };

  const openModal = (id: string | null = null) => {
    setModal({ open: true, id });
    setFormData(id && data[id] ? { ...data[id], _id: id } : {});
  };

  const saveItem = async () => {
    if (!fbUrl || section === 'dashboard' || section === 'empresas' || section === 'setores') return;
    const { _id, ...payload } = formData;
    let id = modal.id;
    if (section === 'users') { id = payload.mat || id; delete payload.mat; }
    else if (section === 'vehicles' && !id) { id = payload.nome; delete payload.nome; }
    try {
      const res = await fetch(`${fbUrl}/${pathMap[section]}/${id}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast({ title: 'Salvo com sucesso!' });
      setModal({ open: false, id: null });
      loadData();
    } catch { toast({ variant: 'destructive', title: 'Erro ao salvar' }); }
  };

  const deleteItem = async (id: string) => {
    if (!fbUrl || !confirm('Excluir este registro?')) return;
    await fetch(`${fbUrl}/${pathMap[section]}/${id}.json`, { method: 'DELETE' });
    toast({ title: 'Removido!' });
    loadData();
  };

  // OP: empresa/setor CRUD
  const handleCreateEmpresa = async () => {
    if (!newItemName.trim()) return;
    setIsOpLoading(true);
    try {
      await criarEmpresa(newItemName.trim().toUpperCase());
      toast({ title: 'Empresa criada com sucesso!' });
      setNewItemModal({ open: false, type: null });
      setNewItemName('');
      const data = await fetchEmpresas();
      if (data) setAllEmpresas(Object.keys(data));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível criar a empresa.' });
    } finally { setIsOpLoading(false); }
  };

  const handleDeleteEmpresa = async (key: string) => {
    if (!confirm(`Remover a empresa "${key}"? Esta ação não pode ser desfeita.`)) return;
    setIsOpLoading(true);
    try {
      await removerEmpresa(key);
      toast({ title: 'Empresa removida.' });
      const data = await fetchEmpresas();
      if (data) setAllEmpresas(Object.keys(data));
      else setAllEmpresas([]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível remover a empresa.' });
    } finally { setIsOpLoading(false); }
  };

  const handleCreateSetor = async () => {
    if (!newItemName.trim() || !selectedEmpresa) return;
    setIsOpLoading(true);
    try {
      await criarSetor(selectedEmpresa, newItemName.trim().toUpperCase());
      toast({ title: 'Setor criado com sucesso!' });
      setNewItemModal({ open: false, type: null });
      setNewItemName('');
      const data = await fetchSetores(selectedEmpresa);
      if (data) setAllSetores(Object.keys(data));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível criar o setor.' });
    } finally { setIsOpLoading(false); }
  };

  const handleDeleteSetor = async (key: string) => {
    if (!confirm(`Remover o setor "${key}" da empresa ${selectedEmpresa}?`)) return;
    setIsOpLoading(true);
    try {
      await removerSetor(selectedEmpresa, key);
      toast({ title: 'Setor removido.' });
      const data = await fetchSetores(selectedEmpresa);
      if (data) setAllSetores(Object.keys(data));
      else setAllSetores([]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível remover o setor.' });
    } finally { setIsOpLoading(false); }
  };

  // Grupos handlers
  const handleCreateGrupo = async () => {
    if (!newGrupoName.trim() || !selectedEmpresa) return;
    setIsOpLoading(true);
    try {
      await criarGrupo(selectedEmpresa, newGrupoName.trim().toUpperCase());
      toast({ title: 'Grupo criado com sucesso!' });
      setNewGrupoName('');
      await loadGruposData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível criar o grupo.' });
    } finally { setIsOpLoading(false); }
  };

  const handleDeleteGrupo = async (grupoId: string) => {
    if (!confirm(`Remover o grupo "${grupoId}"?`)) return;
    setIsOpLoading(true);
    try {
      await removerGrupo(selectedEmpresa, grupoId);
      toast({ title: 'Grupo removido.' });
      await loadGruposData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível remover o grupo.' });
    } finally { setIsOpLoading(false); }
  };

  const handleAssignSetorToGrupo = async () => {
    if (!assignSetorData || !selectedEmpresa) return;
    setIsOpLoading(true);
    try {
      await assignSetorToGrupo(selectedEmpresa, assignSetorData.setor, assignSetorData.grupoId);
      toast({ title: 'Setor vinculado ao grupo!' });
      setAssignSetorData(null);
      await loadGruposData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível vincular o setor.' });
    } finally { setIsOpLoading(false); }
  };

  const handleRemoveSetorFromGrupo = async (setor: string) => {
    if (!confirm(`Remover o setor "${setor}" do grupo?`)) return;
    setIsOpLoading(true);
    try {
      await removeSetorFromGrupo(selectedEmpresa, setor);
      toast({ title: 'Setor desvinculado do grupo.' });
      await loadGruposData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível desvincular o setor.' });
    } finally { setIsOpLoading(false); }
  };

  const confirmCancel = async () => {
    if (!fbUrl || !agToCancel) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${fbUrl}/agendamentos/${agToCancel.veiculo}/${agToCancel.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelado' }),
      });
      if (res.ok) {
        toast({ title: 'Sucesso', description: 'Agendamento cancelado com sucesso.' });
        loadData();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao cancelar agendamento.' });
    } finally {
      setIsLoading(false);
      setIsCancelDialogOpen(false);
      setAgToCancel(null);
    }
  };

  const [isFinalizarDialogOpen, setIsFinalizarDialogOpen] = useState(false);
  const [agToFinalizar, setAgToFinalizar] = useState<{ veiculo: string, id: string } | null>(null);

  const confirmFinalizar = async () => {
    if (!usuario || !agToFinalizar) return;
    setIsLoading(true);
    try {
      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) throw new Error('Empresa ou setor nao definido.');
      await finalizarAgendamento(emp, set, agToFinalizar.veiculo, agToFinalizar.id);
      toast({ title: 'Sucesso', description: 'Agendamento finalizado com sucesso.' });
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao finalizar agendamento.' });
    } finally {
      setIsLoading(false);
      setIsFinalizarDialogOpen(false);
      setAgToFinalizar(null);
    }
  };

  const handleFinalizarClick = (veiculo: string, id: string) => {
    setAgToFinalizar({ veiculo, id });
    setIsFinalizarDialogOpen(true);
  };

  const handleCancelClick = (veiculo: string, id: string) => {
    setAgToCancel({ veiculo, id });
    setIsCancelDialogOpen(true);
  };

  // Schedule conflict check (matches mobile pattern)
  const checkScheduleConflict = async () => {
    if (!usuario || !scheduleVeiculo || !scheduleData || !scheduleHoraInicio || !scheduleHoraFim) {
      setScheduleConflictMsg(null);
      return;
    }
    if (scheduleHoraInicio >= scheduleHoraFim) {
      setScheduleConflictMsg('A hora de inicio deve ser anterior a hora de fim.');
      return;
    }
    try {
      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) return;
      const agendamentos = await fetchAgendamentosVeiculo(emp, set, scheduleVeiculo);
      if (!agendamentos) { setScheduleConflictMsg(null); return; }

      const dataBR = (() => {
        const [ano, mes, dia] = scheduleData.split('-');
        return `${dia}/${mes}/${ano}`;
      })();

      const temConflito = Object.values(agendamentos).some((ag) => {
        if (!ag || ag.status !== 'confirmado' || ag.data !== dataBR) return false;
        // Se o agendamento existente eh do motorista selecionado, ignora a antecedencia
        const isOwner = ag.matricula === scheduleDriver;
        const bufferInicio = isOwner ? ag.hora_inicio : subtractMinutes(ag.hora_inicio, 15);
        return !(scheduleHoraFim <= bufferInicio || scheduleHoraInicio >= ag.hora_fim);
      });

      setScheduleConflictMsg(temConflito ? 'Ja existe um agendamento neste horario.' : null);
    } catch {
      setScheduleConflictMsg(null);
    }
  };

  // Schedule submit handler
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !scheduleVeiculo || !scheduleData || !scheduleHoraInicio || !scheduleHoraFim || !scheduleMotivo) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }
    if (scheduleConflictMsg) {
      toast({ variant: 'destructive', title: 'Conflito', description: scheduleConflictMsg });
      return;
    }
    if (!scheduleDriver) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione o motorista responsavel.' });
      return;
    }

    const agora = new Date();
    const dataHoraInicio = new Date(`${scheduleData}T${scheduleHoraInicio}`);
    if (dataHoraInicio <= agora) {
      toast({ variant: 'destructive', title: 'Data invalida', description: 'Nao e possivel agendar para datas ou horarios passados.' });
      return;
    }

    setScheduleIsSubmitting(true);
    try {
      const [ano, mes, dia] = scheduleData.split('-');
      const dataBR = `${dia}/${mes}/${ano}`;

      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) throw new Error('Empresa ou setor nao definido.');

      await criarAgendamento(emp, set, scheduleVeiculo, {
        data: dataBR,
        hora_inicio: scheduleHoraInicio,
        hora_fim: scheduleHoraFim,
        responsavel: allUsers[scheduleDriver]?.nome || usuario.nome,
        matricula: scheduleDriver || usuario.mat,
        status: 'confirmado',
        veiculo: scheduleVeiculo,
        motivo: scheduleMotivo.trim().toUpperCase(),
        permitidos_extra: scheduleExtraDrivers.length > 0 ? scheduleExtraDrivers : undefined,
      });

      toast({ title: 'Agendado!', description: `${scheduleVeiculo} reservado para ${dataBR} das ${scheduleHoraInicio} as ${scheduleHoraFim}.` });
      setScheduleModalOpen(false);
      resetScheduleForm();
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao criar agendamento.' });
    } finally {
      setScheduleIsSubmitting(false);
    }
  };

  const resetScheduleForm = () => {
    setScheduleVeiculo('');
    setScheduleData('');
    setScheduleHoraInicio('');
    setScheduleHoraFim('');
    setScheduleMotivo('');
    setScheduleDriver('');
    setScheduleExtraDrivers([]);
    setScheduleConflictMsg(null);
  };

  // Cards handlers
  const handleCardRecarga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !cardModalVehicle || !cardRecargaValor) return;
    const valor = parseFloat(cardRecargaValor);
    if (isNaN(valor) || valor <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Informe um valor valido.' });
      return;
    }

    setCardIsSubmitting(true);
    try {
      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) throw new Error('Empresa ou setor nao definido.');

      const agora = new Date();
      await registrarRecarga(emp, set, cardModalVehicle, {
        valor,
        data: agora.toLocaleDateString('pt-BR'),
        hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        responsavel: usuario.nome,
      }, cardsData[cardModalVehicle]?.saldo ?? 0);

      toast({ title: 'Recarga registrada!', description: `R$ ${valor.toFixed(2)} adicionados ao cartao de ${cardModalVehicle}.` });
      setCardModalOpen(false);
      setCardModalVehicle('');
      setCardRecargaValor('');
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao registrar recarga.' });
    } finally {
      setCardIsSubmitting(false);
    }
  };

  const handleSaveDivergencia = async (raceId: string) => {
    if (!usuario || !fbUrl || !divergenciaText.trim()) return;
    setDivergenciaSaving(true);
    try {
      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) throw new Error('Empresa ou setor nao definido.');
      await updateCorridaDivergencia(emp, set, raceId, divergenciaText.trim());
      toast({ title: 'Salvo', description: 'Justificativa registrada com sucesso.' });
      setDivergenciaEditingId(null);
      setDivergenciaText('');
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao salvar justificativa.' });
    } finally {
      setDivergenciaSaving(false);
    }
  };

  const handleEditSaldo = async (veiculo: string) => {
    if (!usuario || !cardEditSaldo) return;
    const valor = parseFloat(cardEditSaldo);
    if (isNaN(valor) || valor < 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Informe um valor valido.' });
      return;
    }

    setCardIsSubmitting(true);
    try {
      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) throw new Error('Empresa ou setor nao definido.');

      const path = `${emp}/${set}/cartao/${encodeURIComponent(veiculo)}`;
      await fetch(`${CAR_RTDB_URL}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saldo: valor }),
      });

      toast({ title: 'Saldo atualizado!', description: `Saldo de ${veiculo} ajustado para R$ ${valor.toFixed(2)}.` });
      setCardEditSaldo('');
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao atualizar saldo.' });
    } finally {
      setCardIsSubmitting(false);
    }
  };

  const resetFilters = () => {
    setFilterRole('all');
    setFilterStatus('all');
    setFilterRace('all');
    setFilterDateStart(mesAtualInicio);
    setFilterDateEnd(mesAtualFim);
    setFilterDriver('all');
    setSearch('');
    setPage(1);
  };

  const changeSection = (s: Section) => {
    setSection(s);
    resetFilters();
  };

  // Filter & sort logic
  const filtered = Object.entries(data).filter(([k, v]) => {
    if (v === null) return false;
    const searchMatch = JSON.stringify({ k, ...v }).toLowerCase().includes(search.toLowerCase());
    if (!searchMatch) return false;

    if (section === 'users' && filterRole !== 'all' && v.role !== filterRole) return false;
    if (section === 'vehicles' && filterStatus !== 'all' && v.status !== filterStatus) return false;

    if (section === 'races') {
      const isFinished = !!v.horario_fim;
      if (filterRace === 'active' && isFinished) return false;
      if (filterRace === 'finished' && !isFinished) return false;
      if (filterDriver !== 'all' && v.responsavel !== filterDriver) return false;
      const recordDateStr = v.data || '';
      if ((filterDateStart || filterDateEnd) && recordDateStr.includes('/')) {
        const [d, m, y] = recordDateStr.split('/').map(Number);
        const recordDate = new Date(y, m - 1, d);
        if (filterDateStart) {
          const start = new Date(filterDateStart + 'T00:00:00');
          if (recordDate < start) return false;
        }
        if (filterDateEnd) {
          const end = new Date(filterDateEnd + 'T23:59:59');
          if (recordDate > end) return false;
        }
      } else if (filterDateStart || filterDateEnd) {
        return false;
      }
    }

    if (section === 'checklists') {
      if (filterDriver !== 'all' && v.RESPONSAVEL !== filterDriver) return false;
      const recordDateStr = v.DATA || '';
      if ((filterDateStart || filterDateEnd) && recordDateStr.includes('/')) {
        const [d, m, y] = recordDateStr.split('/').map(Number);
        const recordDate = new Date(y, m - 1, d);
        if (filterDateStart) {
          const start = new Date(filterDateStart + 'T00:00:00');
          if (recordDate < start) return false;
        }
        if (filterDateEnd) {
          const end = new Date(filterDateEnd + 'T23:59:59');
          if (recordDate > end) return false;
        }
      } else if (filterDateStart || filterDateEnd) {
        return false;
      }
    }

    return true;
  });

  const handleExport = async () => {
    if (!usuario) return;
    setIsExporting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_EXPORT_API_URL || 'http://localhost:5000';
      const emp = isOP ? selectedEmpresa : usuario.empresa;
      const set = isOP ? selectedSetor : usuario.setor;
      if (!emp || !set) return;

      const body: Record<string, string> = { empresa: emp, setor: set };
      if (filterDateStart) {
        const [y, m, d] = filterDateStart.split('-');
        body.data_inicio = `${d}/${m}/${y}`;
      }
      if (filterDateEnd) {
        const [y, m, d] = filterDateEnd.split('-');
        body.data_fim = `${d}/${m}/${y}`;
      }

      const res = await fetch(`${apiUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || 'Falha na exportacao');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corridas_${emp}_${set}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: 'Exportado!', description: 'Planilha gerada com sucesso.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na exportacao', description: err.message || 'Verifique se o servidor de exportacao esta rodando.' });
    } finally {
      setIsExporting(false);
    }
  };

  if (!usuario) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Car className="w-7 h-7 text-blue-500" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-black uppercase tracking-tight text-white">Frotacontrol</p>
                <span className="text-[10px] font-medium italic text-slate-400">by LSL</span>
              </div>
              <p className="font-bold text-lg leading-tight">Painel Admin</p>
            </div>
          </div>
          {isOP && (
            <Badge variant="outline" className="mt-2 border-amber-400/50 text-amber-400 bg-amber-400/10 text-[10px]">
              Modo OP
            </Badge>
          )}
        </div>
        <nav className="flex-1 py-4">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => changeSection(s.id)}
                className={cn('w-full flex items-center gap-3 px-6 py-3 text-sm transition-all border-l-4',
                  section === s.id ? 'border-blue-500 bg-slate-800 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}>
                <Icon className="w-4 h-4" />{s.label}
              </button>
            );
          })}
        </nav>
        <div className="p-5 border-t border-slate-700 text-xs text-slate-400 space-y-1">
          <p>{usuario.empresa} — {usuario.setor}</p>
          <p className="text-white font-medium">{usuario.nome}</p>
          <button onClick={() => { clearCarUsuario(); router.replace('/'); }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors text-xs">
            <LogOut className="w-3.5 h-3.5" /> Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-8 py-5 bg-background border-b flex items-center justify-between shrink-0 gap-4">
          <h1 className="text-xl font-bold">{SECTIONS.find(s => s.id === section)?.label ?? 'Dashboard'}</h1>
          <div className="flex items-center gap-3">
            {/* OP: empresa/setor selector */}
            {isOP && (
              <div className="flex items-center gap-2">
                <Select value={selectedEmpresa} onValueChange={v => { setSelectedEmpresa(v); setSelectedSetor(''); }}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmpresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedSetor} onValueChange={setSelectedSetor} disabled={allSetores.length === 0}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSetores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {isLoading && (section !== 'empresas' && section !== 'setores') && <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>}
          {isOpLoading && <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>}

          {/* Dashboard */}
          {!isLoading && section === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: 'Usuários', value: stats.users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Frota Total', value: stats.vehicles, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
                  { label: 'Corridas Hoje', value: stats.racesToday, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                  { label: 'Checklists', value: stats.checklists, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                ].map(s => (
                  <Card key={s.label} className="hover:-translate-y-1 transition-transform">
                    <CardContent className={cn('p-6 rounded-xl', s.bg)}>
                      <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                      <p className={cn('text-4xl font-black', s.color)}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div>
                <h2 className="text-base font-bold mb-4">Status dos Veículos</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Object.entries(vehicles).map(([id, v]: [string, any]) => {
                    const gas = parseInt(v.gasolina) || 0;
                    const statusColor = v.status === 'EM MANUTENÇÃO' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200' : v.status === 'EM CORRIDA' ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-green-50 dark:bg-green-950/20 border-green-200';
                    const badgeColor = v.status === 'EM MANUTENÇÃO' ? 'bg-yellow-100 text-yellow-700' : v.status === 'EM CORRIDA' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
                    const gasColor = gas <= 1 ? 'bg-red-500' : gas === 2 ? 'bg-yellow-400' : 'bg-green-500';
                    return (
                      <div key={id} className={cn('rounded-xl border p-4 flex flex-col gap-2 text-center hover:scale-105 transition-transform overflow-hidden', statusColor)}>
                        {v.image ? (
                          <div className="w-full h-28 mt-1 mb-1 overflow-hidden">
                            <img src={v.image} alt={id} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-full h-28 mt-1 mb-1 flex items-center justify-center">
                            <Car className="w-10 h-10 text-muted-foreground/20" />
                          </div>
                        )}
                        <p className="font-bold text-sm leading-tight">{id}</p>
                        {v.modelo && <p className="text-[10px] text-muted-foreground uppercase">{v.modelo}</p>}
                        <p className="text-[10px] font-mono text-muted-foreground">{v.placa || '-'}</p>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold self-center', badgeColor)}>{v.status || '-'}</span>
                        {v.status === 'EM CORRIDA' && v.motorista && (
                          <p className="text-[9px] text-red-600 font-bold -mt-1">com {v.motorista}</p>
                        )}
                        <div className="flex gap-0.5 mt-auto pt-1">
                          {[1,2,3,4].map(i => <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= gas ? gasColor : 'bg-muted')} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {section === 'cards' && (
              <div className="space-y-4">
                <div className="bg-background rounded-xl border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        {['Veiculo','Saldo','Recargas','Acoes'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.keys(cardsData).length === 0 && (
                        <tr><td colSpan={4} className="text-center py-10 text-muted-foreground text-sm">Nenhum cartao encontrado</td></tr>
                      )}
                      {Object.entries(cardsData).map(([veiculo, cartao]) => {
                        const recargas = cartao.recargas ? Object.entries(cartao.recargas).sort(([,a], [,b]) => {
                          const parseDate = (r: any) => {
                            if (!r) return 0;
                            const [d, m, y] = (r.data || '01/01/2000').split('/');
                            return new Date(`${y}-${m}-${d}T${r.hora || '00:00'}`).getTime();
                          };
                          return parseDate(b) - parseDate(a);
                        }) : [];
                        const isExpanded = expandedCardKey === veiculo;
                        const saldo = cartao.saldo ?? 0;

                        return (
                          <React.Fragment key={veiculo}>
                            <tr
                              className="hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => setExpandedCardKey(isExpanded ? null : veiculo)}
                            >
                              <td className="px-4 py-3 font-bold">{veiculo}</td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  'font-mono font-bold text-sm',
                                  saldo > 0 ? 'text-green-600' : saldo < 0 ? 'text-red-600' : 'text-muted-foreground'
                                )}>
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {recargas.length > 0 ? (
                                  <Badge variant="outline" className="gap-1 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                                    <History className="w-3 h-3" />
                                    {recargas.length}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">&mdash;</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-xs"
                                    onClick={(e) => { e.stopPropagation(); setCardModalVehicle(veiculo); setCardRecargaValor(''); setCardModalOpen(true); }}
                                  >
                                    <Plus className="w-3 h-3" /> Recarga
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 text-xs"
                                    onClick={(e) => { e.stopPropagation(); setCardEditSaldo(String(saldo)); }}
                                  >
                                    <DollarSign className="w-3 h-3" /> Ajustar
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-muted/20 border-b">
                                <td colSpan={4} className="px-6 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <History className="w-3.5 h-3.5" /> Historico de Recargas
                                      </p>
                                      <div className="bg-background rounded-lg border divide-y max-h-48 overflow-y-auto">
                                        {recargas.length === 0 ? (
                                          <p className="text-xs text-muted-foreground p-3 text-center">Nenhuma recarga registrada</p>
                                        ) : (
                                          recargas.map(([recId, rec]) => (
                                            <div key={recId} className="p-3 flex justify-between items-center">
                                              <div>
                                                <p className="text-xs text-muted-foreground">{rec.data} as {rec.hora}</p>
                                                <p className="text-[11px] text-muted-foreground italic">{rec.responsavel}</p>
                                              </div>
                                              <span className="font-mono font-bold text-green-600 text-sm">
                                                +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rec.valor)}
                                              </span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <DollarSign className="w-3.5 h-3.5" /> Ajustar Saldo
                                      </p>
                                      <div className="bg-background rounded-lg border p-3 space-y-2">
                                        <div className="flex gap-2">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Novo saldo"
                                            value={cardEditSaldo}
                                            onChange={(e) => setCardEditSaldo(e.target.value)}
                                            className="h-9"
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleEditSaldo(veiculo); }}
                                          />
                                          <Button
                                            size="sm"
                                            className="h-9"
                                            disabled={cardIsSubmitting || !cardEditSaldo}
                                            onClick={() => handleEditSaldo(veiculo)}
                                          >
                                            {cardIsSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                                          </Button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Define o saldo diretamente. Use com cautela.</p>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* OP Empresas Section */}
          {isOP && section === 'empresas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">Total: {allEmpresas.length} empresa(s)</p>
                <Button onClick={() => { setNewItemModal({ open: true, type: 'empresa' }); setNewItemName(''); }} className="gap-2"><Plus className="w-4 h-4" /> Nova Empresa</Button>
              </div>
              <div className="bg-background rounded-xl border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allEmpresas.length === 0 && <tr><td colSpan={2} className="text-center py-10 text-muted-foreground text-sm">Nenhuma empresa cadastrada</td></tr>}
                    {allEmpresas.map(e => (
                      <tr key={e} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold">{e}</td>
                        <td className="px-4 py-3">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteEmpresa(e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OP Setores Section */}
          {isOP && section === 'setores' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Empresa:</span>
                  <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {allEmpresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">({allSetores.length} setores)</span>
                </div>
                <Button onClick={() => { setNewItemModal({ open: true, type: 'setor' }); setNewItemName(''); }} className="gap-2"><Plus className="w-4 h-4" /> Novo Setor</Button>
              </div>
              <div className="bg-background rounded-xl border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Setor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allSetores.length === 0 && <tr><td colSpan={2} className="text-center py-10 text-muted-foreground text-sm">Nenhum setor cadastrado</td></tr>}
                    {allSetores.map(s => (
                      <tr key={s} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold">{s}</td>
                        <td className="px-4 py-3">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSetor(s)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OP Grupos Section */}
          {isOP && section === 'grupos' && (
            <div className="space-y-6">
              {/* Create Grupo */}
              <div className="bg-background rounded-xl border p-6 shadow-sm">
                <h3 className="text-base font-bold mb-4">Criar Novo Grupo</h3>
                <div className="flex gap-3">
                  <Input
                    placeholder="Nome do grupo (ex: GRUPO-A)"
                    value={newGrupoName}
                    onChange={e => setNewGrupoName(e.target.value.toUpperCase())}
                    className="flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateGrupo(); }}
                  />
                  <Button onClick={handleCreateGrupo} disabled={isOpLoading || !newGrupoName.trim()} className="gap-2">
                    {isOpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar Grupo
                  </Button>
                </div>
              </div>

              {/* Vincular Setor a Grupo */}
              <div className="bg-background rounded-xl border p-6 shadow-sm">
                <h3 className="text-base font-bold mb-4">Vincular Setor a Grupo</h3>
                <div className="flex gap-3 flex-wrap">
                  <Select value={assignSetorData?.grupoId ?? ''} onValueChange={v => setAssignSetorData(prev => prev ? { ...prev, grupoId: v } : { grupoId: v, setor: '' })}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione o grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(allGrupos).map(g => <SelectItem key={g} value={g}>{allGrupos[g]?.nome || g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={assignSetorData?.setor ?? ''} onValueChange={v => setAssignSetorData(prev => prev ? { ...prev, setor: v } : { grupoId: '', setor: v })} disabled={allSetores.length === 0}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSetores.map(s => (
                        <SelectItem key={s} value={s} disabled={!!grupoSetores[s]}>
                          {s}{grupoSetores[s] ? ` (já em ${allGrupos[grupoSetores[s]]?.nome || grupoSetores[s]})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssignSetorToGrupo} disabled={isOpLoading || !assignSetorData?.grupoId || !assignSetorData?.setor} className="gap-2">
                    Vincular
                  </Button>
                </div>
              </div>

              {/* Lista de Grupos e seus Setores */}
              <div className="bg-background rounded-xl border shadow-sm">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="text-base font-bold">Grupos Existentes</h3>
                </div>
                {Object.keys(allGrupos).length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">Nenhum grupo cadastrado.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {Object.entries(allGrupos).map(([grupoId, grupo]) => {
                      const setoresDoGrupo = Object.entries(grupoSetores)
                        .filter(([, g]) => g === grupoId)
                        .map(([s]) => s);
                      return (
                        <div key={grupoId} className="p-6 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Layers className="w-5 h-5 text-primary" />
                              <div>
                                <p className="font-bold text-lg">{grupo.nome || grupoId}</p>
                                <p className="text-xs text-muted-foreground">{setoresDoGrupo.length} setor(es) vinculado(s)</p>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={() => handleDeleteGrupo(grupoId)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover Grupo
                            </Button>
                          </div>
                          {setoresDoGrupo.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic ml-8">Nenhum setor vinculado a este grupo.</p>
                          ) : (
                            <div className="ml-8 flex flex-wrap gap-2">
                              {setoresDoGrupo.map(s => (
                                <Badge key={s} variant="secondary" className="gap-1.5 py-1 pr-1 pl-2.5">
                                  {s}
                                  <button
                                    onClick={() => handleRemoveSetorFromGrupo(s)}
                                    className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5 hover:text-destructive transition-colors"
                                    title={`Desvincular ${s}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Sections */}
          {!isLoading && section !== 'dashboard' && section !== 'empresas' && section !== 'setores' && section !== 'grupos' && (() => {
            const allFiltered = Object.entries(data).filter(([k, v]) => {
              if (v === null) return false;

              const searchMatch = JSON.stringify({ k, ...v }).toLowerCase().includes(search.toLowerCase());
              if (!searchMatch) return false;

              if (section === 'users' && filterRole !== 'all' && v.role !== filterRole) return false;
              if (section === 'vehicles' && filterStatus !== 'all' && v.status !== filterStatus) return false;

              if (section === 'races') {
                const isFinished = !!v.horario_fim;
                if (filterRace === 'active' && isFinished) return false;
                if (filterRace === 'finished' && !isFinished) return false;
                if (filterDriver !== 'all' && v.responsavel !== filterDriver) return false;

                const recordDateStr = v.data || '';
                if ((filterDateStart || filterDateEnd) && recordDateStr.includes('/')) {
                  const [d, m, y] = recordDateStr.split('/').map(Number);
                  const recordDate = new Date(y, m - 1, d);
                  if (filterDateStart) {
                    const start = new Date(filterDateStart + 'T00:00:00');
                    if (recordDate < start) return false;
                  }
                  if (filterDateEnd) {
                    const end = new Date(filterDateEnd + 'T23:59:59');
                    if (recordDate > end) return false;
                  }
                } else if (filterDateStart || filterDateEnd) {
                  return false;
                }
              }

              if (section === 'checklists' || section === 'schedules') {
                const driverKey = section === 'checklists' ? 'RESPONSAVEL' : 'responsavel';
                if (filterDriver !== 'all' && v[driverKey] !== filterDriver) return false;

                const dateKey = section === 'checklists' ? 'DATA' : 'data';
                const recordDateStr = v[dateKey] || '';
                if ((filterDateStart || filterDateEnd) && recordDateStr.includes('/')) {
                  const [d, m, y] = recordDateStr.split('/').map(Number);
                  const recordDate = new Date(y, m - 1, d);
                  if (filterDateStart) {
                    const start = new Date(filterDateStart + 'T00:00:00');
                    if (recordDate < start) return false;
                  }
                  if (filterDateEnd) {
                    const end = new Date(filterDateEnd + 'T23:59:59');
                    if (recordDate > end) return false;
                  }
                } else if (filterDateStart || filterDateEnd) {
                  return false;
                }
              }

              return true;
            }).sort((a, b) => {
              const valA = a[1];
              const valB = b[1];

              if (section === 'races' || section === 'checklists' || section === 'schedules') {
                const dateKey = section === 'checklists' ? 'DATA' : 'data';
                const timeKey = section === 'races' ? 'horario_inicio' : (section === 'checklists' ? 'HORA' : 'hora_inicio');

                const strA = valA[dateKey] || '';
                const strB = valB[dateKey] || '';

                if (!strA.includes('/') || !strB.includes('/')) {
                  return strB.localeCompare(strA);
                }

                const [dA, mA, yA] = strA.split('/').map(Number);
                const [dB, mB, yB] = strB.split('/').map(Number);
                const dateA = new Date(yA, mA - 1, dA);
                const dateB = new Date(yB, mB - 1, dB);

                if (dateA.getTime() !== dateB.getTime()) {
                  return dateB.getTime() - dateA.getTime();
                }

                const timeA = valA[timeKey] || '00:00';
                const timeB = valB[timeKey] || '00:00';
                return timeB.localeCompare(timeA);
              }

              return b[0].localeCompare(a[0]);
            });

            // KM divergence detection for races
            const divergenceMap: Record<string, { prevKmFinal: number; currKmInicial: number; gap: number }> = {};
            if (section === 'races') {
              const racesByVehicle: Record<string, { id: string; km_inicial: number; km_final: number; hora: string }[]> = {};
              allFiltered.forEach(([id, v]) => {
                const veiculo = v['veículo'] || v.veiculo || '';
                if (!racesByVehicle[veiculo]) racesByVehicle[veiculo] = [];
                racesByVehicle[veiculo].push({
                  id,
                  km_inicial: parseFloat(v.km_inicial) || 0,
                  km_final: parseFloat(v.km_final) || 0,
                  hora: v.horario_inicio || '',
                });
              });
              Object.values(racesByVehicle).forEach((races) => {
                races.sort((a, b) => a.km_inicial - b.km_inicial);
                for (let i = 1; i < races.length; i++) {
                  const prev = races[i - 1];
                  const curr = races[i];
                  if (prev.km_final > 0 && curr.km_inicial > 0 && prev.km_final !== curr.km_inicial) {
                    divergenceMap[curr.id] = {
                      prevKmFinal: prev.km_final,
                      currKmInicial: curr.km_inicial,
                      gap: curr.km_inicial - prev.km_final,
                    };
                  }
                }
              });
            }

            const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
            const paginated = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 bg-background p-4 rounded-xl border shadow-sm">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Pesquisar..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>

                  {section === 'users' && (
                    <Select value={filterRole} onValueChange={v => { setFilterRole(v); setPage(1); }}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Papel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Papéis</SelectItem>
                        <SelectItem value="user">Motorista (user)</SelectItem>
                        <SelectItem value="adm">Administrador (adm)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {section === 'vehicles' && (
                    <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="NO ESTACIONAMENTO">No Estacionamento</SelectItem>
                        <SelectItem value="EM CORRIDA">Em Corrida</SelectItem>
                        <SelectItem value="EM MANUTENÇÃO">Em Manutenção</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {(section === 'races' || section === 'checklists' || section === 'schedules') && (
                    <>
                      <Select value={filterDriver} onValueChange={v => { setFilterDriver(v); setPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Motorista" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Motoristas</SelectItem>
                          {Object.values(allUsers).map((u: any) => (
                            <SelectItem key={u.mat || u.nome} value={u.nome}>{u.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Período:</Label>
                        <Input
                          type="date"
                          className="w-[150px] h-9 text-xs"
                          value={filterDateStart}
                          onChange={e => { setFilterDateStart(e.target.value); setPage(1); }}
                        />
                        <span className="text-muted-foreground">à</span>
                        <Input
                          type="date"
                          className="w-[150px] h-9 text-xs"
                          value={filterDateEnd}
                          onChange={e => { setFilterDateEnd(e.target.value); setPage(1); }}
                        />
                      </div>
                    </>
                  )}

                  {section === 'races' && (
                    <Select value={filterRace} onValueChange={v => { setFilterRace(v); setPage(1); }}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Corridas</SelectItem>
                        <SelectItem value="active">Em Andamento</SelectItem>
                        <SelectItem value="finished">Finalizadas</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <div className="ml-auto flex gap-2">
                    {section === 'races' && (
                      <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        variant="outline"
                        className="gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Exportar Excel
                      </Button>
                    )}
                    {section !== 'races' && section !== 'checklists' && section !== 'cards' && (
                      <Button onClick={() => {
                        if (section === 'schedules') {
                          resetScheduleForm();
                          setScheduleModalOpen(true);
                        } else {
                          openModal();
                        }
                      }} className="gap-2"><Plus className="w-4 h-4" /> Novo</Button>
                    )}
                  </div>
                </div>

                <div className="bg-background rounded-xl border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        {section === 'users' && ['Matrícula','Nome','Papel','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                        {section === 'vehicles' && ['Veículo','Placa','Status','KM','Combustível','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                        {section === 'races' && ['Data','Veículo','Motorista','Destino','Paradas','Início','Fim','Status',''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                        {section === 'checklists' && ['Data','Veículo','Motorista','Status','Hora','Fotos','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                        {section === 'schedules' && ['Data','Veículo','Motorista','Início','Fim','Status','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginated.length === 0 && (
                        <tr><td colSpan={section === 'users' ? 4 : section === 'vehicles' ? 6 : section === 'races' ? 9 : section === 'checklists' ? 7 : section === 'schedules' ? 7 : 8} className="text-center py-10 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
                      )}
                      {paginated.map(([id, item]) => {
                        if (section === 'races') {
                          return (() => {
                            const raceDesvios = item.desvios;
                            const hasDesvios = Array.isArray(raceDesvios) && raceDesvios.length > 0;
                            const isExpanded = expandedRaceKey === id;
                            const isActive = !item.horario_fim;
                            const kmInicial = parseFloat(item.km_inicial) || 0;
                            const kmFinal = parseFloat(item.km_final) || 0;
                            const distancia = kmFinal > kmInicial ? (kmFinal - kmInicial).toFixed(1) : null;

                            const divInfo = section === 'races' ? divergenceMap[id] : null;
                            return (
                              <React.Fragment key={id}>
                                {/* Divergence row */}
                                {divInfo && !divergenciaEditingId && (
                                  <tr className="bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500">
                                    <td colSpan={9} className="px-4 py-2.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                        <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                                          Divergência de KM detectada:
                                        </span>
                                        <span className="text-xs text-red-600 dark:text-red-400 font-mono">
                                          KM final anterior: <strong>{divInfo.prevKmFinal.toLocaleString('pt-BR')}</strong>
                                          {' → '}
                                          KM inicial atual: <strong>{divInfo.currKmInicial.toLocaleString('pt-BR')}</strong>
                                        </span>
                                        <Badge variant="outline" className={divInfo.gap > 0 ? 'border-red-300 text-red-700 bg-red-100 dark:bg-red-900/20' : 'border-amber-300 text-amber-700 bg-amber-100 dark:bg-amber-900/20'}>
                                          {divInfo.gap > 0 ? '+' : ''}{divInfo.gap.toFixed(1)} km
                                        </Badge>
                                        {item.divergencia ? (
                                          <span className="text-[11px] text-muted-foreground italic ml-2">
                                            Justificativa: &ldquo;{item.divergencia}&rdquo;
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setDivergenciaEditingId(id); setDivergenciaText(item.divergencia || ''); }}
                                              className="ml-1.5 text-primary hover:underline text-[10px] font-medium"
                                            >editar</button>
                                          </span>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[10px] px-2 ml-2 border-red-300 text-red-700 hover:bg-red-100 dark:hover:bg-red-950"
                                            onClick={(e) => { e.stopPropagation(); setDivergenciaEditingId(id); setDivergenciaText(''); }}
                                          >
                                            <Pencil className="w-3 h-3 mr-1" />
                                            Adicionar Justificativa
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {/* Divergence edit row */}
                                {divInfo && divergenciaEditingId === id && (
                                  <tr className="bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500">
                                    <td colSpan={9} className="px-4 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                        <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                                          Divergência de KM: KM final ant. {divInfo.prevKmFinal.toLocaleString('pt-BR')} {'→'} KM inicial atual {divInfo.currKmInicial.toLocaleString('pt-BR')} ({divInfo.gap > 0 ? '+' : ''}{divInfo.gap.toFixed(1)} km)
                                        </span>
                                        <Input
                                          className="flex-1 h-7 text-xs max-w-[320px]"
                                          placeholder="Justificativa da divergência..."
                                          value={divergenciaText}
                                          onChange={(e) => { e.stopPropagation(); setDivergenciaText(e.target.value); }}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSaveDivergencia(id); } }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Button
                                          size="sm"
                                          className="h-7 text-[10px] px-2"
                                          disabled={divergenciaSaving || !divergenciaText.trim()}
                                          onClick={(e) => { e.stopPropagation(); handleSaveDivergencia(id); }}
                                        >
                                          {divergenciaSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                          Salvar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-[10px] px-2"
                                          onClick={(e) => { e.stopPropagation(); setDivergenciaEditingId(null); setDivergenciaText(''); }}
                                        >
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                <tr
                                  key={id}
                                  className={cn(
                                    'hover:bg-muted/30 transition-colors cursor-pointer',
                                    isActive && 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10'
                                  )}
                                  onClick={() => { setDivergenciaEditingId(null); setExpandedRaceKey(isExpanded ? null : id); }}
                                >
                                  <td className="px-4 py-3">{item.data}</td>
                                  <td className="px-4 py-3 font-medium">{item['veiculo'] || item.veiculo}</td>
                                  <td className="px-4 py-3">{item.responsavel}</td>
                                  <td className="px-4 py-3 max-w-[140px] truncate" title={item.destino}>{item.destino}</td>
                                  <td className="px-4 py-3">
                                    {hasDesvios ? (
                                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800 gap-1 font-mono">
                                        <GitBranch className="w-3 h-3" />
                                        {raceDesvios.length}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">&mdash;</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs">{item.horario_inicio}</td>
                                  <td className="px-4 py-3 font-mono text-xs">{item.horario_fim || '—'}</td>
                                  <td className="px-4 py-3">
                                    <Badge variant="outline" className={item.horario_fim ? 'border-green-300 text-green-700' : 'border-blue-300 text-blue-700'}>
                                      {item.horario_fim ? 'Finalizada' : 'Em andamento'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr key={`${id}-detail`} className="bg-muted/20 border-b">
                                    <td colSpan={9} className="px-6 py-4">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* KM Info */}
                                        <div className="space-y-2">
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <Gauge className="w-3.5 h-3.5" /> Quilometragem
                                          </p>
                                          <div className="bg-background rounded-lg border p-3 space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                              <span className="text-muted-foreground">Inicial</span>
                                              <span className="font-mono font-bold">{kmInicial.toLocaleString('pt-BR')} km</span>
                                            </div>
                                            {item.horario_fim && (
                                              <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Final</span>
                                                <span className="font-mono font-bold">{kmFinal.toLocaleString('pt-BR')} km</span>
                                              </div>
                                            )}
                                            {distancia && (
                                              <div className="flex justify-between text-xs border-t pt-1.5 mt-1">
                                                <span className="text-muted-foreground">Percorrido</span>
                                                <span className="font-mono font-bold text-green-600">{distancia} km</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Gasolina */}
                                        <div className="space-y-2">
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <Fuel className="w-3.5 h-3.5" /> Combustivel
                                          </p>
                                          <div className="bg-background rounded-lg border p-3">
                                            {item.gasolina ? (
                                              <div className="flex items-center gap-2">
                                                <div className="flex gap-0.5 flex-1 h-5">
                                                  {[1,2,3,4].map(i => {
                                                    const g = parseInt(item.gasolina) || 0;
                                                    return (
                                                      <div key={i} className={cn(
                                                        'h-full flex-1 rounded-sm transition-colors',
                                                        i <= g
                                                          ? (g <= 1 ? 'bg-red-500' : g === 2 ? 'bg-yellow-400' : 'bg-green-500')
                                                          : 'bg-muted'
                                                      )} />
                                                    );
                                                  })}
                                                </div>
                                                <span className="text-xs font-bold text-muted-foreground">
                                                  {['', 'Vazio', '¼', '½', 'Cheio'][parseInt(item.gasolina)] || item.gasolina}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">Nao informado</span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Acoes */}
                                        <div className="space-y-2">
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acoes</p>
                                          <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); openModal(id); }}>
                                              <Pencil className="w-3 h-3" /> Editar
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); deleteItem(id); }}>
                                              <Trash2 className="w-3 h-3" /> Excluir
                                            </Button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Route Timeline */}
                                      <div className="mt-4 pt-4 border-t">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                          <Navigation className="w-3.5 h-3.5" /> Rota da Corrida
                                        </p>
                                        <div className="space-y-0">
                                          {/* Origem (saida) */}
                                          <div className="flex items-start gap-3 pb-2">
                                            <div className="flex flex-col items-center">
                                              <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0 ring-2 ring-blue-100 dark:ring-blue-900" />
                                              <div className="w-0.5 flex-1 min-h-[16px] bg-blue-200 dark:bg-blue-800 mt-0.5" />
                                            </div>
                                            <div className="flex-1 min-w-0 pb-1">
                                              <p className="text-sm font-semibold truncate">{item.destino}</p>
                                              <p className="text-[11px] text-muted-foreground">{item.horario_inicio} — Saida</p>
                                            </div>
                                          </div>

                                          {/* Desvios - sem hora */}
                                          {hasDesvios && raceDesvios.map((d, i) => (
                                            <div key={i} className="flex items-start gap-3 pb-2">
                                              <div className="flex flex-col items-center">
                                                <div className="w-3 h-3 rounded-full bg-orange-400 shrink-0 ring-2 ring-orange-100 dark:ring-orange-900" />
                                                {i < raceDesvios.length - 1 || item.horario_fim ? (
                                                  <div className="w-0.5 flex-1 min-h-[16px] bg-orange-200 dark:bg-orange-800 mt-0.5" />
                                                ) : (
                                                  <div className="w-0.5 flex-1 min-h-[16px] bg-orange-200/50 dark:bg-orange-800/50 mt-0.5" style={{ borderStyle: 'dashed' }} />
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0 pb-1">
                                                <p className="text-sm font-medium truncate">{d.destino}</p>
                                              </div>
                                            </div>
                                          ))}

                                          {/* Chegada (fim) */}
                                          {item.horario_fim && (
                                            <div className="flex items-start gap-3">
                                              <div className="flex flex-col items-center">
                                                <div className="w-3 h-3 rounded-full bg-green-500 shrink-0 ring-2 ring-green-100 dark:ring-green-900" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-green-700 dark:text-green-300">Chegada ao destino</p>
                                                <p className="text-[11px] text-muted-foreground">{item.horario_fim}</p>
                                              </div>
                                            </div>
                                          )}

                                          {/* Active indicator when still in progress */}
                                          {!item.horario_fim && (
                                            <div className="flex items-start gap-3">
                                              <div className="flex flex-col items-center">
                                                <div className="w-3 h-3 rounded-full border-2 border-dashed border-blue-400 animate-pulse shrink-0" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse">Em andamento...</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })();
                        }
                        return (
                          <tr key={id} className="hover:bg-muted/30 transition-colors">
                            {section === 'users' && <>
                            <td className="px-4 py-3 font-mono text-xs">{item.mat || id}</td>
                            <td className="px-4 py-3 font-medium">{item.nome}</td>
                            <td className="px-4 py-3"><Badge variant="outline" className={item.role === 'adm' ? 'border-blue-300 text-blue-700' : (item.op ? 'border-amber-300 text-amber-700' : '')}>{item.role || (item.op ? 'op' : 'user')}</Badge></td>
                            <td className="px-4 py-3 flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </td>
                          </>}
                          {section === 'vehicles' && <>
                            <td className="px-4 py-3 font-bold">{id}</td>
                            <td className="px-4 py-3 font-mono text-xs">{item.placa || '-'}</td>
                            <td className="px-4 py-3"><Badge variant="outline" className={item.status === 'EM MANUTENCAO' ? 'border-yellow-300 text-yellow-700' : item.status === 'EM CORRIDA' ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}>{item.status || '-'}</Badge></td>
                            <td className="px-4 py-3 text-sm">{item.km_rodados || '0'} km</td>
                            <td className="px-4 py-3"><div className="flex gap-0.5 w-16">{[1,2,3,4].map(i => { const g = parseInt(item.gasolina)||0; return <div key={i} className={cn('h-3 flex-1 rounded-sm', i<=g ? (g<=1?'bg-red-500':g===2?'bg-yellow-400':'bg-green-500') : 'bg-muted')} />; })}</div></td>
                            <td className="px-4 py-3 flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </td>
                          </>}
                          {section === 'checklists' && <>
                            <td className="px-4 py-3">{item.DATA}</td>
                            <td className="px-4 py-3 font-medium">{item.VEICULO || '-'}</td>
                            <td className="px-4 py-3">{item.RESPONSAVEL}</td>
                            <td className="px-4 py-3"><Badge variant="outline" className={['FRENTE','F_DIREITO','F_ESQUERDO','TRAS','T_DIREITO','T_ESQUERDO'].some(k => item[k] && item[k] !== 'OK') ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}>{['FRENTE','F_DIREITO','F_ESQUERDO','TRAS','T_DIREITO','T_ESQUERDO'].some(k => item[k] && item[k] !== 'OK') ? 'Atencao' : 'OK'}</Badge></td>
                            <td className="px-4 py-3">{item.HORA}</td>
                            <td className="px-4 py-3">{(item.anexos || []).length > 0 && <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setGallery({ open: true, images: item.anexos, idx: 0 })}>Ver {item.anexos.length} foto(s)</Button>}</td>
                            <td className="px-4 py-3 flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </td>
                          </>}
                          {section === 'schedules' && <>
                            <td className="px-4 py-3">{item.data}</td>
                            <td className="px-4 py-3 font-medium">{item.veiculo}</td>
                            <td className="px-4 py-3">{item.responsavel}</td>
                            <td className="px-4 py-3 font-mono text-xs">{item.hora_inicio}</td>
                            <td className="px-4 py-3 font-mono text-xs">{item.hora_fim}</td>
                            <td className="px-4 py-3">{(() => { const effStatus = getEffectiveStatus(item); return <Badge variant="outline" className={effStatus === 'cancelado' ? 'border-red-300 text-red-700' : effStatus === 'finalizado' ? 'border-blue-300 text-blue-700' : 'border-green-300 text-green-700'}>{effStatus.toUpperCase()}</Badge>; })()}</td>
                            <td className="px-4 py-3 flex gap-1">
                              {item.status !== 'cancelado' && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Cancelar Agendamento" onClick={() => handleCancelClick(item.veiculo, item.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </td>
                          </>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="px-4 py-3 bg-muted/20 border-t flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">Mostrando {paginated.length} de {allFiltered.length} registros</p>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="h-8 px-2"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span className="hidden sm:inline ml-1">Anterior</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .map((p, i, arr) => {
                              const showEllipsis = i > 0 && p !== arr[i-1] + 1;
                              return (
                                <div key={p} className="flex items-center gap-1">
                                  {showEllipsis && <span className="text-muted-foreground px-1 text-xs">...</span>}
                                  <Button
                                    variant={p === page ? "default" : "outline"}
                                    size="sm"
                                    className={cn("h-8 w-8 p-0 text-xs", p === page ? "pointer-events-none" : "")}
                                    onClick={() => setPage(p)}
                                  >
                                    {p}
                                  </Button>
                                </div>
                              );
                            })
                          }
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="h-8 px-2"
                        >
                          <span className="hidden sm:inline mr-1">Próximo</span>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{modal.id ? 'Editar' : 'Novo'} Registro</h2>
              <Button size="icon" variant="ghost" onClick={() => setModal({ open: false, id: null })}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              {section === 'users' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="user-mat">Matrícula</Label>
                    <Input id="user-mat" disabled={!!modal.id} value={formData.mat || modal.id || ''} onChange={e => setFormData(p => ({ ...p, mat: e.target.value }))} placeholder="Ex: 12345" />
                    <p className="text-[10px] text-muted-foreground">Identificador único do colaborador.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="user-nome">Nome Completo</Label>
                    <Input id="user-nome" value={formData.nome || ''} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do motorista" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="user-pass">Senha</Label>
                    <Input id="user-pass" value={formData.pass || ''} onChange={e => setFormData(p => ({ ...p, pass: e.target.value }))} placeholder="Senha de acesso" />
                    <p className="text-[10px] text-muted-foreground">Mínimo de 4 caracteres recomendados.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Papel / Permissão</Label>
                    <Select value={formData.role || 'user'} onValueChange={v => setFormData(p => ({ ...p, role: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Motorista (Acesso Comum)</SelectItem>
                        <SelectItem value="adm">Administrador (Acesso Total)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Veículos Permitidos</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-1.5 bg-muted/20">
                      {Object.entries(vehicles).length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum veículo cadastrado no setor.</p>
                      )}
                      {Object.entries(vehicles).map(([id, v]: [string, any]) => {
                        const placa = v.placa || id;
                        const checked = Array.isArray(formData.permitidos) && formData.permitidos.includes(placa);
                        return (
                          <label key={id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1.5 py-1 transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setFormData(p => {
                                  const current = Array.isArray(p.permitidos) ? [...p.permitidos] : [];
                                  if (current.includes(placa)) {
                                    return { ...p, permitidos: current.filter(x => x !== placa) };
                                  }
                                  return { ...p, permitidos: [...current, placa] };
                                });
                              }}
                              className="h-3.5 w-3.5 rounded"
                            />
                            <span className="text-xs">{id}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{placa}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Selecione os veículos que este usuário pode dirigir. Se nenhum for selecionado, todos são permitidos (padrão).</p>
                  </div>
                  {isOP && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <input
                        type="checkbox"
                        id="user-op"
                        checked={!!formData.op}
                        onChange={e => setFormData(p => ({ ...p, op: e.target.checked }))}
                        className="h-4 w-4 rounded border-amber-300"
                      />
                      <Label htmlFor="user-op" className="text-sm font-medium">OP (Operador de Sistema)</Label>
                    </div>
                  )}
                </>
              )}

              {section === 'vehicles' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="veh-id">Identificador</Label>
                    <Input id="veh-id" disabled={!!modal.id} value={formData.nome || modal.id || ''} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: V-01" />
                    <p className="text-[10px] text-muted-foreground">Ex: V-01, Carro 01, etc.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="veh-modelo">Modelo</Label>
                    <Input id="veh-modelo" value={formData.modelo || ''} onChange={e => setFormData(p => ({ ...p, modelo: e.target.value.toUpperCase() }))} placeholder="Ex: HONDA CITY" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="veh-placa">Placa</Label>
                    <Input id="veh-placa" value={formData.placa || ''} onChange={e => setFormData(p => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC-1234" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="veh-foto">Link da Foto</Label>
                    <Input id="veh-foto" value={formData.image || ''} onChange={e => setFormData(p => ({ ...p, image: e.target.value }))} placeholder="https://exemplo.com/foto.jpg" />
                    <p className="text-[10px] text-muted-foreground">Cole o link de uma imagem para o veículo.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="veh-km">KM Atual</Label>
                    <Input id="veh-km" type="number" value={formData.km_rodados || ''} onChange={e => setFormData(p => ({ ...p, km_rodados: e.target.value }))} placeholder="0" />
                    <p className="text-[10px] text-muted-foreground">Quilometragem total registrada.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Nível de Combustível</Label>
                    <Select value={String(formData.gasolina || '4')} onValueChange={v => setFormData(p => ({ ...p, gasolina: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1/4 (Reserva/Baixo)</SelectItem>
                        <SelectItem value="2">2/4 (Meio Tanque)</SelectItem>
                        <SelectItem value="3">3/4 (Quase Cheio)</SelectItem>
                        <SelectItem value="4">4/4 (Tanque Cheio)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Status Atual</Label>
                    <Select value={formData.status || 'NO ESTACIONAMENTO'} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO ESTACIONAMENTO">Disponível</SelectItem>
                        <SelectItem value="EM CORRIDA">Em Viagem</SelectItem>
                        <SelectItem value="EM MANUTENÇÃO">Em Manutenção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {section !== 'users' && section !== 'vehicles' && (
                Object.entries(formData).filter(([k]) => k !== '_id').map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs text-muted-foreground mb-1 block capitalize">{k.replace(/_/g, ' ')}</Label>
                    <Input value={String(v ?? '')} onChange={e => setFormData(prev => ({ ...prev, [k]: e.target.value }))} />
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <Button className="flex-1" onClick={saveItem}>Salvar</Button>
              <Button variant="outline" onClick={() => setModal({ open: false, id: null })}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Novo Agendamento</h2>
              <Button size="icon" variant="ghost" onClick={() => { setScheduleModalOpen(false); resetScheduleForm(); }}><X className="w-4 h-4" /></Button>
            </div>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              {/* Veiculo */}
              <div className="space-y-1">
                <Label htmlFor="sched-veiculo" className="flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-primary" /> Veiculo
                </Label>
                <Select
                  value={scheduleVeiculo}
                  onValueChange={(v) => { setScheduleVeiculo(v); setScheduleConflictMsg(null); }}
                >
                  <SelectTrigger id="sched-veiculo" className="h-12">
                    <SelectValue placeholder="Selecione o veiculo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(vehicles).map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
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
                  value={scheduleData}
                  onChange={(e) => { setScheduleData(e.target.value); setScheduleConflictMsg(null); }}
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
                    value={scheduleHoraInicio}
                    onChange={(e) => { setScheduleHoraInicio(e.target.value); setScheduleConflictMsg(null); }}
                    onBlur={checkScheduleConflict}
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
                    value={scheduleHoraFim}
                    onChange={(e) => { setScheduleHoraFim(e.target.value); setScheduleConflictMsg(null); }}
                    onBlur={checkScheduleConflict}
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
                  value={scheduleMotivo}
                  onChange={(e) => setScheduleMotivo(e.target.value.toUpperCase())}
                  className="h-12 font-medium"
                />
              </div>

              {/* Motorista Responsavel */}
              <div className="space-y-1">
                <Label htmlFor="sched-driver" className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Motorista Responsavel
                </Label>
                <Select
                  value={scheduleDriver}
                  onValueChange={(v) => setScheduleDriver(v)}
                >
                  <SelectTrigger id="sched-driver" className="h-12">
                    <SelectValue placeholder="Selecione o motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(allUsers).map(([mat, u]: [string, any]) => (
                      <SelectItem key={mat} value={mat}>{u.nome || mat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Motoristas Adicionais Permitidos */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" /> Motoristas Adicionais Permitidos
                </Label>
                <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1 bg-muted/20">
                  {Object.entries(allUsers)
                    .filter(([mat]) => mat !== scheduleDriver)
                    .map(([mat, u]: [string, any]) => {
                      const checked = scheduleExtraDrivers.includes(mat);
                      return (
                        <label key={mat} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1.5 py-1 transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setScheduleExtraDrivers(prev =>
                                prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat]
                              );
                            }}
                            className="h-3.5 w-3.5 rounded"
                          />
                          <span className="text-xs">{u.nome || mat}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-auto">{mat}</span>
                        </label>
                      );
                    })}
                  {Object.keys(allUsers).length <= 1 && (
                    <p className="text-xs text-muted-foreground p-2">Nenhum outro motorista cadastrado no setor.</p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Esses motoristas tambem poderao iniciar corrida neste horario.</p>
              </div>

              {/* Conflict warning */}
              {scheduleConflictMsg && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{scheduleConflictMsg}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 h-12 font-bold"
                  disabled={scheduleIsSubmitting || !!scheduleConflictMsg}
                >
                  {scheduleIsSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                  CONFIRMAR AGENDAMENTO
                </Button>
                <Button type="button" variant="outline" className="h-12" onClick={() => { setScheduleModalOpen(false); resetScheduleForm(); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

            {/* Card Recarga Modal */}
      {cardModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Nova Recarga</h2>
              <Button size="icon" variant="ghost" onClick={() => { setCardModalOpen(false); setCardModalVehicle(''); setCardRecargaValor(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCardRecarga} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Veiculo</Label>
                <p className="font-bold text-lg">{cardModalVehicle}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="recarga-valor">Valor da Recarga (R$)</Label>
                <Input
                  id="recarga-valor"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Ex: 100.00"
                  value={cardRecargaValor}
                  onChange={(e) => setCardRecargaValor(e.target.value)}
                  className="h-12 text-xl font-bold"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Saldo atual: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cardsData[cardModalVehicle]?.saldo ?? 0)}
              </p>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 h-12 font-bold" disabled={cardIsSubmitting || !cardRecargaValor}>
                  {cardIsSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  REGISTRAR RECARGA
                </Button>
                <Button type="button" variant="outline" className="h-12" onClick={() => { setCardModalOpen(false); setCardModalVehicle(''); setCardRecargaValor(''); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* New Item Modal (empresa/setor) */}
      {newItemModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{newItemModal.type === 'empresa' ? 'Nova Empresa' : 'Novo Setor'}</h2>
              <Button size="icon" variant="ghost" onClick={() => setNewItemModal({ open: false, type: null })}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="new-item-name">{newItemModal.type === 'empresa' ? 'Nome da Empresa' : 'Nome do Setor'}</Label>
                <Input
                  id="new-item-name"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value.toUpperCase())}
                  placeholder={newItemModal.type === 'empresa' ? 'Ex: EMPRESA-X' : 'Ex: SETOR-A'}
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">
                  {newItemModal.type === 'empresa'
                    ? 'Identificador único da empresa. Use letras maiúsculas.'
                    : newItemModal.type === 'setor' && selectedEmpresa
                      ? `Será criado dentro de "${selectedEmpresa}".`
                      : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button className="flex-1" disabled={isOpLoading || !newItemName.trim()} onClick={newItemModal.type === 'empresa' ? handleCreateEmpresa : handleCreateSetor}>
                {isOpLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
              <Button variant="outline" onClick={() => setNewItemModal({ open: false, type: null })}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      {gallery.open && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center">
          <button className="absolute top-6 right-6 text-white text-3xl" onClick={() => setGallery(g => ({ ...g, open: false }))}><X /></button>
          <img src={gallery.images[gallery.idx]} alt="Foto" className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl" />
          <div className="flex items-center gap-4 mt-4 text-white">
            <button onClick={() => setGallery(g => ({ ...g, idx: (g.idx - 1 + g.images.length) % g.images.length }))}><ChevronLeft className="w-8 h-8" /></button>
            <span className="text-sm">{gallery.idx + 1} / {gallery.images.length}</span>
            <button onClick={() => setGallery(g => ({ ...g, idx: (g.idx + 1) % g.images.length }))}><ChevronRight className="w-8 h-8" /></button>
          </div>
        </div>
      )}

      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancelará a reserva deste veículo. O motorista será notificado caso consulte a agenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
