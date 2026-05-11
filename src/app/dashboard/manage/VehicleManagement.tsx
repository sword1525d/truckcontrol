'use client';
import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Trash2, Wrench, History, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VehicleDto, MaintenanceRecordDto, CreateVehicleRequest } from '@/types/api';

const vehicleEditSchema = z.object({ model: z.string().min(1, 'Modelo é obrigatório') });
const mileageEditSchema = z.object({ lastMileage: z.coerce.number().min(0, 'Km deve ser positivo') });
const maintenanceStartSchema = z.object({ notes: z.string().optional() });
const vehicleCreateSchema = z.object({
  vehicleId: z.string().min(1, 'ID do Veículo (placa) é obrigatório'),
  model: z.string().min(1, 'Modelo é obrigatório'),
});

type VehicleEditForm = z.infer<typeof vehicleEditSchema>;
type MileageEditForm = z.infer<typeof mileageEditSchema>;
type MaintenanceStartForm = z.infer<typeof maintenanceStartSchema>;
type VehicleCreateForm = z.infer<typeof vehicleCreateSchema>;

interface VehicleManagementProps {
  vehicles: VehicleDto[];
  activeRuns: { [key: string]: boolean };
  onDelete: (type: 'vehicle', id: string) => void;
  onUpdate: () => void;
  companyId: string;
  sectorId: string;
}

export const VehicleManagement = ({ vehicles, activeRuns, onDelete, onUpdate, companyId, sectorId }: VehicleManagementProps) => {
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isMileageDialogOpen, setIsMileageDialogOpen] = useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMileageSubmitting, setIsMileageSubmitting] = useState(false);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecordDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const editForm = useForm<VehicleEditForm>({ resolver: zodResolver(vehicleEditSchema) });
  const mileageForm = useForm<MileageEditForm>({ resolver: zodResolver(mileageEditSchema) });
  const maintenanceForm = useForm<MaintenanceStartForm>({ resolver: zodResolver(maintenanceStartSchema) });
  const createForm = useForm<VehicleCreateForm>({ resolver: zodResolver(vehicleCreateSchema), defaultValues: { vehicleId: '', model: '' } });

  const handleEditClick = (vehicle: VehicleDto) => {
    setSelectedVehicle(vehicle);
    editForm.reset({ model: vehicle.model });
    setIsEditDialogOpen(true);
  };

  const handleMaintenanceClick = (vehicle: VehicleDto) => {
    setSelectedVehicle(vehicle);
    maintenanceForm.reset({ notes: '' });
    setIsMaintenanceDialogOpen(true);
  };

  const handleMileageClick = (vehicle: VehicleDto) => {
    setSelectedVehicle(vehicle);
    mileageForm.reset({ lastMileage: vehicle.lastMileage ?? 0 });
    setIsMileageDialogOpen(true);
  };

  const handleHistoryClick = async (vehicle: VehicleDto) => {
    setSelectedVehicle(vehicle);
    setIsHistoryDialogOpen(true);
    setIsLoadingHistory(true);
    try {
      const history = await api.get<MaintenanceRecordDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vehicle.id}/maintenance`);
      setMaintenanceHistory(history);
    } catch (error) {
      console.error("Error fetching maintenance history:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar o histórico de manutenções.' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCreateSubmit = async (data: VehicleCreateForm) => {
    setIsSubmitting(true);
    try {
      const body: CreateVehicleRequest = { vehicleId: data.vehicleId, model: data.model, isTruck: true };
      await api.post(`/api/companies/${companyId}/sectors/${sectorId}/vehicles`, body);
      toast({ title: 'Sucesso', description: 'Caminhão cadastrado!' });
      onUpdate();
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating vehicle:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cadastrar o caminhão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (data: VehicleEditForm) => {
    if (!selectedVehicle) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle.id}`, { model: data.model });
      toast({ title: 'Sucesso', description: 'Veículo atualizado.' });
      onUpdate();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o veículo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaintenanceSubmit = async (data: MaintenanceStartForm) => {
    if (!selectedVehicle) return;
    setIsSubmitting(true);
    try {
      if (selectedVehicle.status === 'PARADO') {
        await api.post(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle.id}/maintenance/start`, { notes: data.notes || '' });
        toast({ title: 'Sucesso', description: `Manutenção iniciada para o veículo ${selectedVehicle.id}.` });
      } else if (selectedVehicle.status === 'EM_MANUTENCAO') {
        await api.post(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle.id}/maintenance/end`);
        toast({ title: 'Sucesso', description: `Manutenção finalizada para o veículo ${selectedVehicle.id}.` });
      }
      onUpdate();
      setIsMaintenanceDialogOpen(false);
    } catch (error) {
      console.error("Error handling maintenance:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar a solicitação de manutenção.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMileageSubmit = async (data: MileageEditForm) => {
    if (!selectedVehicle) return;
    setIsMileageSubmitting(true);
    try {
      await api.patch(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${selectedVehicle.id}/last-mileage`, { lastMileage: data.lastMileage });
      toast({ title: 'Sucesso', description: `Km do veículo ${selectedVehicle.id} atualizado para ${data.lastMileage}.` });
      onUpdate();
      setIsMileageDialogOpen(false);
    } catch (error) {
      console.error("Error updating mileage:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o km do veículo.' });
    } finally {
      setIsMileageSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, vehicleId: string) => {
    if (activeRuns[vehicleId]) return <Badge variant="destructive">Em Corrida</Badge>;
    if (status === 'BLOQUEADO_CHECKLIST') return <Badge variant="destructive">Bloqueado</Badge>;
    switch (status) {
      case 'EM_MANUTENCAO': return <Badge className="bg-yellow-500 text-white">Manutenção</Badge>;
      case 'PARADO': return <Badge className="bg-green-500 text-white">Parado</Badge>;
      default: return <Badge variant="secondary">Indefinido</Badge>;
    }
  };

  const formatTimestamp = (ts: string | undefined): string => {
    if (!ts) return 'N/A';
    return format(new Date(ts), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const calculateDuration = (start: string | undefined, end: string | null | undefined): string => {
    if (!start) return 'N/A';
    const endDate = end ? new Date(end) : new Date();
    return formatDistanceToNow(new Date(start), { locale: ptBR, addSuffix: false });
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { createForm.reset(); setIsCreateDialogOpen(true); }}>Adicionar Caminhão</Button>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Km</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-medium">{vehicle.id}</TableCell>
                <TableCell>{vehicle.model}</TableCell>
                <TableCell>{vehicle.lastMileage?.toLocaleString() ?? '-'}</TableCell>
                <TableCell>{getStatusBadge(vehicle.status, vehicle.id)}</TableCell>
                <TableCell className="text-right space-x-1 sm:space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleHistoryClick(vehicle)}>
                    <History className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Histórico</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleMaintenanceClick(vehicle)}
                    disabled={!!activeRuns[vehicle.id]}
                    className={vehicle.status === 'EM_MANUTENCAO' ? 'border-yellow-500 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' : ''}>
                    <Wrench className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Manutenção</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(vehicle)}>
                    <Edit className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Editar</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleMileageClick(vehicle)}>
                    <Gauge className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Km</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Deletar</span></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita. Isso irá deletar permanentemente o caminhão com a placa "{vehicle.id}".</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete('vehicle', vehicle.id)}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Caminhão</DialogTitle>
            <DialogDescription>Altere o modelo do caminhão com a placa {selectedVehicle?.id}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" {...editForm.register('model')} />
              {editForm.formState.errors.model && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.model.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMileageDialogOpen} onOpenChange={setIsMileageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Quilometragem</DialogTitle>
            <DialogDescription>Altere a quilometragem atual do veículo {selectedVehicle?.id}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={mileageForm.handleSubmit(handleMileageSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="lastMileage">Quilometragem (Km)</Label>
              <Input id="lastMileage" type="number" step="1" min="0" {...mileageForm.register('lastMileage')} />
              {mileageForm.formState.errors.lastMileage && <p className="text-sm text-destructive mt-1">{mileageForm.formState.errors.lastMileage.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isMileageSubmitting}>
                {isMileageSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Caminhão</DialogTitle>
            <DialogDescription>Preencha os dados para cadastrar um novo caminhão no setor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="vehicleId">Placa do Caminhão</Label>
              <Input id="vehicleId" {...createForm.register('vehicleId')} placeholder="ABC-1234" />
              {createForm.formState.errors.vehicleId && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.vehicleId.message}</p>}
            </div>
            <div>
              <Label htmlFor="modelCreate">Modelo do Caminhão</Label>
              <Input id="modelCreate" {...createForm.register('model')} placeholder="Ex: VW Constellation" />
              {createForm.formState.errors.model && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.model.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVehicle?.status === 'EM_MANUTENCAO' ? 'Finalizar Manutenção' : 'Iniciar Manutenção'}</DialogTitle>
            <DialogDescription>
              {selectedVehicle?.status === 'EM_MANUTENCAO'
                ? `Confirma a finalização da manutenção do veículo ${selectedVehicle?.id}?`
                : `Deseja colocar o veículo ${selectedVehicle?.id} em manutenção?`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={maintenanceForm.handleSubmit(handleMaintenanceSubmit)} className="space-y-4">
            {selectedVehicle?.status !== 'EM_MANUTENCAO' && (
              <div>
                <Label htmlFor="notes">Observações (Opcional)</Label>
                <Textarea id="notes" {...maintenanceForm.register('notes')} placeholder="Descreva o motivo da manutenção..." />
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedVehicle?.status === 'EM_MANUTENCAO' ? 'Finalizar Manutenção' : 'Confirmar Início'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Manutenção - {selectedVehicle?.id}</DialogTitle>
            <DialogDescription>Lista de todas as manutenções realizadas neste veículo.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-4">
            {isLoadingHistory ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : maintenanceHistory.length > 0 ? (
              <div className="space-y-4">
                {maintenanceHistory.map(record => (
                  <div key={record.id} className="border p-4 rounded-md bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">Início: <span className="font-normal">{formatTimestamp(record.startTime)}</span></p>
                        <p className="font-semibold">Fim: <span className="font-normal">{formatTimestamp(record.endTime)}</span></p>
                      </div>
                      <Badge variant={record.endTime ? 'secondary' : 'default'} className={!record.endTime ? 'bg-yellow-500' : ''}>
                        {record.endTime ? `Duração: ${calculateDuration(record.startTime, record.endTime)}` : 'Em andamento'}
                      </Badge>
                    </div>
                    {record.notes && <p className="text-sm text-muted-foreground mt-2 border-t pt-2"><strong>Observações:</strong> {record.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum registro de manutenção encontrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
