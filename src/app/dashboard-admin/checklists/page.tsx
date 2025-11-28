
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, Timestamp, doc, deleteDoc, collection, getDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Truck, User, Search, FileText, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FirestoreUser } from '../history/page';


// --- Tipos ---
type FirebaseTimestamp = Timestamp;

type ChecklistItem = {
  id: string;
  location: string;
  title: string;
  description: string;
  status: 'conforme' | 'nao_conforme' | 'na';
  observation?: string;
};

type ChecklistRecord = {
    id: string;
    path: string; 
    vehicleId: string;
    driverId: string;
    driverName: string;
    timestamp: FirebaseTimestamp;
    items: ChecklistItem[];
}

type UserData = {
  name: string;
  isAdmin: boolean;
  companyId: string;
  sectorId: string;
};

const ChecklistHistoryPage = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [user, setUser] = useState<UserData | null>(null);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allChecklists, setAllChecklists] = useState<ChecklistRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    });
    const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
    const [selectedChecklist, setSelectedChecklist] = useState<ChecklistRecord | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        const matricula = localStorage.getItem('matricula');

        if (storedUser && companyId && sectorId) {
            setUser({ ...JSON.parse(storedUser), companyId, sectorId });
             if (matricula === '801231') {
                setIsSuperAdmin(true);
            }
        } else {
            router.push('/login');
        }
    }, [router]);
    
    const fetchUsers = useCallback(async () => {
        if (!firestore || !user) return;
        const usersCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/users`);
        const usersSnapshot = await getDocs(usersCol);
        const usersMap = new Map<string, FirestoreUser>();
        usersSnapshot.forEach(doc => {
            usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser);
        });
        setUsers(usersMap);
    }, [firestore, user]);

    const fetchChecklistData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);

        try {
            const checklistsQuery = query(
                collectionGroup(firestore, 'checklists')
            );
            const querySnapshot = await getDocs(checklistsQuery);
            const checklists = querySnapshot.docs.map(doc => ({
                id: doc.id,
                path: doc.ref.path,
                ...(doc.data() as Omit<ChecklistRecord, 'id' | 'path'>)
            }));

            // Client-side filtering for company/sector and sorting
            const companyPath = `companies/${user.companyId}/sectors/${user.sectorId}/`;
            const filteredAndSorted = checklists
                .filter(c => c.path.startsWith(companyPath))
                .sort((a,b) => b.timestamp.seconds - a.timestamp.seconds);

            setAllChecklists(filteredAndSorted);

        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar checklists', description: 'Ocorreu um erro ao buscar os checklists. Se o erro persistir, pode ser necessário criar um índice no Firestore.' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, user, toast]);

    useEffect(() => {
        if(user) {
            fetchUsers();
            fetchChecklistData();
        }
    }, [user, fetchChecklistData, fetchUsers]);

    const handleDelete = async (checklistPath: string) => {
        if (!firestore || !isSuperAdmin) return;
        try {
            await deleteDoc(doc(firestore, checklistPath));
            toast({ title: 'Sucesso', description: 'Checklist deletado com sucesso.' });
            fetchChecklistData(); // Refresh the list
        } catch (error) {
            console.error("Error deleting checklist:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível deletar o checklist.' });
        }
    };

    const { filteredChecklists, vehicleList } = useMemo(() => {
        const vehicles = new Set<string>();
        allChecklists.forEach(c => vehicles.add(c.vehicleId));

        const filtered = allChecklists.filter(checklist => {
            const checklistDate = new Date(checklist.timestamp.seconds * 1000);
            const isWithinDateRange = date?.from && checklistDate >= startOfDay(date.from) && checklistDate <= endOfDay(date.to || date.from);
            if (!isWithinDateRange) return false;

            if(selectedVehicle !== 'all' && checklist.vehicleId !== selectedVehicle) return false;

            return true;
        });

        return {
            filteredChecklists: filtered,
            vehicleList: Array.from(vehicles).sort(),
        };
    }, [allChecklists, date, selectedVehicle]);

    if (isLoading || !user) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Histórico de Checklists</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <VehicleFilter vehicles={vehicleList} selectedVehicle={selectedVehicle} onVehicleChange={setSelectedVehicle} />
                    <DateFilter date={date} setDate={setDate} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registros de Checklist</CardTitle>
                    <CardDescription>Lista de todos os checklists preenchidos no período selecionado.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? <div className="flex justify-center items-center h-[300px]"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                    <div className="overflow-auto max-h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Veículo</TableHead>
                                    <TableHead>Motorista</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredChecklists.length > 0 ? filteredChecklists.map(c => <ChecklistTableRow key={c.id} checklist={c} driver={users.get(c.driverId)} onViewDetails={() => setSelectedChecklist(c)} isSuperAdmin={isSuperAdmin} onDelete={handleDelete} />) : <TableRow><TableCell colSpan={5} className="text-center h-24">Nenhum checklist encontrado no período</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>}
                </CardContent>
            </Card>

            <ChecklistDetailsDialog
                checklist={selectedChecklist}
                isOpen={selectedChecklist !== null}
                onClose={() => setSelectedChecklist(null)}
            />
        </div>
    );
};

const ChecklistTableRow = ({ checklist, driver, onViewDetails, isSuperAdmin, onDelete }: { checklist: ChecklistRecord, driver?: FirestoreUser, onViewDetails: () => void, isSuperAdmin: boolean, onDelete: (path: string) => void }) => {
    const nonCompliantItems = checklist.items.filter(item => item.status === 'nao_conforme').length;

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('');
    }

    return (
        <TableRow>
            <TableCell>{format(new Date(checklist.timestamp.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell>
            <TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{checklist.vehicleId}</div></TableCell>
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
                {nonCompliantItems > 0 ? (
                    <Badge variant="destructive">{nonCompliantItems} item(ns) não conforme</Badge>
                ) : (
                    <Badge className="bg-green-600 hover:bg-green-700">Tudo conforme</Badge>
                )}
            </TableCell>
            <TableCell className="text-right font-medium space-x-2">
                <Button variant="outline" size="sm" onClick={onViewDetails}>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Detalhes
                </Button>
                {isSuperAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-1" /> Deletar
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isto irá apagar permanentemente o checklist do veículo {checklist.vehicleId} de {format(new Date(checklist.timestamp.seconds * 1000), 'dd/MM/yy')}.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(checklist.path)}>
                                  Confirmar
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                )}
            </TableCell>
        </TableRow>
    );
};

const DateFilter = ({ date, setDate }: { date: DateRange | undefined, setDate: (date: DateRange | undefined) => void }) => (
    <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className="w-full sm:w-[280px] justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd/MM/y", { locale: ptBR })} -{" "}
                  {format(date.to, "dd/MM/y", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd/MM/y", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
    </Popover>
);

const VehicleFilter = ({ vehicles, selectedVehicle, onVehicleChange }: { vehicles: string[], selectedVehicle: string, onVehicleChange: (vehicle: string) => void }) => (
    <Select value={selectedVehicle} onValueChange={onVehicleChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
             <SelectValue placeholder="Filtrar por veículo" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="all"><Search className="h-4 w-4 inline-block mr-2"/>Todos os Veículos</SelectItem>
            {vehicles.map(v => (
                <SelectItem key={v} value={v}><Truck className="h-4 w-4 inline-block mr-2"/>{v}</SelectItem>
            ))}
        </SelectContent>
    </Select>
);

const ChecklistDetailsDialog = ({ checklist, isOpen, onClose }: { checklist: ChecklistRecord | null, isOpen: boolean, onClose: () => void }) => {
    if (!checklist) return null;

    const getStatusBadge = (status: ChecklistItem['status']) => {
        switch(status) {
            case 'conforme': return <Badge className="bg-green-100 text-green-800 border-green-300">Conforme</Badge>;
            case 'nao_conforme': return <Badge variant="destructive">Não Conforme</Badge>;
            default: return <Badge variant="secondary">N/A</Badge>;
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Detalhes do Checklist</DialogTitle>
                    <DialogDescription>
                        Realizado por {checklist.driverName} no veículo {checklist.vehicleId} em {format(checklist.timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm")}.
                    </DialogDescription>
                </DialogHeader>
                <div className="h-[calc(80vh-120px)] overflow-y-auto space-y-3 pr-2">
                    {checklist.items.map(item => (
                        <div key={item.id} className="border rounded-md p-3">
                             <div className="flex justify-between items-center">
                                <p className="font-semibold">{item.id}. {item.title}</p>
                                {getStatusBadge(item.status)}
                             </div>
                             <p className="text-xs text-muted-foreground ml-6">{item.description}</p>
                             {item.status === 'nao_conforme' && item.observation && (
                                <p className="text-sm text-destructive-foreground bg-destructive/80 p-2 rounded-md mt-2 ml-6">
                                    <strong>Observação:</strong> {item.observation}
                                </p>
                             )}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}


export default ChecklistHistoryPage;
