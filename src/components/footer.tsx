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
        className="w-full py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={() => setIsModalOpen(true)}
      >
        EQUIPE DE PROJETOS - DVP MAO
      </footer>

      <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Equipe de Projetos - DVP MAO</AlertDialogTitle>
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
