'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CreditCard, Plus, Loader2, TrendingDown,
  TrendingUp, Wallet, History, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { CarHeader } from '@/components/car-header';
import {
  getCarUsuario, fetchVeiculos, fetchVeiculosMultiSetor,
  fetchCartao, registrarRecarga,
  type CarUsuario, type CartaoData, type CartaoRecarga,
} from '@/lib/car-rtdb';
import { cn } from '@/lib/utils';

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [veiculos, setVeiculos] = useState<{ id: string }[]>([]);
  const [selectedVeiculo, setSelectedVeiculo] = useState('');
  const [cartao, setCartao] = useState<CartaoData | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingCartao, setIsLoadingCartao] = useState(false);
  const [showRecarrega, setShowRecarga] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [valorRecarga, setValorRecarga] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);
    const isGrupo = u.setoresGrupo && u.setoresGrupo.length > 0;
    (isGrupo
      ? fetchVeiculosMultiSetor(u.empresa, u.setoresGrupo!)
      : fetchVeiculos(u.empresa, u.setor)
    ).then(data => { if (data) setVeiculos(Object.keys(data).map(id => ({ id }))); })
     .finally(() => setIsLoadingList(false));
  }, [router]);

  const loadCartao = useCallback(async (veiculoId: string) => {
    if (!usuario) return;
    setIsLoadingCartao(true);
    try {
      const parts = veiculoId.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : veiculoId;
      const data = await fetchCartao(usuario.empresa, targetSetor, targetVeiculo);
      setCartao(data ?? { saldo: 0 });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar o cartão.' });
    } finally {
      setIsLoadingCartao(false);
    }
  }, [usuario, toast]);

  const handleSelectVeiculo = (id: string) => {
    setSelectedVeiculo(id);
    setCartao(null);
    setShowRecarga(false);
    setShowHistorico(false);
    loadCartao(id);
  };

  const handleRecarga = async () => {
    if (!usuario || !selectedVeiculo || !valorRecarga) return;
    const valor = parseFloat(valorRecarga);
    if (isNaN(valor) || valor <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Informe um valor maior que zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const agora = new Date();
      const recarga: CartaoRecarga = {
        valor,
        data: agora.toLocaleDateString('pt-BR'),
        hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        responsavel: usuario.nome,
      };
      const parts = selectedVeiculo.split('/');
      const targetSetor = parts.length > 1 ? parts[0] : usuario.setor;
      const targetVeiculo = parts.length > 1 ? parts.slice(1).join('/') : selectedVeiculo;
      await registrarRecarga(
        usuario.empresa, targetSetor, targetVeiculo,
        recarga, cartao?.saldo ?? 0
      );
      toast({ title: 'Recarga registrada!', description: `${formatBRL(valor)} adicionado ao cartão de ${selectedVeiculo}.` });
      setValorRecarga('');
      setShowRecarga(false);
      await loadCartao(selectedVeiculo);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const recargas = cartao?.recargas
    ? Object.entries(cartao.recargas)
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) => Number(b.id) - Number(a.id))
    : [];

  const saldo = cartao?.saldo ?? 0;
  const saldoPositivo = saldo > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-2xl pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cartão de Abastecimento</h1>
            <p className="text-sm text-muted-foreground">Saldo e recargas por veículo</p>
          </div>
        </div>

        {/* Seleção de veículo */}
        <Card className="mb-4">
          <CardContent className="p-6 space-y-2">
            <Label htmlFor="veiculo-cartao" className="text-sm font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> VEÍCULO
            </Label>
            <Select value={selectedVeiculo} onValueChange={handleSelectVeiculo} disabled={isLoadingList}>
              <SelectTrigger id="veiculo-cartao" className="h-12">
                <SelectValue placeholder={isLoadingList ? 'Carregando...' : 'Selecione o veículo'} />
              </SelectTrigger>
              <SelectContent>
                {veiculos.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoadingCartao && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando cartão...</span>
          </div>
        )}

        {/* Cartão do veículo */}
        {cartao && !isLoadingCartao && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Saldo */}
            <Card className={cn(
              'border-2 overflow-hidden',
              saldoPositivo
                ? 'border-green-200 dark:border-green-800'
                : 'border-red-200 dark:border-red-800'
            )}>
              <div className={cn(
                'px-6 pt-6 pb-4',
                saldoPositivo
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className={cn('w-4 h-4', saldoPositivo ? 'text-green-600' : 'text-red-600')} />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saldo Disponível</p>
                </div>
                <p className={cn(
                  'text-4xl font-black tabular-nums',
                  saldoPositivo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {formatBRL(saldo)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Cartão: {selectedVeiculo}</p>
              </div>

              {/* Ações */}
              <CardContent className="p-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => { setShowRecarga(v => !v); setShowHistorico(false); }}
                >
                  <Plus className="w-4 h-4" />
                  Registrar Recarga
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 gap-2"
                  onClick={() => { setShowHistorico(v => !v); setShowRecarga(false); }}
                >
                  <History className="w-4 h-4" />
                  Histórico
                  {showHistorico ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </CardContent>
            </Card>

            {/* Formulário de Recarga */}
            {showRecarrega && (
              <Card className="animate-in slide-in-from-top-2 duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" /> Nova Recarga
                  </CardTitle>
                  <CardDescription>O valor será somado ao saldo atual do veículo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="valor-recarga">Valor da Recarga (R$)</Label>
                    <Input
                      id="valor-recarga"
                      type="number"
                      inputMode="decimal"
                      placeholder="Ex: 300.00"
                      value={valorRecarga}
                      onChange={e => setValorRecarga(e.target.value)}
                      className="h-12 text-lg font-semibold"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleRecarga}
                      disabled={isSubmitting || !valorRecarga}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                      Confirmar Recarga
                    </Button>
                    <Button variant="outline" onClick={() => { setShowRecarga(false); setValorRecarga(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Histórico de Recargas */}
            {showHistorico && (
              <Card className="animate-in slide-in-from-top-2 duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4" /> Histórico de Recargas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {recargas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma recarga registrada.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {recargas.map((r, i) => (
                        <div key={r.id} className="flex items-center justify-between px-6 py-3">
                          <div>
                            <p className="text-sm font-semibold">{r.responsavel}</p>
                            <p className="text-xs text-muted-foreground">{r.data} às {r.hora}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="font-bold text-sm">{formatBRL(r.valor)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selectedVeiculo && !isLoadingCartao && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="bg-muted rounded-full p-5">
              <CreditCard className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[220px]">
              Selecione um veículo para visualizar o cartão de abastecimento
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
