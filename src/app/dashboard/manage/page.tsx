'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { UserDto, VehicleDto, RunSummaryDto, ManagerDto } from '@/types/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Loader2, User, Truck, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from './UserManagement';
import { VehicleManagement } from './VehicleManagement';
import { EmailManagement } from './EmailManagement';

const AdminManagementPage = () => {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const profile = auth.profile;
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';

  const [users, setUsers] = useState<UserDto[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [managers, setManagers] = useState<ManagerDto[]>([]);
  const [activeRuns, setActiveRuns] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      router.push('/login');
      return;
    }
  }, [profile, router]);

  const fetchUsers = useCallback(async () => {
    if (!companyId || !sectorId) return;
    try {
      const data = await api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/users`);
      setUsers(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ variant: 'destructive', title: 'Erro ao carregar usuários' });
    }
  }, [companyId, sectorId, toast]);

  const fetchVehicles = useCallback(async () => {
    if (!companyId || !sectorId) return;
    try {
      const data = await api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`);
      setVehicles(data.sort((a, b) => a.id.localeCompare(b.id)));
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({ variant: "destructive", title: "Erro ao buscar veículos" });
    }
  }, [companyId, sectorId, toast]);

  const fetchManagers = useCallback(async () => {
    if (!companyId || !sectorId) return;
    try {
      const data = await api.get<ManagerDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/managers`);
      setManagers(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching managers:", error);
      toast({ variant: "destructive", title: "Erro ao buscar gestores" });
    }
  }, [companyId, sectorId, toast]);

  const fetchActiveRuns = useCallback(async () => {
    if (!companyId || !sectorId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const summaries = await api.get<RunSummaryDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/runs?dateFrom=${today}T00:00:00&dateTo=${today}T23:59:59`);
      const runsMap: { [key: string]: boolean } = {};
      summaries.filter(s => s.status === 'IN_PROGRESS').forEach(s => {
        runsMap[s.vehicleId] = true;
      });
      setActiveRuns(runsMap);
    } catch { /* non-critical */ }
  }, [companyId, sectorId]);

  useEffect(() => {
    if (companyId && sectorId) {
      setIsLoading(true);
      Promise.all([fetchUsers(), fetchVehicles(), fetchManagers(), fetchActiveRuns()])
        .finally(() => setIsLoading(false));
    }
  }, [companyId, sectorId, fetchUsers, fetchVehicles, fetchManagers, fetchActiveRuns]);

  const handleDelete = useCallback(async (type: 'user' | 'vehicle' | 'manager', id: string) => {
    if (!companyId || !sectorId) return;
    const collectionName = type === 'user' ? 'users' : type === 'vehicle' ? 'vehicles' : 'managers';
    try {
      await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/${collectionName}/${id}`);
      const label = type === 'user' ? 'Usuário' : type === 'vehicle' ? 'Veículo' : 'Gestor';
      toast({ title: 'Sucesso', description: `${label} deletado com sucesso.` });
      if (type === 'user') fetchUsers();
      else if (type === 'vehicle') fetchVehicles();
      else fetchManagers();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível deletar o ${type === 'user' ? 'usuário' : type === 'vehicle' ? 'veículo' : 'gestor'}.` });
    }
  }, [companyId, sectorId, toast, fetchUsers, fetchVehicles, fetchManagers]);

  if (!profile) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Gerenciamento</h2>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users"><User className="mr-2 h-4 w-4" />Gerenciar Usuários</TabsTrigger>
          <TabsTrigger value="trucks"><Truck className="mr-2 h-4 w-4" />Gerenciar Caminhões</TabsTrigger>
          <TabsTrigger value="managers"><Mail className="mr-2 h-4 w-4" />Gestores do Setor</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Adicione, edite ou remova usuários existentes.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <UserManagement users={users} onDelete={handleDelete} onUpdate={fetchUsers} companyId={companyId} sectorId={sectorId} currentUser={profile} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="trucks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Caminhões</CardTitle>
              <CardDescription>Adicione, edite, remova ou gerencie a manutenção dos caminhões.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <VehicleManagement vehicles={vehicles} activeRuns={activeRuns} onDelete={handleDelete} onUpdate={fetchVehicles} companyId={companyId} sectorId={sectorId} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="managers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestores do Setor</CardTitle>
              <CardDescription>Gerencie os gestores que receberão cópias das notificações (ex: relatórios, alertas).</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <EmailManagement managers={managers} onDelete={handleDelete} onUpdate={fetchManagers} companyId={companyId} sectorId={sectorId} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminManagementPage;
