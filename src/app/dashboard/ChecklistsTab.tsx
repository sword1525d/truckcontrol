'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { ChecklistDto, ChecklistItemDto, UserDto, VehicleDto } from '@/types/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Truck, Calendar as CalendarIcon, ClipboardCheck, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');

const parseImages = (images?: string): string[] => {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStatusBadge = (status: string) => {
  if (status === 'conforme') return <Badge className="bg-green-100 text-green-800 border-green-300">Conforme</Badge>;
  if (status === 'nao_conforme') return <Badge variant="destructive">Não Conforme</Badge>;
  return <Badge variant="secondary">N/A</Badge>;
};

const ChecklistTableRow = ({ checklist, driver, onViewDetails, isSuperAdmin, onDelete, onBlockVehicle }: {
  checklist: ChecklistDto;
  driver?: UserDto;
  onViewDetails: () => void;
  isSuperAdmin: boolean;
  onDelete: (id: string) => void;
  onBlockVehicle?: (vehicleId: string) => void;
}) => {
  const nonCompliantItems = checklist.items.filter((item: ChecklistItemDto) => item.status === 'nao_conforme').length;
  return (
    <TableRow>
      <TableCell>{format(new Date(checklist.timestamp), 'dd/MM/yy HH:mm')}</TableCell>
      <TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />{checklist.vehicleId}</div></TableCell>
      <TableCell>
        <div className="font-medium flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={driver?.photoURL} alt={checklist.driverName} />
            <AvatarFallback className="text-xs">{getInitials(checklist.driverName)}</AvatarFallback>
          </Avatar>
          {checklist.driverName}
        </div>
      </TableCell>
      <TableCell>
        {nonCompliantItems > 0
          ? <Badge variant="destructive">{nonCompliantItems} item(ns) não conforme</Badge>
          : <Badge className="bg-green-600 hover:bg-green-700">Tudo conforme</Badge>}
      </TableCell>
      <TableCell className="text-right font-medium space-x-2">
        {nonCompliantItems > 0 && onBlockVehicle && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><AlertCircle className="h-4 w-4 mr-2" /> Bloquear Uso</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Bloqueio</AlertDialogTitle>
                <AlertDialogDescription>Deseja realmente bloquear o veículo {checklist.vehicleId}? Ele não poderá iniciar novas corridas até ser desbloqueado.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onBlockVehicle(checklist.vehicleId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button variant="outline" size="sm" onClick={onViewDetails}><FileText className="h-4 w-4 mr-2" />Ver Detalhes</Button>
        {isSuperAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Deletar</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita e irá apagar permanentemente o checklist.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(checklist.id)}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  );
};

const ChecklistDetailsDialog = ({ checklist, isOpen, onClose }: { checklist: ChecklistDto | null; isOpen: boolean; onClose: () => void }) => {
  if (!checklist) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl">Detalhes do Checklist</DialogTitle>
          <DialogDescription>
            Realizado por <strong>{checklist.driverName}</strong> no veículo <strong>{checklist.vehicleId}</strong> em {format(new Date(checklist.timestamp), "dd/MM/yyyy 'às' HH:mm")}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4 -mr-4 mt-4">
          <div className="space-y-4">
            {checklist.items.map((item: ChecklistItemDto) => (
              <div key={item.id} className={`border rounded-lg p-4 ${item.status === 'nao_conforme' ? 'bg-destructive/5 border-destructive/20' : 'bg-card'}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-bold text-base flex items-center gap-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">{item.itemId}</span>
                    {item.title}
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">[{item.location}]</span>
                  </p>
                  {getStatusBadge(item.status)}
                </div>
                <p className="text-sm text-muted-foreground ml-10 mb-3">{item.description}</p>
                {item.status === 'nao_conforme' && (
                  <div className="ml-10 space-y-4">
                    {item.observation && (
                      <div className="bg-background border rounded-md p-3">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Observação do Motorista:</p>
                        <p className="text-sm italic">{item.observation}</p>
                      </div>
                    )}
                    {parseImages(item.images).length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Evidências Fotográficas:</p>
                        <div className="flex flex-wrap gap-3">
                          {parseImages(item.images).map((img: string, idx: number) => (
                            <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block relative h-24 w-24 rounded-lg overflow-hidden border shadow-sm hover:ring-2 hover:ring-primary transition-all">
                              <img src={img} alt={`Evidência ${idx}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default function ChecklistsTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';
  const isSuperAdmin = profile?.matricula === '801231';

  const [users, setUsers] = useState<Map<string, UserDto>>(new Map());
  const [allChecklists, setAllChecklists] = useState<ChecklistDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistDto | null>(null);

  useEffect(() => {
    if (!profile || !companyId || !sectorId || activeTab !== 'checklists') return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [sectorUsers, vehicles] = await Promise.all([
          api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`),
          api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`),
        ]);

        const usersMap = new Map<string, UserDto>();
        sectorUsers.forEach(u => usersMap.set(u.id, u));
        setUsers(usersMap);

        const checklistsByVehicle = await Promise.all(
          vehicles.map(v =>
            api.get<ChecklistDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${v.id}/checklists`).catch(() => [] as ChecklistDto[])
          )
        );

        const all = checklistsByVehicle.flat().sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setAllChecklists(all);
      } catch (error) {
        console.error("Error fetching checklists:", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar checklists' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile, companyId, sectorId, activeTab, toast]);

  const handleDelete = useCallback(async (checklistId: string) => {
    if (!isSuperAdmin) return;
    try {
      // Delete requires vehicleId — find it from the checklist
      const checklist = allChecklists.find(c => c.id === checklistId);
      if (!checklist) return;
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${checklist.vehicleId}/checklists/${checklistId}`);
      toast({ title: 'Sucesso', description: 'Checklist deletado com sucesso.' });
      setAllChecklists(prev => prev.filter(c => c.id !== checklistId));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar o checklist.' });
    }
  }, [companyId, sectorId, isSuperAdmin, allChecklists, toast]);

  const handleBlockVehicle = useCallback(async (vehicleId: string) => {
    try {
      await api.put(`/api/companies/${companyId}/sectors/${sectorId}/vehicles/${vehicleId}/status`, { status: 'BLOQUEADO_CHECKLIST' });
      toast({ title: 'Veículo Bloqueado', description: `O caminhão ${vehicleId} foi bloqueado com sucesso.` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível bloquear o caminhão.' });
    }
  }, [companyId, sectorId, toast]);

  const { filteredChecklists, vehicleList } = useMemo(() => {
    const vehicles = new Set<string>();
    allChecklists.forEach(c => vehicles.add(c.vehicleId));

    const filtered = allChecklists.filter(c => {
      const cDate = new Date(c.timestamp);
      if (date?.from && cDate < startOfDay(date.from)) return false;
      if (date?.to && cDate > endOfDay(date.to)) return false;
      if (selectedVehicle !== 'all' && c.vehicleId !== selectedVehicle) return false;
      return true;
    });

    return {
      filteredChecklists: filtered,
      vehicleList: Array.from(vehicles).sort(),
    };
  }, [allChecklists, date, selectedVehicle]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="shadow-sm border-t-4 border-primary">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" /> Histórico de Checklists
            </CardTitle>
            <CardDescription>Lista de checklists preenchidos no período.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filtrar por veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><Truck className="h-4 w-4 inline-block mr-2" />Todos os Veículos</SelectItem>
                {vehicleList.map(v => <SelectItem key={v} value={v}><Truck className="h-4 w-4 inline-block mr-2" />{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="date" variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: ptBR })} - {format(date.to, "LLL dd, y", { locale: ptBR })}</>) : (format(date.from, "LLL dd, y", { locale: ptBR }))) : (<span>Selecione uma data</span>)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Data/Hora</TableHead>
                <TableHead className="font-bold">Veículo</TableHead>
                <TableHead className="font-bold">Motorista</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChecklists.length > 0 ? (
                filteredChecklists.map((item) => (
                  <ChecklistTableRow
                    key={item.id}
                    checklist={item}
                    driver={users.get(item.driverId)}
                    onViewDetails={() => setSelectedChecklist(item)}
                    isSuperAdmin={isSuperAdmin}
                    onDelete={handleDelete}
                    onBlockVehicle={handleBlockVehicle}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                    Nenhum checklist encontrado para este filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <ChecklistDetailsDialog
          checklist={selectedChecklist}
          isOpen={selectedChecklist !== null}
          onClose={() => setSelectedChecklist(null)}
        />
      </CardContent>
    </Card>
  );
}
