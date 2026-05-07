'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Fuel, Loader2, Wallet, AlertTriangle } from 'lucide-react';
import {
  getCarUsuario,
  fetchVeiculos,
  fetchVeiculosMultiSetor,
  fetchCartao,
  descontarSaldo,
  type CarUsuario,
  CAR_RTDB_URL,
} from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';

type VeiculoOpt = { id: string; nome: string; placa: string };

export default function CarRefuelPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [selectedVeiculo, setSelectedVeiculo] = useState('');

  const handleVeiculoChange = (id: string) => {
    setSelectedVeiculo(id);
    if (usuario) loadSaldo(usuario, id);
  };
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saldoCartao, setSaldoCartao] = useState<number | null>(null);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);

    const load = async () => {
      setIsLoading(true);
      try {
        const isGrupo = u.setoresGrupo && u.setoresGrupo.length > 0;
        const veiculosData = isGrupo
          ? await fetchVeiculosMultiSetor(u.empresa, u.setoresGrupo!)
          : await fetchVeiculos(u.empresa, u.setor);
        if (veiculosData) {
          setVeiculos(
            Object.entries(veiculosData).map(([id, v]) => ({
              id,
              nome: id,
              placa: v.placa ?? id,
            }))
          );
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os veículos.' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const loadSaldo = async (u: CarUsuario, veiculoId: string) => {
    try {
      const parts = veiculoId.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : u.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : veiculoId;
      const cartao = await fetchCartao(u.empresa, targetSetor, targetVeiculo);
      setSaldoCartao(cartao?.saldo ?? 0);
    } catch {
      setSaldoCartao(null);
    }
  };

  const handleRegister = async () => {
    if (!usuario || !selectedVeiculo || !liters || !amount) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }
    if (parseFloat(liters) <= 0 || parseFloat(amount) <= 0) {
      toast({ variant: 'destructive', title: 'Valores inválidos', description: 'Litros e valor devem ser maiores que zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const parts = selectedVeiculo.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : selectedVeiculo;

      // Busca abastecimentos existentes para gerar ID
      const existentes = await fetch(
        `${CAR_RTDB_URL}/${usuario.empresa}/${targetSetor}/abastecimentos.json`,
        { cache: 'no-store' }
      ).then((r) => r.json());

      const novoId = existentes ? String(Object.keys(existentes).length) : '0';
      const agora = new Date();

      const registro = {
        veiculo: selectedVeiculo,
        responsavel: usuario.nome,
        matricula: usuario.mat,
        litros: parseFloat(liters),
        valor: parseFloat(amount),
        data: agora.toLocaleDateString('pt-BR'),
        horario: agora.toLocaleTimeString('pt-BR'),
      };

      const res = await fetch(
        `${CAR_RTDB_URL}/${usuario.empresa}/${targetSetor}/abastecimentos/${novoId}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registro),
        }
      );

      if (!res.ok) throw new Error('Erro ao registrar abastecimento');

      // Desconta do saldo do cartão do veículo
      const novoSaldo = await descontarSaldo(usuario.empresa, targetSetor, targetVeiculo, parseFloat(amount));
      setSaldoCartao(novoSaldo);

      toast({ title: 'Sucesso!', description: 'Abastecimento registrado.' });
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

      <div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Registrar Abastecimento</h1>
        </div>

        {/* Saldo do cartão */}
        {saldoCartao !== null && selectedVeiculo && (
          <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border ${
            saldoCartao <= 0
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
          }`}>
            {saldoCartao <= 0
              ? <AlertTriangle className="w-4 h-4 shrink-0" />
              : <Wallet className="w-4 h-4 shrink-0" />}
            <span className="text-sm font-semibold">
              Saldo do cartão ({selectedVeiculo}): {saldoCartao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              {saldoCartao <= 0 ? ' — Sem saldo disponível' : ''}
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Novo Registro</CardTitle>
            <CardDescription>Preencha as informações do abastecimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="veiculo-abast">Veículo</Label>
              <Select value={selectedVeiculo} onValueChange={handleVeiculoChange} disabled={isLoading}>
                <SelectTrigger id="veiculo-abast">
                  <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione um veículo'} />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome} — {v.placa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="litros">Litros (L)</Label>
              <Input id="litros" type="number" inputMode="decimal" placeholder="Ex: 50.5" value={liters} onChange={(e) => setLiters(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="valor">Valor Total (R$)</Label>
              <Input id="valor" type="number" inputMode="decimal" placeholder="Ex: 250.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleRegister} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fuel className="mr-2 h-4 w-4" />}
              Registrar Abastecimento
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
