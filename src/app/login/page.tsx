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
    defaultValues: { 
      companyId: typeof window !== 'undefined' ? localStorage.getItem('lastCompanyId') || '' : '', 
      sectorId: typeof window !== 'undefined' ? localStorage.getItem('lastSectorId') || '' : '', 
      email: typeof window !== 'undefined' ? localStorage.getItem('lastMatricula') || '' : '', 
      password: '' 
    },
  });

  const selectedCompanyId = form.watch("companyId");

  useEffect(() => {
    if (user && !isUserLoading) {
        const storedUserData = localStorage.getItem('user');
        if (storedUserData) {
            const userData = JSON.parse(storedUserData);
            router.push(userData.isAdmin ? '/dashboard' : '/dashboard-truck');
        }
    }
  }, [user, isUserLoading, router]);
  
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
      let email = data.email;
      if (!email.includes('@')) {
          email = `${email}@frotacontrol.com`;
      }
      let password = data.password;
      if (password.length < 6) {
        password = password.padStart(6, '0');
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const authUser = userCredential.user;
      
      const selectedSector = sectors.find(s => s.id === data.sectorId);
      const selectedSectorName = selectedSector?.name || '';
      
      const userDocRef = doc(firestore, `companies/${data.companyId}/sectors/${data.sectorId}/users`, authUser.uid);
      const userDoc = await getDoc(userDocRef);

      let userData = userDoc.exists() ? userDoc.data() : null;

      // Se não encontrou no setor selecionado, verifica em outros setores se é admin
      if (!userData) {
          const sectorsSnapshot = await getDocs(collection(firestore, `companies/${data.companyId}/sectors`));
          for (const sectorDoc of sectorsSnapshot.docs) {
              const otherUserDocRef = doc(firestore, `companies/${data.companyId}/sectors/${sectorDoc.id}/users`, authUser.uid);
              const otherUserDoc = await getDoc(otherUserDocRef);
              if (otherUserDoc.exists()) {
                  const otherUserData = otherUserDoc.data();
                  if (otherUserData.isAdmin) {
                      userData = otherUserData;
                      break;
                  }
              }
          }
      }

      if (userData) {
        localStorage.setItem('user', JSON.stringify({ ...userData, id: authUser.uid }));
        localStorage.setItem('companyId', data.companyId);
        localStorage.setItem('sectorId', data.sectorId);
        localStorage.setItem('sectorName', selectedSectorName);
        localStorage.setItem('matricula', data.email);
        
        // Save for pre-filling next time
        localStorage.setItem('lastCompanyId', data.companyId);
        localStorage.setItem('lastSectorId', data.sectorId);
        localStorage.setItem('lastMatricula', data.email);
        
        toast({ title: 'Login bem-sucedido!' });
        router.push(userData.isAdmin ? '/dashboard' : '/dashboard-truck');
      } else {
        throw new Error("Usuário não pertence ao setor selecionado ou não é administrador.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no Login",
        description: error.message || "Matrícula, senha ou setor incorretos. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Only block the whole screen if we are still determining auth state AND have a user to redirect
  if (isUserLoading || (user && typeof window !== 'undefined' && localStorage.getItem('user'))) {
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
                      <FormLabel>Matrícula ou E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="Sua matrícula ou e-mail" autoComplete="off" {...field} />
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
