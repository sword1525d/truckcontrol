"use client";

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from '@/components/ui/alert-dialog';

export function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <footer
        className="fixed bottom-0 w-full bg-background py-3 px-4 text-center text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors z-30 flex items-center justify-center gap-3"
        onClick={() => setIsModalOpen(true)}
      >
        <img src="/logo_projetos.svg" alt="Logo Projetos" className="h-5 w-auto opacity-70 hover:opacity-100 transition-opacity" />
        <span className="font-medium">PROJETOS - DIVISÃO DE PEÇAS</span>
      </footer>

      <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projetos - Divisão de Peças</AlertDialogTitle>
            <AlertDialogDescription asChild>
                <div className="text-sm text-foreground pt-4 space-y-3 text-left">
                    <p><span className="font-semibold text-primary">Desenvolvedor:</span> Lucas de Lima</p>
                    <p><span className="font-semibold text-primary">Líder:</span> Álvaro Borges</p>
                    <p><span className="font-semibold text-primary">Chefe:</span> Gian Augustus</p>
                    <p><span className="font-semibold text-primary">Supervisor:</span> Danilton Alencar</p>
                    <p><span className="font-semibold text-primary">Gerente:</span> Angelo Shiguematsu</p>
                </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
