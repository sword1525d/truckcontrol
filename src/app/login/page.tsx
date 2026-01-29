'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/header';
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
  email: z.string().min(1, 'Matrícula é obrigatória'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type Company = { id: string; name: string };
type Sector = { id: string; name: string };

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore, auth, user, isUserLoading } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(true);
  const [isFetchingSectors, setIsFetchingSectors] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { companyId: '', sectorId: '', email: '', password: '' },
  });

  const selectedCompanyId = form.watch("companyId");

  useEffect(() => {
    if (user) {
        const storedUserData = localStorage.getItem('user');
        if (storedUserData) {
            const userData = JSON.parse(storedUserData);
            if (userData.isAdmin) {
                router.push('/dashboard');
                return;
            }
             if (userData.truck) {
                router.push('/dashboard-truck');
                return;
            }
        }
    }
  }, [user, router]);
  
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!firestore) return;
      setIsFetchingCompanies(true);
      try {
        const companiesCol = collection(firestore, 'companies');
        const companySnapshot = await getDocs(companiesCol);
        const companyList = companySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Company));
        setCompanies(companyList);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar as empresas.",
        });
      } finally {
        setIsFetchingCompanies(false);
      }
    };
    fetchCompanies();
  }, [firestore, toast]);

  useEffect(() => {
    const fetchSectors = async () => {
      if (!firestore || !selectedCompanyId) {
        setSectors([]);
        form.setValue("sectorId", "");
        return;
      }
      setIsFetchingSectors(true);
      form.setValue("sectorId", "");
      try {
        const sectorsCol = collection(firestore, `companies/${selectedCompanyId}/sectors`);
        const sectorSnapshot = await getDocs(sectorsCol);
        const sectorList = sectorSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sector));
        setSectors(sectorList);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os setores.",
        });
      } finally {
        setIsFetchingSectors(false);
      }
    };
    fetchSectors();
  }, [selectedCompanyId, firestore, form, toast]);


  async function onSubmit(data: LoginFormValues) {
    if (!firestore || !auth) return;
    setIsLoading(true);
    try {
      const email = `${data.email}@frotacontrol.com`;
      let password = data.password;
      if (password.length < 6) {
        password = password.padStart(6, '0');
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const authUser = userCredential.user;
      
      const userDocRef = doc(firestore, `companies/${data.companyId}/sectors/${data.sectorId}/users`, authUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        localStorage.setItem('user', JSON.stringify({ ...userData, id: authUser.uid }));
        localStorage.setItem('companyId', data.companyId);
        localStorage.setItem('sectorId', data.sectorId);
        localStorage.setItem('matricula', data.email);
        toast({ title: 'Login bem-sucedido!' });
        router.push(userData.isAdmin ? '/dashboard' : '/dashboard-truck');
      } else {
        throw new Error("Usuário não pertence ao setor selecionado.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no Login",
        description: "Matrícula, senha ou setor incorretos. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (isUserLoading || user) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
                                <SelectValue placeholder={isFetchingCompanies ? "Carregando..." : "Selecione a empresa"} />
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
                                <SelectValue placeholder={isFetchingSectors ? "Carregando..." : "Selecione o setor"} />
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
                      <FormLabel>Matrícula</FormLabel>
                      <FormControl>
                        <Input placeholder="Sua matrícula" {...field} />
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
                        <Input type="password" placeholder="Sua senha" {...field} />
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
    </>
  );
}
