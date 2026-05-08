'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Fuel } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import type { VehicleDto, CreateRefuelRequest } from '@/types/api';

export default function RefuelPage() {
  const router = useRouter();
  const { profile, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !profile) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Sessao invalida. Faca login novamente.' });
      router.push('/login');
    }
  }, [profile, isAuthLoading, router, toast]);

  useEffect(() => {
    if (!profile) return;

    const fetchVehicles = async () => {
      try {
        const companyId = localStorage.getItem('companyId') || profile.companyId;
        const sectorId = localStorage.getItem('sectorId') || profile.sectorId;
        if (!companyId || !sectorId) return;

        const data = await api.get<VehicleDto[]>(`/api/companies/${companyId}/sectors/${sectorId}/vehicles?isTruck=true`);
        setVehicles(data);
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel carregar os veiculos.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchVehicles();
  }, [profile, toast]);

  const handleRegisterRefuel = async () => {
    if (!profile || !selectedVehicle || !liters || !amount) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos para registrar.' });
      return;
    }

    if (parseFloat(liters) <= 0 || parseFloat(amount) <= 0) {
      toast({ variant: 'destructive', title: 'Valores invalidos', description: 'Litros e valor devem ser maiores que zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const companyId = localStorage.getItem('companyId') || profile.companyId;
      const sectorId = localStorage.getItem('sectorId') || profile.sectorId;
      if (!companyId || !sectorId) return;

      const body: CreateRefuelRequest = {
        driverId: profile.id,
        driverName: profile.name,
        vehicleId: selectedVehicle,
        liters: parseFloat(liters),
        amount: parseFloat(amount),
      };

      await api.post(`/api/companies/${companyId}/sectors/${sectorId}/refuels`, body);

      toast({ title: 'Sucesso', description: 'Abastecimento registrado com sucesso!' });
      router.push('/dashboard-truck');

    } catch (error) {
      console.error("Erro ao registrar abastecimento: ", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Nao foi possivel registrar o abastecimento.' });
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
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-truck')}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Registrar Abastecimento</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Novo Registro</CardTitle>
            <CardDescription>Preencha as informacoes do abastecimento abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="veiculo">Veiculo</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle} disabled={isLoading}>
                <SelectTrigger id="veiculo">
                  <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um veiculo"} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{`${v.id} - ${v.model}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="liters">Litros (L)</Label>
              <Input id="liters" type="number" placeholder="Ex: 50.5" value={liters} onChange={e => setLiters(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Valor Total (R$)</Label>
              <Input id="amount" type="number" placeholder="Ex: 250.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleRegisterRefuel}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fuel className="mr-2 h-4 w-4" />}
              Registrar Abastecimento
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
