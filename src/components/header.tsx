"use client";

import React, { useState, useEffect } from 'react';
import { Truck, LogOut, Shield, User as UserIcon, Settings, LayoutDashboard, RefreshCcw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from './ui/skeleton';
import { api } from '@/lib/api-client';

export function Header() {
  const { profile, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const isAdmin = profile?.isAdmin ?? false;
  const dashboardPath = isAdmin ? '/dashboard' : '/dashboard-truck';

  const handleResetApp = async () => {
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');
    if (!companyId || !sectorId) return;

    setIsResetting(true);
    try {
      const runs = await api.get(`/api/companies/${companyId}/sectors/${sectorId}/runs`);
      let totalDeleted = 0;

      if (Array.isArray(runs)) {
        for (const run of runs as { id: string }[]) {
          await api.delete(`/api/companies/${companyId}/sectors/${sectorId}/runs/${run.id}`);
          totalDeleted++;
        }
      }

      alert(`Sucesso! ${totalDeleted} corridas foram apagadas.`);
      setShowResetDialog(false);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao resetar app:", error);
      alert("Erro ao resetar: " + (error as Error).message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '...';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  const matricula = profile?.matricula ?? localStorage.getItem('matricula');

  return (
    <header className="bg-background sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={dashboardPath} className="flex items-center gap-3">
            <Truck className="h-7 w-7 text-primary" />

            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Frotacontrol</h1>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-medium italic">by</span>
                <img src="/logo_lsl.png" alt="LSL" className="h-4 w-auto" />
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {!isLoginPage && isLoading && (
              <Skeleton className="h-9 w-9 rounded-full" />
            )}

            {!isLoginPage && !isLoading && isAuthenticated && profile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-9 w-9">
                         <AvatarImage src={profile.photoURL || undefined} alt={profile.name || ''} />
                        <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {profile.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {isAdmin ? (
                       <>
                          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
                             <UserIcon className="mr-2 h-4 w-4" />
                             <span>Meu Perfil</span>
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Painel de Controle</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                       <DropdownMenuItem onClick={() => router.push('/dashboard-truck')}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Painel do Motorista</span>
                      </DropdownMenuItem>
                    )}

                    {isAdmin && (
                        <>
                          <DropdownMenuItem onClick={() => router.push('/dashboard/manage')}>
                              <UserIcon className="mr-2 h-4 w-4" />
                              <span>Gerenciamento</span>
                          </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                              <Settings className="mr-2 h-4 w-4" />
                              <span>Configuracoes</span>
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
                            Acao Critica e Irreversivel
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso ira apagar <strong>TODAS as corridas</strong> de todos os setores e motoristas da empresa.
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
