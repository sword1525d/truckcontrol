'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Truck, Wrench, Camera, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { CameraCapture } from '@/components/CameraCapture';
import type { VehicleDto } from '@/types/api';

type ChecklistItem = {
  id: string;
  location: string;
  title: string;
  description: string;
  status: 'conforme' | 'nao_conforme' | 'na';
  observation?: string;
  images: string[];
};

const CHECKLIST_ITEMS: Omit<ChecklistItem, 'status' | 'observation' | 'images'>[] = [
  { id: '1', location: 'D', title: 'Teto das carrocerias', description: 'Verificar se nao possuem vazamentos.' },
  { id: '2', location: 'C', title: 'Piso do bau (Assoalho)', description: 'Deve estar sem depreciacoes, sem furos ou afundamentos ou algo que gere dificuldade da movimentacao de carrinhos.' },
  { id: '3', location: 'B', title: 'Escada de acesso a cabine. Escada caminhao quimico', description: 'Checar se estao em condicao segura de acesso.' },
  { id: '4', location: 'B', title: 'Farois, Lanternas e Sinalizadores', description: 'Checar se estao obedecendo os comandos quando acionados.' },
  { id: '5', location: 'B', title: 'Sinalizadores sonoros', description: 'Checar se estao obedecendo os comandos quando acionados.' },
  { id: '6', location: 'A', title: 'Portas (Cabine / Taipau / Bau)', description: 'As portas devem abrir e fechar com facilidade.' },
  { id: '7', location: 'B', title: 'Alavancas (Marcha / Seta )', description: 'Checar se ha folgas ou impedimento do uso.' },
  { id: '8', location: 'C', title: 'Painel de instrumentos', description: 'Velocimetro - deve esta funcionando. Combustivel - Acima de 1/4.' },
  { id: '9', location: 'A', title: 'Sistema de direcao', description: 'Checar se ha dificuldades com manobras. Nivel do oleo hidraulico.' },
  { id: '10', location: 'A', title: 'Freios (Pedal / Estacionamento)', description: 'Checar se estao obedecendo os comandos quando acionados.' },
  { id: '11', location: 'B', title: 'Corda de amarracao', description: 'Devem estar em otimo estado de uso' },
  { id: '12', location: 'B', title: 'Corrente Contencao', description: 'Deve conter 2 unidades dentro do bau do caminhao.' },
  { id: '13', location: 'B', title: 'Cinta de Amarracao', description: 'Minimo 2 unidades. Devem estar em otimas condicoes.' },
  { id: '14', location: 'B', title: 'Corrente de Ancoragem', description: 'Deve conter no minimo 02 pares.' },
  { id: '15', location: 'A', title: 'Calcos', description: 'Deve conter no minimo 02 unidades.' },
  { id: '16', location: 'A', title: 'Pneus (Dianteiros / Traseiros)', description: 'Checar se estao em perfeitas condicoes de uso.' },
  { id: '17', location: 'A', title: 'Extintor de Incendio', description: 'Deve estar disponivel, valido( seta de pressao no verde), de facil acesso.' },
  { id: '18', location: 'C', title: 'Outros apontamentos', description: 'Se houver apontamentos inserir "NC" se nao houver inserir "C".' }
];

export default function ChecklistPage() {
  const router = useRouter();
  const { profile, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [manualPlate, setManualPlate] = useState('');
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const [activeCameraItem, setActiveCameraItem] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    CHECKLIST_ITEMS.map(item => ({ ...item, status: 'na', observation: '', images: [] }))
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  useEffect(() => {
    if (!isAuthLoading && !profile) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Sessao invalida. Faca login novamente.' });
      router.push('/login');
    }
  }, [profile, isAuthLoading, router, toast]);

  useEffect(() => {
    if (!profile || !companyId || !sectorId) return;

    const fetchVehicles = async () => {
      try {
        const data = await api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`);
        setVehicles(data);
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel carregar os veiculos.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchVehicles();
  }, [profile, companyId, sectorId, toast]);

  const handleStatusChange = (itemId: string, status: 'conforme' | 'nao_conforme' | 'na') => {
    setChecklist(prev =>
      prev.map(item => (item.id === itemId ? { ...item, status } : item))
    );
  };

  const handleObservationChange = (itemId: string, observation: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === itemId ? { ...item, observation } : item))
    );
  };

  const handleCaptureImage = async (blob: Blob) => {
    if (!activeCameraItem) return;
    const itemId = activeCameraItem;
    setActiveCameraItem(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'photo.jpg');

      const { url: imageUrl } = await api.upload<{ url: string }>('/api/checklists/photos', formData);

      setChecklist(prev => prev.map(item => {
        if (item.id === itemId) {
          return { ...item, images: [...item.images, imageUrl] };
        }
        return item;
      }));
      toast({ title: 'Sucesso', description: 'Foto adicionada!' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel fazer upload da foto.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveImage = (itemId: string, indexToRemove: number) => {
    setChecklist(prev => prev.map(item => {
      if (item.id === itemId) {
        const newImages = [...item.images];
        newImages.splice(indexToRemove, 1);
        return { ...item, images: newImages };
      }
      return item;
    }));
  }

  const handleMarkMaintenance = async () => {
    if (!profile || !selectedVehicle || selectedVehicle === 'OUTRO') return;

    if (!window.confirm(`Deseja realmente marcar o veiculo ${selectedVehicle} como EM MANUTENCAO?`)) {
      return;
    }

    setIsMaintenanceLoading(true);
    try {
      await api.post(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle}/maintenance/start`);

      setVehicles(prev => prev.map(v => v.id === selectedVehicle ? { ...v, status: 'EM_MANUTENCAO' } : v));
      toast({ title: 'Sucesso', description: 'Veiculo marcado como em manutencao.' });
      setSelectedVehicle('');
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao registrar manutencao.' });
    } finally {
      setIsMaintenanceLoading(false);
    }
  };

  const handleSaveChecklist = async () => {
    let finalVehicleId = selectedVehicle;

    if (finalVehicleId === 'OUTRO') {
      if (!manualPlate || manualPlate.trim() === '') {
        toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, digite a placa do caminhao.' });
        return;
      }
      finalVehicleId = manualPlate.toUpperCase().trim();
    } else if (!finalVehicleId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, selecione um veiculo.' });
      return;
    }

    const isAllChecked = checklist.every(item => item.status !== 'na');
    if (!isAllChecked) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, preencha todos os itens do checklist.' });
      return;
    }

    if (!profile) return;
    setIsSubmitting(true);

    try {
      const items = checklist.map(item => ({
        itemId: item.id,
        location: item.location,
        title: item.title,
        description: item.description,
        status: item.status,
        observation: item.observation,
        images: item.images.length > 0 ? JSON.stringify(item.images) : undefined,
      }));

      await api.post(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${finalVehicleId}/checklists`, {
        driverId: profile.id,
        driverName: profile.name,
        items,
      });

      toast({ title: 'Sucesso!', description: 'Checklist salvo com sucesso.' });
      router.push('/dashboard-truck');

    } catch (error) {
      console.error("Erro ao salvar checklist:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel salvar o checklist.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || isAuthLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 container mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-truck')}>
              <ArrowLeft />
            </Button>
            <h1 className="text-2xl font-bold">Checklist Diario</h1>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Ver Croqui</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Croqui do Caminhao</DialogTitle>
              </DialogHeader>
              <div className="max-h-[80vh] overflow-y-auto">
                <Image src="/mapacaminhao.png" alt="Croqui do Caminhao" width={800} height={1200} className="w-full h-auto" />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecao do Veiculo</CardTitle>
            <CardDescription>Escolha o caminhao para realizar a inspecao.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um veiculo"} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id} disabled={v.status === 'EM_MANUTENCAO'}>
                    {`${v.id} - ${v.model}`} {v.status === 'EM_MANUTENCAO' ? '(EM MANUTENCAO)' : ''}
                  </SelectItem>
                ))}
                <SelectItem value="OUTRO" className="font-bold text-primary">Outro Caminhao (Digitar Placa)</SelectItem>
              </SelectContent>
            </Select>

            {selectedVehicle === 'OUTRO' && (
              <div className="space-y-2 mt-4 pt-4 border-t border-dashed animate-in fade-in zoom-in duration-300">
                <Label htmlFor="manualPlate" className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" /> PLACA DO CAMINHAO
                </Label>
                <Input
                  id="manualPlate"
                  placeholder="EX: ABC-1234"
                  value={manualPlate}
                  onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                  className="h-12 text-lg font-bold uppercase"
                />
              </div>
            )}

            {selectedVehicle && selectedVehicle !== 'OUTRO' && (
              <div className="flex justify-end mt-2 animate-in fade-in duration-300">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkMaintenance}
                  disabled={isMaintenanceLoading}
                  className="text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20"
                >
                  {isMaintenanceLoading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Wrench className="w-3 h-3 mr-2" />}
                  Informar Manutencao
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="space-y-4">
          {checklist.map(item => (
            <Card key={item.id} className="shadow-sm">
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-base">
                      <span className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full h-6 w-6 mr-2 text-xs">{item.id}</span>
                      {item.title}
                      <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded ${(item.location === 'A' || item.location === 'B') ? 'bg-destructive/10 text-destructive font-bold' : 'text-muted-foreground bg-gray-100 dark:bg-gray-800'}`}>[{item.location}]</span>
                    </p>
                    <p className="text-sm text-muted-foreground ml-8">{item.description}</p>
                  </div>
                  <RadioGroup
                    defaultValue={item.status}
                    value={item.status}
                    onValueChange={(value: 'conforme' | 'nao_conforme' | 'na') => handleStatusChange(item.id, value)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="conforme" id={`c-${item.id}`} />
                      <Label htmlFor={`c-${item.id}`} className="cursor-pointer">Conforme</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao_conforme" id={`nc-${item.id}`} />
                      <Label htmlFor={`nc-${item.id}`} className="cursor-pointer">Nao Conforme</Label>
                    </div>
                  </RadioGroup>
                </div>
                {(item.location === 'A' || item.location === 'B') && (
                  <div className="ml-8 mt-1">
                    <p className="text-xs font-medium text-destructive">
                      Item Critico: A nao conformidade deste item bloqueara o caminhao automaticamente.
                    </p>
                  </div>
                )}
                {item.status === 'nao_conforme' && (
                  <div className="ml-8 space-y-4 mt-2">
                    <div>
                      <Label htmlFor={`obs-${item.id}`} className="text-xs text-muted-foreground">Observacao da Nao Conformidade:</Label>
                      <Textarea
                        id={`obs-${item.id}`}
                        placeholder="Descreva o problema encontrado..."
                        value={item.observation}
                        onChange={(e) => handleObservationChange(item.id, e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-primary block mb-2">Fotos (Max 5):</Label>
                      <div className="flex flex-wrap gap-3">
                        {item.images.map((imgUrl, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border shadow-sm group">
                            <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleRemoveImage(item.id, idx)}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-80 group-hover:opacity-100 transition-opacity shadow"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {item.images.length < 5 && (
                          <button
                            onClick={() => setActiveCameraItem(item.id)}
                            className="w-20 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all hover:border-primary/50"
                          >
                            <Camera className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-medium">Tirar Foto</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {activeCameraItem && (
          <CameraCapture
            onCapture={handleCaptureImage}
            onClose={() => setActiveCameraItem(null)}
          />
        )}
      </main>

      <footer className="sticky bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
        <div className="container mx-auto max-w-4xl">
          <Button
            className="w-full text-lg h-14"
            onClick={handleSaveChecklist}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Checklist
          </Button>
        </div>
      </footer>
    </div>
  );
}
