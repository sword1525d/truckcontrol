'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const loginSchema = z.object({
  companyId: z.string().min(1, "Selecione uma empresa"),
  sectorId: z.string().min(1, "Selecione um setor"),
  email: z.string().min(1, 'Matricula e obrigatoria'),
  password: z.string().min(1, 'Senha e obrigatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type Company = { id: string; name: string };
type Sector = { id: string; name: string };

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { profile, isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(true);
  const [isFetchingSectors, setIsFetchingSectors] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      companyId: typeof window !== 'undefined' ? localStorage.getItem('lastCompanyId') || '' : '',
      sectorId: typeof window !== 'undefined' ? localStorage.getItem('lastSectorId') || '' : '',
      email: typeof window !== 'undefined' ? localStorage.getItem('lastMatricula') || '' : '',
      password: ''
    },
  });

  const selectedCompanyId = form.watch("companyId");

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && profile) {
      router.push(profile.isAdmin ? '/dashboard' : '/dashboard-truck');
    }
  }, [profile, isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    const fetchCompanies = async () => {
      setIsFetchingCompanies(true);
      try {
        const data = await api.get<Company[]>('/api/companies');
        setCompanies(data);
      } catch {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Nao foi possivel carregar as empresas.",
        });
      } finally {
        setIsFetchingCompanies(false);
      }
    };
    fetchCompanies();
  }, [toast]);

  useEffect(() => {
    const fetchSectors = async () => {
      if (!selectedCompanyId) {
        setSectors([]);
        form.setValue("sectorId", "");
        return;
      }
      setIsFetchingSectors(true);
      form.setValue("sectorId", "");
      try {
        const data = await api.get<Sector[]>(`/api/companies/${selectedCompanyId}/sectors`);
        setSectors(data);
      } catch {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Nao foi possivel carregar os setores.",
        });
      } finally {
        setIsFetchingSectors(false);
      }
    };
    fetchSectors();
  }, [selectedCompanyId, form, toast]);


  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      const userProfile = await login(data.email, data.password, data.companyId, data.sectorId);

      localStorage.setItem('companyId', data.companyId);
      localStorage.setItem('sectorId', data.sectorId);

      // Save for pre-filling next time
      localStorage.setItem('lastCompanyId', data.companyId);
      localStorage.setItem('lastSectorId', data.sectorId);
      localStorage.setItem('lastMatricula', data.email);
      localStorage.setItem('matricula', data.email);

      toast({ title: 'Login bem-sucedido!' });
      router.push(userProfile.isAdmin ? '/dashboard' : '/dashboard-truck');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no Login",
        description: error.message || "Matricula, senha ou setor incorretos. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isAuthLoading || (isAuthenticated && profile)) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Carregando acesso...</p>
        </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex flex-grow items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Entre com suas credenciais para acessar o painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Empresa</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isFetchingCompanies}>
                            <FormControl>
                            <SelectTrigger>
                                {isFetchingCompanies ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <Skeleton className="h-4 w-28" />
                                    </div>
                                ) : (
                                    <SelectValue placeholder="Selecione a empresa" />
                                )}
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                {company.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="sectorId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Setor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCompanyId || isFetchingSectors}>
                            <FormControl>
                            <SelectTrigger>
                                {isFetchingSectors ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <Skeleton className="h-4 w-28" />
                                    </div>
                                ) : (
                                    <SelectValue placeholder="Selecione o setor" />
                                )}
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {sectors.map((sector) => (
                                <SelectItem key={sector.id} value={sector.id}>
                                {sector.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matricula ou E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="Sua matricula ou e-mail" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Sua senha" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                   {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}
