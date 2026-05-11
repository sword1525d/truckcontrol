'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { RefuelDto, UserDto } from '@/types/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Truck, User, Calendar as CalendarIcon, Fuel, Trash2 } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');

export default function AbastecimentosTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';
  const isSuperAdmin = profile?.matricula === '801231';

  const [users, setUsers] = useState<Map<string, UserDto>>(new Map());
  const [allRefuels, setAllRefuels] = useState<RefuelDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');

  useEffect(() => {
    if (!profile || !companyId || !sectorId || activeTab !== 'abastecimentos') return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [sectorUsers, refuels] = await Promise.all([
          api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`),
          api.get<RefuelDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/refuels`),
        ]);

        const usersMap = new Map<string, UserDto>();
        sectorUsers.forEach(u => usersMap.set(u.id, u));
        setUsers(usersMap);
        setAllRefuels(refuels);
      } catch (error) {
        console.error("Error fetching refuels:", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar abastecimentos' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile, companyId, sectorId, activeTab, toast]);

  const handleDelete = useCallback(async (refuelId: string) => {
    if (!isSuperAdmin) return;
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/refuels/${refuelId}`);
      toast({ title: 'Sucesso', description: 'Abastecimento removido com sucesso.' });
      setAllRefuels(prev => prev.filter(r => r.id !== refuelId));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o abastecimento.' });
    }
  }, [companyId, sectorId, isSuperAdmin, toast]);

  const { filteredRefuels, vehicleList } = useMemo(() => {
    const vehicles = new Set<string>();
    allRefuels.forEach(r => vehicles.add(r.vehicleId));

    const filtered = allRefuels.filter(r => {
      const rDate = new Date(r.timestamp);
      if (date?.from && rDate < startOfDay(date.from)) return false;
      if (date?.to && rDate > endOfDay(date.to)) return false;
      if (selectedVehicle !== 'all' && r.vehicleId !== selectedVehicle) return false;
      return true;
    });

    return {
      filteredRefuels: filtered,
      vehicleList: Array.from(vehicles).sort(),
    };
  }, [allRefuels, date, selectedVehicle]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="shadow-sm border-t-4 border-primary">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Fuel className="h-6 w-6 text-primary" /> Histórico de Abastecimentos
            </CardTitle>
            <CardDescription>Lista de abastecimentos registrados no período.</CardDescription>
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
                <TableHead className="font-bold">Litros</TableHead>
                <TableHead className="text-right font-bold">Valor</TableHead>
                {isSuperAdmin && <TableHead className="text-right font-bold">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRefuels.length > 0 ? (
                filteredRefuels.map((refuel) => {
                  const driver = users.get(refuel.driverId);
                  return (
                    <TableRow key={refuel.id}>
                      <TableCell>{format(new Date(refuel.timestamp), 'dd/MM/yy HH:mm')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          {refuel.vehicleId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={driver?.photoURL} alt={refuel.driverName} />
                            <AvatarFallback className="text-xs">{getInitials(refuel.driverName)}</AvatarFallback>
                          </Avatar>
                          {refuel.driverName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Fuel className="h-4 w-4 text-muted-foreground" />
                          {refuel.liters != null ? `${refuel.liters.toFixed(2)} L` : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {refuel.amount != null
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(refuel.amount)
                          : '-'}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>Deseja realmente excluir este registro de abastecimento? Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(refuel.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center py-10 text-muted-foreground italic">
                    Nenhum abastecimento encontrado para este filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
