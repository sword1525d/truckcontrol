'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  carLogin,
  fetchEmpresas,
  fetchSetores,
  getCarUsuario,
} from '@/lib/car-rtdb';
import Link from 'next/link';

type Company = { id: string; name: string };
type Sector = { id: string; name: string };

export default function LoginCarPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(true);
  const [isFetchingSectors, setIsFetchingSectors] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);

  const [empresa, setEmpresa] = useState('');
  const [setor, setSetor] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');

  // Se já logado, redireciona
  useEffect(() => {
    if (getCarUsuario()) {
      router.replace('/dashboard-car');
    }
  }, [router]);

  // Carrega empresas
  useEffect(() => {
    const load = async () => {
      setIsFetchingCompanies(true);
      try {
        const data = await fetchEmpresas();
        if (data) {
          setCompanies(
            Object.keys(data).map((k) => ({ id: k, name: k }))
          );
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as empresas.' });
      } finally {
        setIsFetchingCompanies(false);
      }
    };
    load();
  }, [toast]);

  // Carrega setores ao mudar empresa
  useEffect(() => {
    if (!empresa) { setSectors([]); return; }
    const load = async () => {
      setIsFetchingSectors(true);
      setSetor('');
      setSectors([]);
      try {
        const data = await fetchSetores(empresa);
        if (data) {
          setSectors(Object.keys(data).map((k) => ({ id: k, name: k })));
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os setores.' });
      } finally {
        setIsFetchingSectors(false);
      }
    };
    load();
  }, [empresa, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa || !setor || !matricula || !senha) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }
    setIsLoading(true);
    try {
      await carLogin(empresa, setor, matricula.trim(), senha.trim());
      toast({ title: 'Login realizado!', description: 'Bem-vindo ao FrotaControl.' });
      router.push('/dashboard-car');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro no Login', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Header minimal */}
      <header className="bg-background sticky top-0 z-40 border-b">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Car className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">FrotaControl <span className="text-primary text-sm font-medium">Carro</span></h1>
        </div>
      </header>

      <div className="flex flex-grow items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full">Modo Carro</span>
            </div>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>Acesse com suas credenciais de motorista.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Empresa */}
              <div className="space-y-1">
                <Label htmlFor="car-empresa">Empresa</Label>
                <Select value={empresa} onValueChange={setEmpresa} disabled={isFetchingCompanies}>
                  <SelectTrigger id="car-empresa">
                    {isFetchingCompanies
                      ? <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /><Skeleton className="h-4 w-28" /></div>
                      : <SelectValue placeholder="Selecione a empresa" />}
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Setor */}
              <div className="space-y-1">
                <Label htmlFor="car-setor">Setor</Label>
                <Select value={setor} onValueChange={setSetor} disabled={!empresa || isFetchingSectors}>
                  <SelectTrigger id="car-setor">
                    {isFetchingSectors
                      ? <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /><Skeleton className="h-4 w-28" /></div>
                      : <SelectValue placeholder="Selecione o setor" />}
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Matrícula */}
              <div className="space-y-1">
                <Label htmlFor="car-matricula">Matrícula</Label>
                <Input
                  id="car-matricula"
                  placeholder="Sua matrícula"
                  autoComplete="off"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                />
              </div>

              {/* Senha */}
              <div className="space-y-1">
                <Label htmlFor="car-senha">Senha</Label>
                <Input
                  id="car-senha"
                  type="password"
                  placeholder="Sua senha"
                  autoComplete="off"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
