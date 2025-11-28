
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Truck, User, Fuel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FirestoreUser } from '../history/page';

// --- Tipos ---
type FirebaseTimestamp = Timestamp;

type RefuelRecord = {
    id: string;
    vehicleId: string;
    driverId: string;
    driverName: string;
    liters: number;
    amount: number;
    timestamp: FirebaseTimestamp;
}

type UserData = {
  name: string;
  isAdmin: boolean;
  companyId: string;
  sectorId: string;
};

const RefuelingHistoryPage = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [user, setUser] = useState<UserData | null>(null);
    const [users, setUsers] = useState<Map<string, FirestoreUser>>(new Map());
    const [allRefuels, setAllRefuels] = useState<RefuelRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const companyId = localStorage.getItem('companyId');
        const sectorId = localStorage.getItem('sectorId');
        if (storedUser && companyId && sectorId) {
            setUser({ ...JSON.parse(storedUser), companyId, sectorId });
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


    const fetchRefuelData = useCallback(async () => {
        if (!firestore || !user) return;
        setIsLoading(true);

        try {
            const refuelsQuery = query(
                collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/refuels`),
                orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(refuelsQuery);
            const refuels = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RefuelRecord));
            setAllRefuels(refuels);

        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar dados de abastecimento' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, user, toast]);

    useEffect(() => {
        if(user) {
            fetchUsers();
            fetchRefuelData();
        }
    }, [user, fetchRefuelData, fetchUsers]);

    const filteredRefuels = useMemo(() => {
        return allRefuels.filter(refuel => {
            const refuelDate = new Date(refuel.timestamp.seconds * 1000);
            return date?.from && refuelDate >= startOfDay(date.from) && refuelDate <= endOfDay(date.to || date.from);
        });
    }, [allRefuels, date]);

    if (isLoading || !user) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Histórico de Abastecimentos</h2>
                <DateFilter date={date} setDate={setDate} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Registros de Abastecimento</CardTitle>
                    <CardDescription>Lista de todos os abastecimentos no período selecionado.</CardDescription>
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
                                    <TableHead>Litros</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRefuels.length > 0 ? filteredRefuels.map(refuel => <RefuelTableRow key={refuel.id} refuel={refuel} driver={users.get(refuel.driverId)} />) : <TableRow><TableCell colSpan={5} className="text-center h-24">Nenhum abastecimento encontrado no período</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>}
                </CardContent>
            </Card>
        </div>
    );
};

const RefuelTableRow = ({ refuel, driver }: { refuel: RefuelRecord, driver?: FirestoreUser }) => {
    
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('');
    }

    return (
        <TableRow>
            <TableCell>{format(new Date(refuel.timestamp.seconds * 1000), 'dd/MM/yy HH:mm')}</TableCell>
            <TableCell><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/>{refuel.vehicleId}</div></TableCell>
            <TableCell>
                <div className="font-medium flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={driver?.photoURL} alt={refuel.driverName} />
                        <AvatarFallback className="text-xs">{getInitials(refuel.driverName)}</AvatarFallback>
                    </Avatar>
                    {refuel.driverName}
                </div>
            </TableCell>
            <TableCell><div className="flex items-center gap-2"><Fuel className="h-4 w-4 text-muted-foreground"/>{refuel.liters.toFixed(2)} L</div></TableCell>
            <TableCell className="text-right font-medium">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(refuel.amount)}
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

export default RefuelingHistoryPage;
