'use client';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Trash2 } from 'lucide-react';
import type { FirestoreManager } from './page';

const managerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
});

type ManagerForm = z.infer<typeof managerSchema>;

interface EmailManagementProps {
  managers: FirestoreManager[];
  onDelete: (type: 'manager' | 'user' | 'vehicle', id: string) => void;
  onUpdate: () => void;
  session: { companyId: string; sectorId: string };
}

export const EmailManagement = ({ managers, onDelete, onUpdate, session }: EmailManagementProps) => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [selectedManager, setSelectedManager] = useState<FirestoreManager | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editForm = useForm<ManagerForm>({ resolver: zodResolver(managerSchema) });
  const createForm = useForm<ManagerForm>({
    resolver: zodResolver(managerSchema),
    defaultValues: { name: '', email: '' }
  });

  const handleEditClick = (manager: FirestoreManager) => {
    setSelectedManager(manager);
    editForm.reset({ name: manager.name, email: manager.email });
    setIsEditDialogOpen(true);
  };
  
  const handleCreateSubmit = async (data: ManagerForm) => {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
        const managersCol = collection(firestore, `companies/${session.companyId}/sectors/${session.sectorId}/managers`);
        await addDoc(managersCol, { 
            name: data.name, 
            email: data.email
        });
        toast({ title: 'Sucesso', description: 'Gestor cadastrado com sucesso!' });
        onUpdate();
        setIsCreateDialogOpen(false);
    } catch (error: any) {
        console.error("Error creating manager:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cadastrar o gestor.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleEditSubmit = async (data: ManagerForm) => {
    if (!firestore || !selectedManager) return;
    setIsSubmitting(true);
    try {
      const managerRef = doc(firestore, `companies/${session.companyId}/sectors/${session.sectorId}/managers`, selectedManager.id);
      await updateDoc(managerRef, { name: data.name, email: data.email });
      toast({ title: 'Sucesso', description: 'Gestor atualizado.' });
      onUpdate();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating manager:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o gestor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { createForm.reset(); setIsCreateDialogOpen(true); }}>Adicionar Gestor do Setor</Button>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((manager) => (
              <TableRow key={manager.id}>
                <TableCell className="font-medium">{manager.name}</TableCell>
                <TableCell>{manager.email}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(manager)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-1" /> Deletar
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Isso irá deletar permanentemente o gestor "{manager.name}".
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete('manager', manager.id)}>
                                  Confirmar
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {managers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                  Nenhum gestor cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Gestor</DialogTitle>
            <DialogDescription>Altere os dados do gestor {selectedManager?.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Gestor</Label>
              <Input id="name" {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" {...editForm.register('email')} />
              {editForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.email.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Adicionar Gestor do Setor</DialogTitle>
                  <DialogDescription>Cadastre um gestor para receber cópias dos e-mails gerados.</DialogDescription>
              </DialogHeader>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                  <div>
                      <Label htmlFor="nameCreate">Nome do Gestor</Label>
                      <Input id="nameCreate" {...createForm.register('name')} placeholder="Ex: João Silva"/>
                      {createForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.name.message}</p>}
                  </div>
                  <div>
                      <Label htmlFor="emailCreate">E-mail</Label>
                      <Input id="emailCreate" {...createForm.register('email')} placeholder="Ex: joao@frotacontrol.com"/>
                      {createForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.email.message}</p>}
                  </div>
                   <DialogFooter>
                      <DialogClose asChild>
                          <Button type="button" variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Salvar
                      </Button>
                  </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </>
  );
};
