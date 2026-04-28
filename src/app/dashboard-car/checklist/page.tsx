'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle2, Car, ClipboardCheck, Camera, X as XIcon } from 'lucide-react';
import {
  getCarUsuario,
  fetchVeiculos,
  type CarUsuario,
  CAR_RTDB_URL,
} from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type ZoneKey = 'frente' | 'frente_esquerda' | 'frente_direita' | 'tras' | 'tras_esquerda' | 'tras_direita';

type ZoneData = { obs: string; ok: boolean };

type EquipmentKey = 'macaco' | 'estepe' | 'chave_roda' | 'triangulo' | 'tapete' | 'som';

const ZONES: { key: ZoneKey; label: string; top: string; left: string }[] = [
  { key: 'frente', label: 'Frente', top: '15%', left: '50%' },
  { key: 'frente_esquerda', label: 'Frente Esquerda', top: '42%', left: '24%' },
  { key: 'frente_direita', label: 'Frente Direita', top: '42%', left: '76%' },
  { key: 'tras_esquerda', label: 'Trás Esquerda', top: '58%', left: '24%' },
  { key: 'tras_direita', label: 'Trás Direita', top: '58%', left: '76%' },
  { key: 'tras', label: 'Trás', top: '85%', left: '50%' },
];

const EQUIPMENT: { key: EquipmentKey; label: string }[] = [
  { key: 'macaco', label: 'Macaco' },
  { key: 'estepe', label: 'Estepe' },
  { key: 'chave_roda', label: 'Chave de Roda' },
  { key: 'triangulo', label: 'Triângulo' },
  { key: 'tapete', label: 'Tapete' },
  { key: 'som', label: 'Sistema de Som' },
];

export default function CarChecklistPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [veiculos, setVeiculos] = useState<{ id: string; nome: string }[]>([]);
  const [selectedVeiculo, setSelectedVeiculo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [images, setImages] = useState<{ file: File, preview: string }[]>([]);

  const [zones, setZones] = useState<Record<ZoneKey, ZoneData>>(
    Object.fromEntries(ZONES.map((z) => [z.key, { obs: '', ok: false }])) as Record<ZoneKey, ZoneData>
  );

  const [equipment, setEquipment] = useState<Record<EquipmentKey, boolean>>(
    Object.fromEntries(EQUIPMENT.map((e) => [e.key, false])) as Record<EquipmentKey, boolean>
  );

  const [observations, setObservations] = useState('');

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchVeiculos(u.empresa, u.setor);
        if (data) {
          setVeiculos(Object.entries(data).map(([id]) => ({ id, nome: id })));
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os veículos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const handleVeiculoChange = (v: string) => {
    setSelectedVeiculo(v);
    setShowForm(true);
    // Reset form
    setZones(Object.fromEntries(ZONES.map((z) => [z.key, { obs: '', ok: false }])) as Record<ZoneKey, ZoneData>);
    setEquipment(Object.fromEntries(EQUIPMENT.map((e) => [e.key, false])) as Record<EquipmentKey, boolean>);
    setObservations('');
  };

  const toggleZone = (key: ZoneKey) => {
    setZones((prev) => ({
      ...prev,
      [key]: { ...prev[key], ok: !prev[key].ok },
    }));
  };

  const setZoneObs = (key: ZoneKey, obs: string) => {
    setZones((prev) => ({ ...prev, [key]: { ...prev[key], obs } }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const validFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
      if (validFiles.length > 0) {
        const newImages = validFiles.map(file => ({
          file,
          preview: URL.createObjectURL(file)
        }));
        setImages(prev => [...prev, ...newImages]);
      } else {
        toast({ variant: 'destructive', title: 'Arquivo inválido', description: 'Envie apenas imagens menores que 5MB.' });
      }
    }
    // reset input
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newArr = [...prev];
      URL.revokeObjectURL(newArr[index].preview);
      newArr.splice(index, 1);
      return newArr;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !selectedVeiculo) return;

    setIsSubmitting(true);
    try {
      let imageLinks: string[] = [];

      if (images.length > 0) {
        toast({ title: 'Enviando imagens...', description: 'Aguarde o upload dos anexos.' });
        for (const img of images) {
          const fileExtension = img.file.name.split('.').pop() || 'png';
          const fileName = `${crypto.randomUUID()}.${fileExtension}`;
          const filePath = `checklist/${fileName}`;

          const { error } = await supabase.storage.from('frotacontrol').upload(filePath, img.file, {
            cacheControl: '3600',
            upsert: false,
          });

          if (error) {
            console.error('Erro Supabase:', error);
            throw new Error(`Falha no upload de ${img.file.name}: ${error.message}`);
          }

          const { data: publicUrlData } = supabase.storage.from('frotacontrol').getPublicUrl(filePath);
          if (publicUrlData && publicUrlData.publicUrl) {
            imageLinks.push(publicUrlData.publicUrl);
          }
        }
      }

      const agora = new Date();

      const registro = {
        VEICULO: selectedVeiculo,
        RESPONSAVEL: usuario.nome,
        matricula: usuario.mat,
        DATA: agora.toLocaleDateString('pt-BR'),
        HORA: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        FRENTE: zones['frente'].ok ? (zones['frente'].obs || 'Avariado') : 'OK',
        F_DIREITO: zones['frente_direita'].ok ? (zones['frente_direita'].obs || 'Avariado') : 'OK',
        F_ESQUERDO: zones['frente_esquerda'].ok ? (zones['frente_esquerda'].obs || 'Avariado') : 'OK',
        TRAS: zones['tras'].ok ? (zones['tras'].obs || 'Avariado') : 'OK',
        T_DIREITO: zones['tras_direita'].ok ? (zones['tras_direita'].obs || 'Avariado') : 'OK',
        T_ESQUERDO: zones['tras_esquerda'].ok ? (zones['tras_esquerda'].obs || 'Avariado') : 'OK',
        EQUIPAMENTOS: equipment,
        OBSERVACOES: observations,
        anexos: imageLinks,
      };

      const res = await fetch(
        `${CAR_RTDB_URL}/${usuario.empresa}/${usuario.setor}/relatorio.json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registro),
        }
      );

      if (!res.ok) throw new Error('Erro ao salvar checklist.');

      toast({ title: 'Checklist concluído!', description: `Veículo ${selectedVeiculo} inspecionado.` });
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

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-2xl pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Checklist Diário</h1>
            <p className="text-sm text-muted-foreground">Inspeção do veículo</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de veículo */}
          <Card>
            <CardContent className="p-6 space-y-2">
              <Label htmlFor="veiculo-check" className="text-sm font-bold flex items-center gap-2">
                <Car className="w-4 h-4 text-primary" /> VEÍCULO
              </Label>
              <Select value={selectedVeiculo} onValueChange={handleVeiculoChange} disabled={isLoading}>
                <SelectTrigger id="veiculo-check" className="h-12">
                  <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione o veículo'} />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {showForm && (
            <>
              {/* Inspeção Externa — Croqui */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inspeção Externa</CardTitle>
                  <CardDescription>Marque as zonas que apresentam avaria e adicione observações</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Croqui visual */}
                  <div className="relative mx-auto w-64 sm:w-80 h-[400px] sm:h-[500px] bg-background flex items-center justify-center select-none">
                    <img src="/car.png" alt="Croqui do Veículo" className="w-full h-full object-contain pointer-events-none opacity-90 mix-blend-multiply dark:mix-blend-screen" />

                    {ZONES.map((z) => {
                      const isOk = zones[z.key].ok;
                      return (
                        <button
                          key={z.key}
                          type="button"
                          title={z.label}
                          onClick={() => toggleZone(z.key)}
                          className={cn(
                            'absolute w-6 h-6 rounded-full border-2 transition-all -translate-x-1/2 -translate-y-1/2 shadow-md cursor-pointer',
                            isOk
                              ? 'bg-red-500/90 border-red-600 scale-110 z-10 animate-pulse'
                              : 'bg-green-500/20 border-green-500/50 hover:border-primary hover:bg-primary/20 backdrop-blur-sm'
                          )}
                          style={{ top: z.top, left: z.left }}
                        />
                      );
                    })}
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Toque nos pontos para marcar avarias (vermelho = avaria)
                  </p>

                  {/* Campos de observação por zona */}
                  <div className="space-y-2">
                    {ZONES.filter((z) => zones[z.key].ok).map((z) => (
                      <div key={z.key} className="space-y-1">
                        <Label className="text-xs text-destructive font-semibold">{z.label}</Label>
                        <Input
                          placeholder="Descreva a avaria..."
                          value={zones[z.key].obs}
                          onChange={(e) => setZoneObs(z.key, e.target.value)}
                        />
                      </div>
                    ))}
                    {ZONES.some((z) => zones[z.key].ok) === false && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        Nenhuma avaria marcada — veículo OK visualmente
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Equipamentos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Equipamentos Obrigatórios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {EQUIPMENT.map((eq) => (
                      <label
                        key={eq.key}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                          equipment[eq.key]
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                            : 'bg-card border-border hover:border-primary/40'
                        )}
                      >
                        <input
                          type="checkbox"
                          id={`equip-${eq.key}`}
                          checked={equipment[eq.key]}
                          onChange={(e) =>
                            setEquipment((prev) => ({ ...prev, [eq.key]: e.target.checked }))
                          }
                          className="w-5 h-5 accent-green-600 rounded"
                        />
                        <span className="text-sm font-medium">{eq.label}</span>
                        {equipment[eq.key] && <CheckCircle2 className="ml-auto h-4 w-4 text-green-600 shrink-0" />}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Observações */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Observações Adicionais</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    id="observacoes"
                    placeholder="Descreva qualquer observação relevante sobre o veículo..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value.slice(0, 500))}
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">{observations.length}/500</p>
                </CardContent>
              </Card>

              {/* Anexos e Fotos */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" /> FOTOS E ANEXOS
                  </Label>
                  <p className="text-xs text-muted-foreground mb-4">Adicione fotos de avarias ou comprovantes do estado do veículo.</p>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square bg-muted rounded-md overflow-hidden group">
                        <img src={img.preview} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label
                      htmlFor="file-input"
                      className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-border rounded-md hover:border-primary hover:bg-primary/5 hover:text-primary cursor-pointer transition-colors"
                    >
                      <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-[10px] font-medium text-muted-foreground text-center px-1">Adicionar Foto</span>
                      <input
                        id="file-input"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full h-12 font-bold"
                    disabled={!selectedVeiculo || isSubmitting}
                  >
                    {isSubmitting
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <ClipboardCheck className="mr-2 h-4 w-4" />}
                    CONCLUIR CHECKLIST
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
