'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Calendar, Car, Clock, ChevronDown, ChevronUp, FilterX, Search } from 'lucide-react';
import {
  getCarUsuario,
  fetchTodosAgendamentos,
  type CarUsuario,
  type CarAgendamento,
} from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AgendEntry = { key: string; veiculo: string } & CarAgendamento;

export default function ViewSchedulePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  
  const hojeInput = new Date().toISOString().split('T')[0];
  const [filterDateStart, setFilterDateStart] = useState<string>(hojeInput);
  const [filterDateEnd, setFilterDateEnd] = useState<string>(hojeInput);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const deferredStart = useDeferredValue(filterDateStart);
  const deferredEnd = useDeferredValue(filterDateEnd);
  const deferredQuery = useDeferredValue(filterQuery);

  const isFiltering = filterQuery !== deferredQuery || filterDateStart !== deferredStart || filterDateEnd !== deferredEnd;

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchTodosAgendamentos(u.empresa, u.setor);
        if (data) {
          const list: AgendEntry[] = [];
          Object.entries(data).forEach(([veiculo, agends]) => {
            if (!agends) return;
            Object.entries(agends).forEach(([key, ag]) => {
              if (ag) list.push({ key: `${veiculo}-${key}`, veiculo, ...ag });
            });
          });
          // Sort by data desc
          list.sort((a, b) => {
            const toMs = (ag: AgendEntry) => {
              const [d, m, y] = (ag.data || '01/01/2000').split('/');
              return new Date(`${y}-${m}-${d}T${ag.hora_inicio ?? '00:00'}`).getTime();
            };
            return toMs(b) - toMs(a);
          });
          setAgendamentos(list);
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os agendamentos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const displayed = agendamentos.filter((a) => {
    if (deferredStart || deferredEnd) {
      const [d, m, y] = (a.data || '01/01/2000').split('/');
      const itemDate = new Date(`${y}-${m}-${d}T00:00:00`).getTime();
      
      if (deferredStart) {
         const start = new Date(`${deferredStart}T00:00:00`).getTime();
         if (itemDate < start) return false;
      }
      if (deferredEnd) {
         const end = new Date(`${deferredEnd}T23:59:59`).getTime();
         if (itemDate > end) return false;
      }
    }
    if (deferredQuery) {
      const q = deferredQuery.toLowerCase();
      const match = a.responsavel?.toLowerCase().includes(q) || a.veiculo?.toLowerCase().includes(q) || a.matricula?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-2xl pb-24">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                type="text"
                placeholder="Buscar motorista, matrícula ou veículo..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-10 h-11 bg-card border-border/60 focus-visible:ring-primary shadow-sm rounded-xl font-medium"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <div className="flex items-center gap-1 bg-card border-border/60 shadow-sm rounded-xl px-2 h-11 shrink-0">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider ml-1">De</span>
                <Input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="h-8 w-[130px] border-none shadow-none focus-visible:ring-0 p-0 px-1 bg-transparent font-medium"
                />
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Até</span>
                <Input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="h-8 w-[130px] border-none shadow-none focus-visible:ring-0 p-0 px-1 bg-transparent font-medium"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl border-border/60 shadow-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors relative"
                onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterQuery(''); }}
                title="Limpar filtros"
              >
                {isFiltering ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <FilterX className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center px-1">
             <span className="text-xs text-muted-foreground flex items-center gap-1.5">
               {isFiltering ? (
                 <><Loader2 className="h-3 w-3 animate-spin text-primary" /> Filtrando...</>
               ) : (
                 `${displayed.length} resultados encontrados`
               )}
             </span>
             <button
               onClick={() => { setFilterDateStart(hojeInput); setFilterDateEnd(hojeInput); setFilterQuery(usuario?.nome ?? ''); }}
               className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold"
             >
               Ver meus agendamentos de hoje →
             </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum agendamento encontrado.</div>
        ) : (
          <div className="space-y-2">
            {displayed.map((ag) => {
              const isExpanded = expandedKey === ag.key;
              const statusColor = ag.status === 'confirmado'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-muted text-muted-foreground';

              return (
                <Card key={ag.key} className="shadow-sm cursor-pointer" onClick={() => setExpandedKey(isExpanded ? null : ag.key)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{ag.veiculo}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ag.data} · {ag.hora_inicio}–{ag.hora_fim}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor)}>
                          {ag.status.toUpperCase()}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-muted-foreground animate-in fade-in">
                        <div><span className="font-semibold text-foreground">Responsável:</span> {ag.responsavel}</div>
                        <div><span className="font-semibold text-foreground">Matrícula:</span> {ag.matricula}</div>
                        {ag.motivo && <div className="col-span-2"><span className="font-semibold text-foreground">Motivo:</span> {ag.motivo}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
