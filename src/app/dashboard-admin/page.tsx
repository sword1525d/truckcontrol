
'use client';
import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, User, Wrench, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type UserData = {
  name: string;
  isAdmin: boolean;
  companyId: string;
  sectorId: string;
};

type VehicleStatusEnum = 'PARADO' | 'EM_CORRIDA' | 'EM_MANUTENCAO';

export type Vehicle = {
  id: string;
  model: string;
  isTruck: boolean;
  status: VehicleStatusEnum;
};

type VehicleWithDriver = Vehicle & {
  driverName?: string;
}

const AdminDashboardPage = () => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
  const [user, setUser] = useState<UserData | null>(null);
  const [vehicleStatuses, setVehicleStatuses] = useState<VehicleWithDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Efeito para carregar dados do usuário da sessão
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');

    if (storedUser && companyId && sectorId) {
      const parsedUser = JSON.parse(storedUser);
      if (!parsedUser.isAdmin) {
          toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem permissão para acessar esta página.' });
          router.push('/login');
          return;
      }
      setUser({ ...parsedUser, companyId, sectorId });
    } else {
      toast({ variant: 'destructive', title: 'Sessão inválida', description: 'Faça login novamente.' });
      router.push('/login');
    }
  }, [router, toast]);
  
  // Efeito para buscar todos os dados (corridas e veículos)
  useEffect(() => {
    if (!firestore || !user) return;

    setIsLoading(true);
    
    const vehiclesCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/vehicles`);
    const vehiclesQuery = query(vehiclesCol, where('isTruck', '==', true));
    
    const unsubscribeVehicles = onSnapshot(vehiclesQuery, (vehiclesSnapshot) => {
        const allTrucks = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));

        const runsCol = collection(firestore, `companies/${user.companyId}/sectors/${user.sectorId}/runs`);
        const activeRunsQuery = query(runsCol, where('status', '==', 'IN_PROGRESS'));

        const unsubscribeRuns = onSnapshot(activeRunsQuery, (runsSnapshot) => {
            const activeRunsMap = new Map(runsSnapshot.docs.map(doc => {
                const data = doc.data();
                return [data.vehicleId, data.driverName];
            }));

            const statuses: VehicleWithDriver[] = allTrucks.map(truck => {
                const driverName = activeRunsMap.get(truck.id);
                const vehicleStatus = truck.status || 'PARADO';
                
                return {
                    ...truck,
                    status: driverName ? 'EM_CORRIDA' : vehicleStatus,
                    driverName: driverName
                };
            });

            setVehicleStatuses(statuses);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching active runs: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar corridas' });
            setIsLoading(false);
        });
        
        return () => unsubscribeRuns();
    }, (error) => {
        console.error("Error fetching vehicles: ", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar veículos' });
        setIsLoading(false);
    });

    return () => unsubscribeVehicles();
  }, [firestore, user, toast]);

  if (!user || isLoading) {
     return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const kpis = {
    total: vehicleStatuses.length,
    emCorrida: vehicleStatuses.filter(v => v.status === 'EM_CORRIDA').length,
    parado: vehicleStatuses.filter(v => v.status === 'PARADO').length,
    emManutencao: vehicleStatuses.filter(v => v.status === 'EM_MANUTENCAO').length,
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Frota Total" value={kpis.total} icon={Truck} />
        <KpiCard title="Em Corrida" value={kpis.emCorrida} icon={PlayCircle} />
        <KpiCard title="Parados" value={kpis.parado} icon={Truck} />
        <KpiCard title="Em Manutenção" value={kpis.emManutencao} icon={Wrench} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-6 w-6"/> Status da Frota</CardTitle>
          <CardDescription>Visão geral de todos os caminhões do setor.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : vehicleStatuses.length === 0 ? (
            <p className="text-muted-foreground text-center">Nenhum caminhão encontrado neste setor.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {vehicleStatuses.map(vehicle => (
                <VehicleStatusCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ title, value, icon: Icon }: { title: string, value: number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const VehicleStatusCard = ({ vehicle }: { vehicle: VehicleWithDriver }) => {
  const getStatusDetails = (status: VehicleStatusEnum | undefined) => {
    switch (status) {
      case 'EM_CORRIDA':
        return { text: 'EM CORRIDA', badgeClass: 'bg-blue-600', cardClass: 'bg-blue-50 dark:bg-blue-900/30' };
      case 'EM_MANUTENCAO':
        return { text: 'MANUTENÇÃO', badgeClass: 'bg-yellow-500', cardClass: 'bg-yellow-50 dark:bg-yellow-900/30' };
      case 'PARADO':
      default:
        return { text: 'PARADO', badgeClass: 'bg-green-600', cardClass: 'bg-green-50 dark:bg-green-800/30' };
    }
  };

  const { text, badgeClass, cardClass } = getStatusDetails(vehicle.status);

  return (
    <Card className={`flex flex-col items-center justify-center p-4 text-center ${cardClass}`}>
        <p className="font-bold text-lg">{vehicle.id}</p>
        <p className="text-xs text-muted-foreground -mt-1 mb-2">{vehicle.model}</p>
        <Badge variant={'default'} className={`${badgeClass} hover:${badgeClass}`}>
            {text}
        </Badge>
        {vehicle.status === 'EM_CORRIDA' && vehicle.driverName && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <User className="h-3 w-3"/>{vehicle.driverName}
            </p>
        )}
    </Card>
  )
}

export default AdminDashboardPage;

    