"use client";

import React, { useState, useEffect } from 'react';
import { Truck, LogOut, Shield, User as UserIcon, Settings, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from './ui/skeleton';

export function Header() {
  const { user, auth, isUserLoading } = useFirebase();
  const router = useRouter();
  const [dashboardPath, setDashboardPath] = useState('#');
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
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
        // Fallback for cases where localStorage is not set but user might be on a page
        setUserIsAdmin(false);
        setDashboardPath('/dashboard-truck');
    }
  }, []);

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
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
