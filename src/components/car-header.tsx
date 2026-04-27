'use client';

import { Car, LogOut, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { CarUsuario } from '@/lib/car-rtdb';

interface CarHeaderProps {
  usuario: CarUsuario | null;
  onLogout: () => void;
}

export function CarHeader({ usuario, onLogout }: CarHeaderProps) {
  const initials = usuario?.nome
    ? usuario.nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="bg-background sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard-car" className="flex items-center gap-3">
            <Car className="h-7 w-7 text-primary" />
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Frotacontrol</h1>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-medium italic">by</span>
                <img src="/logo_lsl.png" alt="LSL" className="h-4 w-auto" />
              </div>
            </div>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{usuario?.nome ?? '—'}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    Mat. {usuario?.mat} · {usuario?.empresa} / {usuario?.setor}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {}}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Painel do Motorista</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
