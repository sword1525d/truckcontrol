"use client";

import React, { useState, useEffect } from 'react';
import { Truck, LogOut, Shield, User as UserIcon, Settings, LayoutDashboard, RefreshCcw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from './ui/skeleton';

export function Header() {
  const { user, auth, isUserLoading } = useFirebase();
  const router = useRouter();
  const [dashboardPath, setDashboardPath] = useState('#');
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [matricula, setMatricula] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedMatricula = localStorage.getItem('matricula');
    setMatricula(storedMatricula);

    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            if (userData.isAdmin) {
                setUserIsAdmin(true);
                setDashboardPath('/dashboard');
            } else {
                setUserIsAdmin(false);
                setDashboardPath('/dashboard-truck');
            }
        } catch (e) {
            setUserIsAdmin(false);
            setDashboardPath('/dashboard-truck');
        }
    } else {
        setUserIsAdmin(false);
        setDashboardPath('/dashboard-truck');
    }
  }, []);

  const { firestore } = useFirebase();

  const handleResetApp = async () => {
    const companyId = localStorage.getItem('companyId');
    if (!companyId || !firestore) return;

    setIsResetting(true);
    try {
        const sectorsSnapshot = await getDocs(collection(firestore, `companies/${companyId}/sectors`));
        let totalDeleted = 0;

        for (const sectorDoc of sectorsSnapshot.docs) {
            const runsSnapshot = await getDocs(collection(firestore, `companies/${companyId}/sectors/${sectorDoc.id}/runs`));
            
            // Delete in VERY small batches of 5 to avoid 'Transaction too big' error
            // Each run can have thousands of location points (up to 1MB per doc)
            const docs = runsSnapshot.docs;
            for (let i = 0; i < docs.length; i += 5) {
                const batch = writeBatch(firestore);
                const chunk = docs.slice(i, i + 5);
                chunk.forEach(runDoc => {
                    batch.delete(runDoc.ref);
                    totalDeleted++;
                });
                await batch.commit();
            }
        }

        alert(`Sucesso! ${totalDeleted} corridas foram apagadas de todos os setores.`);
        setShowResetDialog(false);
        window.location.reload();
    } catch (error) {
        console.error("Erro ao resetar app:", error);
        alert("Erro ao resetar: " + (error as any).message);
    } finally {
        setIsResetting(false);
    }
  };

  const handleLogout = () => {
    if (auth) {
        auth.signOut();
    }
    localStorage.clear();
    router.push('/login');
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '...';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <header className="bg-background sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={dashboardPath} className="flex items-center gap-3">
            <Truck className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Frotacontrol</h1>
          </Link>

          <div className="flex items-center gap-4">
            {isUserLoading && (
              <Skeleton className="h-9 w-9 rounded-full" />
            )}

            {!isUserLoading && user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-9 w-9">
                         <AvatarImage src={user.photoURL || undefined} alt={user.displayName || ''} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {userIsAdmin ? (
                       <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          <span>Painel de Controle</span>
                      </DropdownMenuItem>
                    ) : (
                       <DropdownMenuItem onClick={() => router.push('/dashboard-truck')}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Painel do Motorista</span>
                      </DropdownMenuItem>
                    )}

                    {userIsAdmin && (
                        <>
                          <DropdownMenuItem onClick={() => router.push('/dashboard/manage')}>
                              <UserIcon className="mr-2 h-4 w-4" />
                              <span>Gerenciamento</span>
                          </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                              <Settings className="mr-2 h-4 w-4" />
                              <span>Configurações</span>
                          </DropdownMenuItem>
                        </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>

                    {matricula === '801231' && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                onSelect={(e) => {
                                    e.preventDefault();
                                    setShowResetDialog(true);
                                }}
                            >
                                <RefreshCcw className={cn("mr-2 h-4 w-4", isResetting && "animate-spin")} />
                                <span>Reiniciar App (Secret)</span>
                            </DropdownMenuItem>
                        </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
            )}

            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent className="border-destructive">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Ação Crítica e Irreversível
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso irá apagar <strong>TODAS as corridas</strong> de todos os setores e motoristas da empresa. 
                            Tem certeza que deseja reiniciar o banco de dados de corridas?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleResetApp} 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isResetting}
                        >
                            {isResetting ? "Apagando..." : "Sim, apagar TUDO"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </header>
  );
}
