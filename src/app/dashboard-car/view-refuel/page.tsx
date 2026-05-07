'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Fuel, ChevronDown, ChevronUp, FilterX, Search } from 'lucide-react';
import { getCarUsuario, type CarUsuario, CAR_RTDB_URL } from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';
import { useToast } from '@/hooks/use-toast';

type RefuelEntry = {
  key: string;
  veiculo: string;
  responsavel: string;
  data: string;
  horario: string;
  litros: number;
  valor: number;
};

export default function ViewRefuelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [refuels, setRefuels] = useState<RefuelEntry[]>([]);
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
        const isGrupo = u.setoresGrupo && u.setoresGrupo.length > 0;
        const setores = isGrupo ? u.setoresGrupo! : [u.setor];
        let allData: Record<string, RefuelEntry> = {};
        for (const setor of setores) {
          const res = await fetch(
            `${CAR_RTDB_URL}/${u.empresa}/${setor}/abastecimentos.json`,
            { cache: 'no-store' }
          );
          const setorData = await res.json();
          if (setorData) Object.assign(allData, setorData);
        }
        const data = Object.keys(allData).length > 0 ? allData : null;
        if (data) {
          const list: RefuelEntry[] = Object.entries(data as Record<string, RefuelEntry>)
            .filter(([, r]) => r != null)
            .map(([key, r]) => ({ ...r, key }))
            .sort((a, b) => {
              const parseDate = (r: RefuelEntry) => {
                const [d, m, y] = (r.data || '01/01/2000').split('/');
                return new Date(`${y}-${m}-${d}T${r.horario ?? '00:00'}`).getTime();
              };
              return parseDate(b) - parseDate(a);
            });
          setRefuels(list);
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os abastecimentos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const displayed = refuels.filter((r) => {
    if (deferredStart || deferredEnd) {
      const [d, m, y] = (r.data || '01/01/2000').split('/');
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
      const match = r.responsavel?.toLowerCase().includes(q) || r.veiculo?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalLitros = displayed.reduce((sum, r) => sum + (r.litros ?? 0), 0);
  const totalValor = displayed.reduce((sum, r) => sum + (r.valor ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-2xl pb-24">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Abastecimentos</h1>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                type="text"
                placeholder="Buscar motorista ou veículo..."
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
               Ver meus abastecimentos de hoje →
             </button>
          </div>
        </div>

        {/* Summary */}
        {!isLoading && displayed.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Litros</p>
                <p className="text-xl font-bold">{totalLitros.toFixed(1)} L</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Gasto</p>
                <p className="text-xl font-bold">R$ {totalValor.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum abastecimento registrado.</div>
        ) : (
          <div className="space-y-2">
            {displayed.map((r) => {
              const isExpanded = expandedKey === r.key;
              return (
                <Card key={r.key} className="shadow-sm cursor-pointer" onClick={() => setExpandedKey(isExpanded ? null : r.key)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20 shrink-0">
                          <Fuel className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{r.veiculo}</p>
                          <p className="text-xs text-muted-foreground">{r.data} · {r.responsavel}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-bold text-sm">{r.litros} L</span>
                        <span className="text-xs text-muted-foreground">R$ {Number(r.valor).toFixed(2)}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-muted-foreground animate-in fade-in">
                        <div><span className="font-semibold text-foreground">Horário:</span> {r.horario}</div>
                        <div><span className="font-semibold text-foreground">Preço/L:</span> R$ {(r.valor / r.litros).toFixed(3)}</div>
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
