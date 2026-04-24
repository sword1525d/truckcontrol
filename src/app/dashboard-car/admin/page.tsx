'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LayoutDashboard, Users, Car, Play, ClipboardCheck, LogOut, Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getCarUsuario, clearCarUsuario, type CarUsuario, CAR_RTDB_URL } from '@/lib/car-rtdb';
import { cn } from '@/lib/utils';

type Section = 'dashboard' | 'users' | 'vehicles' | 'races' | 'checklists';

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'vehicles', label: 'Veículos', icon: Car },
  { id: 'races', label: 'Corridas', icon: Play },
  { id: 'checklists', label: 'Checklists', icon: ClipboardCheck },
];

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [section, setSection] = useState<Section>('dashboard');
  const [data, setData] = useState<Record<string, any>>({});
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ users: 0, vehicles: 0, racesToday: 0, checklists: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [gallery, setGallery] = useState<{ open: boolean; images: string[]; idx: number }>({ open: false, images: [], idx: 0 });

  useEffect(() => {
    const u = getCarUsuario();
    if (!u || (!u.adm && u.role !== 'adm')) { router.replace('/dashboard-car'); return; }
    setUsuario(u);
  }, [router]);

  const fbUrl = usuario ? `${CAR_RTDB_URL}/${usuario.empresa}/${usuario.setor}` : '';

  const loadData = useCallback(async () => {
    if (!fbUrl) return;
    setIsLoading(true);
    try {
      const [resUsers, resVehicles, resRaces, resChecks] = await Promise.all([
        fetch(`${fbUrl}/users.json`).then(r => r.json()),
        fetch(`${fbUrl}/veiculos.json`).then(r => r.json()),
        fetch(`${fbUrl}/corridas.json`).then(r => r.json()),
        fetch(`${fbUrl}/relatorio.json`).then(r => r.json()),
      ]);
      const veh = resVehicles || {};
      setVehicles(veh);
      const today = new Date().toLocaleDateString('pt-BR');
      setStats({
        users: Object.keys(resUsers || {}).length,
        vehicles: Object.keys(veh).length,
        racesToday: Object.values(resRaces || {}).filter((r: any) => r?.data === today).length,
        checklists: Object.keys(resChecks || {}).length,
      });
      if (section === 'users') setData(resUsers || {});
      else if (section === 'vehicles') setData(veh);
      else if (section === 'races') setData(resRaces || {});
      else if (section === 'checklists') setData(resChecks || {});
    } catch { toast({ variant: 'destructive', title: 'Erro ao carregar dados' }); }
    finally { setIsLoading(false); }
  }, [fbUrl, section, toast]);

  useEffect(() => { if (usuario) loadData(); }, [usuario, section, loadData]);

  const pathMap: Record<Section, string> = { dashboard: '', users: 'users', vehicles: 'veiculos', races: 'corridas', checklists: 'relatorio' };

  const openModal = (id: string | null = null) => {
    setModal({ open: true, id });
    setFormData(id && data[id] ? { ...data[id], _id: id } : {});
  };

  const saveItem = async () => {
    if (!fbUrl || section === 'dashboard') return;
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

  const filtered = Object.entries(data).filter(([k, v]) =>
    JSON.stringify({ k, ...v }).toLowerCase().includes(search.toLowerCase())
  );

  if (!usuario) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FrotaControl</p>
          <p className="font-bold text-lg">Painel Admin</p>
        </div>
        <nav className="flex-1 py-4">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
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
        <header className="px-8 py-5 bg-background border-b flex items-center justify-between shrink-0">
          <h1 className="text-xl font-bold">{SECTIONS.find(s => s.id === section)?.label ?? 'Dashboard'}</h1>
          <div className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {isLoading && <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>}

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
                      <div key={id} className={cn('rounded-xl border p-4 flex flex-col gap-2 text-center hover:scale-105 transition-transform', statusColor)}>
                        <p className="font-bold text-sm">{id}</p>
                        <p className="text-xs text-muted-foreground">{v.placa || '-'}</p>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold self-center', badgeColor)}>{v.status || '-'}</span>
                        <div className="flex gap-0.5 mt-auto">
                          {[1,2,3,4].map(i => <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= gas ? gasColor : 'bg-muted')} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Table Sections */}
          {!isLoading && section !== 'dashboard' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Pesquisar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {section !== 'races' && section !== 'checklists' && (
                  <Button onClick={() => openModal()} className="gap-2"><Plus className="w-4 h-4" /> Novo</Button>
                )}
              </div>

              <div className="bg-background rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      {section === 'users' && ['Matrícula','Nome','Papel','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                      {section === 'vehicles' && ['Veículo','Placa','Status','KM','Combustível','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                      {section === 'races' && ['Data','Veículo','Motorista','Destino','Início','Fim','Status','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                      {section === 'checklists' && ['Data','Veículo','Motorista','Status','Hora','Fotos','Ações'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
                    )}
                    {filtered.map(([id, item]) => (
                      <tr key={id} className="hover:bg-muted/30 transition-colors">
                        {section === 'users' && <>
                          <td className="px-4 py-3 font-mono text-xs">{item.mat || id}</td>
                          <td className="px-4 py-3 font-medium">{item.nome}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={item.role === 'adm' ? 'border-blue-300 text-blue-700' : ''}>{item.role || 'user'}</Badge></td>
                          <td className="px-4 py-3 flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </td>
                        </>}
                        {section === 'vehicles' && <>
                          <td className="px-4 py-3 font-bold">{id}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.placa || '-'}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={item.status === 'EM MANUTENÇÃO' ? 'border-yellow-300 text-yellow-700' : item.status === 'EM CORRIDA' ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}>{item.status || '-'}</Badge></td>
                          <td className="px-4 py-3 text-sm">{item.km_rodados || '0'} km</td>
                          <td className="px-4 py-3"><div className="flex gap-0.5 w-16">{[1,2,3,4].map(i => { const g = parseInt(item.gasolina)||0; return <div key={i} className={cn('h-3 flex-1 rounded-sm', i<=g ? (g<=1?'bg-red-500':g===2?'bg-yellow-400':'bg-green-500') : 'bg-muted')} />; })}</div></td>
                          <td className="px-4 py-3 flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </td>
                        </>}
                        {section === 'races' && <>
                          <td className="px-4 py-3">{item.data}</td>
                          <td className="px-4 py-3 font-medium">{item['veículo'] || item.veiculo}</td>
                          <td className="px-4 py-3">{item.responsavel}</td>
                          <td className="px-4 py-3">{item.destino}</td>
                          <td className="px-4 py-3">{item.horario_inicio}</td>
                          <td className="px-4 py-3">{item.horario_fim || '—'}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={item.horario_fim ? 'border-green-300 text-green-700' : 'border-blue-300 text-blue-700'}>{item.horario_fim ? 'Finalizada' : 'Em andamento'}</Badge></td>
                          <td className="px-4 py-3 flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </td>
                        </>}
                        {section === 'checklists' && <>
                          <td className="px-4 py-3">{item.DATA}</td>
                          <td className="px-4 py-3 font-medium">{item.VEICULO || '-'}</td>
                          <td className="px-4 py-3">{item.RESPONSAVEL}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={['FRENTE','F_DIREITO','F_ESQUERDO','TRAS','T_DIREITO','T_ESQUERDO'].some(k => item[k] && item[k] !== 'OK') ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}>{['FRENTE','F_DIREITO','F_ESQUERDO','TRAS','T_DIREITO','T_ESQUERDO'].some(k => item[k] && item[k] !== 'OK') ? 'Atenção' : 'OK'}</Badge></td>
                          <td className="px-4 py-3">{item.HORA}</td>
                          <td className="px-4 py-3">{(item.anexos || []).length > 0 && <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setGallery({ open: true, images: item.anexos, idx: 0 })}>Ver {item.anexos.length} foto(s)</Button>}</td>
                          <td className="px-4 py-3 flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(id)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            <div className="space-y-3">
              {Object.entries(formData).filter(([k]) => k !== '_id').map(([k, v]) => (
                <div key={k}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{k}</Label>
                  <Input value={String(v ?? '')} onChange={e => setFormData(prev => ({ ...prev, [k]: e.target.value }))} />
                </div>
              ))}
              {!modal.id && section === 'users' && (
                <>
                  {['mat','nome','pass','role'].map(f => (
                    <div key={f}>
                      <Label className="text-xs text-muted-foreground mb-1 block">{f}</Label>
                      <Input value={String(formData[f] ?? '')} onChange={e => setFormData(prev => ({ ...prev, [f]: e.target.value }))} />
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <Button className="flex-1" onClick={saveItem}>Salvar</Button>
              <Button variant="outline" onClick={() => setModal({ open: false, id: null })}>Cancelar</Button>
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
    </div>
  );
}
