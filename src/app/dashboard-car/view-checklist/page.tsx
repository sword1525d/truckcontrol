'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, ClipboardCheck, ChevronDown, ChevronUp, CheckCircle2, XCircle, FilterX, Search, X, ChevronLeft, ChevronRight, ImageIcon, Car } from 'lucide-react';
import { getCarUsuario, fetchVeiculos, type CarUsuario, CAR_RTDB_URL } from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ZoneKey = 'frente' | 'frente_esquerda' | 'frente_direita' | 'tras' | 'tras_esquerda' | 'tras_direita';
const ZONES: { key: ZoneKey; label: string; top: string; left: string; mappedKey: keyof CheckEntry }[] = [
  { key: 'frente', label: 'Frente', top: '15%', left: '50%', mappedKey: 'FRENTE' },
  { key: 'frente_esquerda', label: 'Frente Esquerda', top: '42%', left: '24%', mappedKey: 'F_ESQUERDO' },
  { key: 'frente_direita', label: 'Frente Direita', top: '42%', left: '76%', mappedKey: 'F_DIREITO' },
  { key: 'tras_esquerda', label: 'Trás Esquerda', top: '58%', left: '24%', mappedKey: 'T_ESQUERDO' },
  { key: 'tras_direita', label: 'Trás Direita', top: '58%', left: '76%', mappedKey: 'T_DIREITO' },
  { key: 'tras', label: 'Trás', top: '85%', left: '50%', mappedKey: 'TRAS' },
];

type CheckEntry = {
  key: string;
  veiculo: string;
  responsavel: string;
  data: string;
  horario: string;
  equipamentos?: Record<string, boolean>;
  observacoes?: string;
  anexos?: string[];
  inspecao_externa?: Record<string, { obs: string; ok: boolean }>;
  FRENTE?: string;
  F_DIREITO?: string;
  F_ESQUERDO?: string;
  TRAS?: string;
  T_DIREITO?: string;
  T_ESQUERDO?: string;
};

export default function ViewChecklistPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [checklists, setChecklists] = useState<CheckEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

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
        const res = await fetch(
          `${CAR_RTDB_URL}/${u.empresa}/${u.setor}/relatorio.json`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (data) {
          const list: CheckEntry[] = Object.entries(data as Record<string, any>)
            .filter(([, c]) => c != null)
            .map(([key, c]) => ({ 
              key,
              veiculo: c.veiculo || c.VEICULO || 'Desconhecido',
              responsavel: c.responsavel || c.RESPONSAVEL || 'Desconhecido',
              data: c.data || c.DATA || '01/01/2000',
              horario: c.horario || c.HORA || '00:00',
              equipamentos: c.equipamentos || c.EQUIPAMENTOS,
              observacoes: c.observacoes || c.OBSERVACOES,
              anexos: c.anexos || c.ANEXOS || [],
              FRENTE: c.FRENTE || c.frente || 'OK',
              F_DIREITO: c.F_DIREITO || c.f_direito || 'OK',
              F_ESQUERDO: c.F_ESQUERDO || c.f_esquerdo || 'OK',
              TRAS: c.TRAS || c.tras || 'OK',
              T_DIREITO: c.T_DIREITO || c.t_direito || 'OK',
              T_ESQUERDO: c.T_ESQUERDO || c.t_esquerdo || 'OK',
              ...c
            }))
            .sort((a, b) => {
              const parseDate = (c: CheckEntry) => {
                const [d, m, y] = (c.data || '01/01/2000').split('/');
                return new Date(`${y}-${m}-${d}T${c.horario ?? '00:00'}`).getTime();
              };
              return parseDate(b) - parseDate(a);
            });
          setChecklists(list);
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os checklists.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const displayed = checklists.filter((ck) => {
    if (deferredStart || deferredEnd) {
      const [d, m, y] = (ck.data || '01/01/2000').split('/');
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
      const match = ck.responsavel?.toLowerCase().includes(q) || ck.veiculo?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const EQUIP_LABELS: Record<string, string> = {
    macaco: 'Macaco', estepe: 'Estepe', chave_roda: 'Chave de Roda',
    triangulo: 'Triângulo', tapete: 'Tapete', som: 'Sistema de Som',
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-2xl pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Checklists</h1>
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
               Ver meus checklists de hoje →
             </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum checklist encontrado para os filtros selecionados.</div>
        ) : (
          <div className="space-y-2">
            {displayed.map((ck) => {
              const isExpanded = expandedKey === ck.key;
              const equipItems = ck.equipamentos ? Object.entries(ck.equipamentos) : [];

              return (
                <Card key={ck.key} className="shadow-sm cursor-pointer" onClick={() => setExpandedKey(isExpanded ? null : ck.key)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <ClipboardCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{ck.veiculo}</p>
                          <p className="text-xs text-muted-foreground">{ck.data} · {ck.horario} · {ck.responsavel}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3 animate-in fade-in">
                        {equipItems.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">EQUIPAMENTOS</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {equipItems.map(([key, val]) => (
                                <div key={key} className="flex items-center gap-1.5 text-xs">
                                  {val
                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                    : <XCircle className="h-3.5 w-3.5 text-destructive/60 shrink-0" />}
                                  <span className={val ? 'text-foreground' : 'text-muted-foreground'}>
                                    {EQUIP_LABELS[key] ?? key}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Croqui de Inspeção */}
                        <div>
                           <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> CROQUI DE INSPEÇÃO</p>
                           
                           <div className="relative mx-auto w-48 h-[260px] bg-background flex items-center justify-center select-none mb-4">
                             <img src="/car.png" alt="Croqui do Veículo" className="w-full h-full object-contain opacity-70 pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
                             {ZONES.map((z) => {
                               const val = ck[z.mappedKey] as string | undefined;
                               const isAvariado = val && val.toUpperCase() !== 'OK';
                               return (
                                 <div
                                   key={z.key}
                                   title={isAvariado ? val : z.label}
                                   className={cn(
                                     'absolute w-4 h-4 rounded-full border transition-all -translate-x-1/2 -translate-y-1/2 shadow-sm flex items-center justify-center cursor-help',
                                     isAvariado
                                       ? 'bg-red-500/90 border-red-600 scale-125 z-10'
                                       : 'bg-green-500/20 border-green-500/50 backdrop-blur-sm'
                                   )}
                                   style={{ top: z.top, left: z.left }}
                                 >
                                   {isAvariado && <span className="absolute inset-0 bg-destructive rounded-full animate-ping opacity-50" />}
                                 </div>
                               );
                             })}
                           </div>
                           
                           {/* Lista de Avarias */}
                           {(() => {
                             const avarias = ZONES.map(z => ({ label: z.label, val: ck[z.mappedKey] as string | undefined })).filter(z => z.val && z.val.toUpperCase() !== 'OK');
                             if (avarias.length === 0) return (
                                <div className="bg-green-500/10 text-green-700 dark:text-green-400 p-2 rounded-lg text-center text-xs font-medium border border-green-500/20">
                                   Nenhuma avaria registrada neste checklist.
                                </div>
                             );
                             return (
                                <ul className="text-sm space-y-1 bg-destructive/5 p-3 rounded-lg border border-destructive/10">
                                  {avarias.map(a => (
                                     <li key={a.label} className="text-foreground text-xs"><span className="font-semibold text-destructive mr-1">{a.label}:</span>{a.val}</li>
                                  ))}
                                </ul>
                             );
                           })()}
                        </div>

                        {ck.observacoes && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">OBSERVAÇÕES</p>
                            <p className="text-sm text-foreground break-words">{ck.observacoes}</p>
                          </div>
                        )}

                        {/* Anexos de imagem */}
                        {ck.anexos && ck.anexos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                               <ImageIcon className="h-3.5 w-3.5" /> FOTOS ANEXADAS ({ck.anexos.length})
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                               {ck.anexos.map((url, idx) => (
                                  <div 
                                    key={idx} 
                                    onClick={(e) => { e.stopPropagation(); setGalleryImages(ck.anexos!); setGalleryIndex(idx); }}
                                    className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer border hover:ring-2 hover:ring-primary/50 transition-all shrink-0 bg-muted flex items-center justify-center relative group"
                                  >
                                     <img src={url} alt={`Anexo ${idx+1}`} className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                  </div>
                               ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Galeria */}
      {galleryImages && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-50 rounded-full h-12 w-12"
            onClick={() => setGalleryImages(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          
          {galleryImages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12 z-50"
              onClick={() => setGalleryIndex((i) => (i === 0 ? galleryImages.length - 1 : i - 1))}
            >
              <ChevronLeft className="h-10 w-10" />
            </Button>
          )}

          <img
            src={galleryImages[galleryIndex]}
            alt="Anexo Checklist"
            className="max-w-full max-h-[85vh] object-contain select-none"
          />

          {galleryImages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12 z-50"
              onClick={() => setGalleryIndex((i) => (i === galleryImages.length - 1 ? 0 : i + 1))}
            >
              <ChevronRight className="h-10 w-10" />
            </Button>
          )}
          
          {galleryImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium bg-black/50 px-4 py-1.5 rounded-full">
               {galleryIndex + 1} / {galleryImages.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
