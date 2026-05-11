'use client';
import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Edit, Trash2 } from 'lucide-react';
import type { UserDto, UserProfile, CreateUserRequest } from '@/types/api';
import { SHIFT_NUM_TO_NAME, SHIFT_NAME_TO_NUM } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ROLES = {
  MOTORISTA: 'Motorista',
  ADMINISTRADOR: 'Administrador',
  AMBOS: 'Ambos'
};

const userEditSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  isAdmin: z.boolean(),
  isTruck: z.boolean(),
  shift: z.string().min(1, 'O turno é obrigatório'),
  photoURL: z.string().optional().or(z.literal('')),
  isOP: z.boolean().default(false),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  permitidos: z.string().optional().or(z.literal('')),
});

const userCreateSchema = z.object({
  userName: z.string().min(1, 'Nome do usuário é obrigatório'),
  userMatricula: z.string().min(1, 'Matrícula é obrigatória'),
  userPassword: z.string().min(1, 'A senha é obrigatória'),
  role: z.string().min(1, "A função é obrigatória"),
  shift: z.string().min(1, "O turno é obrigatório"),
  photoURL: z.string().optional().or(z.literal('')),
  isOP: z.boolean().default(false),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  permitidos: z.string().optional().or(z.literal('')),
});

type UserEditForm = z.infer<typeof userEditSchema>;
type UserCreateForm = z.infer<typeof userCreateSchema>;

interface UserManagementProps {
  users: UserDto[];
  onDelete: (type: 'user', id: string) => void;
  onUpdate: () => void;
  companyId: string;
  sectorId: string;
  currentUser: UserProfile | null;
}

export const UserManagement = ({ users, onDelete, onUpdate, companyId, sectorId, currentUser }: UserManagementProps) => {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editForm = useForm<UserEditForm>({ resolver: zodResolver(userEditSchema) });
  const createForm = useForm<UserCreateForm>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { userName: '', userMatricula: '', userPassword: '', role: '', shift: '', photoURL: '', isOP: false },
  });

  const handleEditClick = (user: UserDto) => {
    setSelectedUser(user);
    editForm.reset({
      name: user.name,
      isAdmin: user.isAdmin,
      isTruck: user.isTruck,
      shift: SHIFT_NUM_TO_NAME[user.shift] || '',
      photoURL: user.photoURL || '',
      isOP: user.isOP || false,
      email: user.email || '',
      permitidos: user.permitidos || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleCreateSubmit = async (data: UserCreateForm) => {
    setIsSubmitting(true);
    try {
      const shiftNum = SHIFT_NAME_TO_NUM[data.shift] ?? 0;
      const body: CreateUserRequest = {
        matricula: data.userMatricula,
        name: data.userName.toUpperCase(),
        password: data.userPassword.length < 6 ? data.userPassword.padStart(6, '0') : data.userPassword,
        shift: shiftNum,
        isAdmin: data.role === ROLES.ADMINISTRADOR || data.role === ROLES.AMBOS,
        isTruck: data.role === ROLES.MOTORISTA || data.role === ROLES.AMBOS,
        isOP: data.isOP,
        photoURL: data.photoURL || undefined,
        email: data.email || undefined,
        permitidos: data.permitidos || undefined,
      };
      await api.post(`/api/companies/${companyId}/sectors/${sectorId}/users`, body);
      toast({ title: 'Sucesso', description: 'Usuário cadastrado com sucesso!' });
      onUpdate();
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      console.error("Erro ao cadastrar usuário:", error);
      toast({ variant: 'destructive', title: 'Erro ao cadastrar usuário', description: error.message || 'Ocorreu um erro inesperado.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (data: UserEditForm) => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const shiftNum = SHIFT_NAME_TO_NUM[data.shift] ?? 0;
      await api.put(`/api/companies/${companyId}/sectors/${sectorId}/users/${selectedUser.id}`, {
        name: data.name.toUpperCase(),
        isAdmin: data.isAdmin,
        isTruck: data.isTruck,
        shift: shiftNum,
        photoURL: data.photoURL || undefined,
        isOP: data.isOP,
        email: data.email || undefined,
        permitidos: data.permitidos || undefined,
      });
      toast({ title: 'Sucesso', description: 'Usuário atualizado.' });
      onUpdate();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o usuário.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { createForm.reset(); setIsCreateDialogOpen(true); }}>Adicionar Usuário</Button>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead>É OP?</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarImage src={user.photoURL} alt={user.name} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                    {user.name}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{user.email || '-'}</TableCell>
                <TableCell>{SHIFT_NUM_TO_NAME[user.shift] || 'N/A'}</TableCell>
                <TableCell>{user.isAdmin ? 'Sim' : 'Não'}</TableCell>
                <TableCell>{user.isTruck ? 'Sim' : 'Não'}</TableCell>
                <TableCell>{user.isOP ? 'Sim' : 'Não'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(user)}><Edit className="h-4 w-4 mr-1" /> Editar</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Deletar</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita. Isso irá deletar permanentemente o usuário "{user.name}".</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete('user', user.id)}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere os dados do usuário {selectedUser?.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="photoURL">URL da Foto</Label>
              <Input id="photoURL" {...editForm.register('photoURL')} placeholder="https://exemplo.com/foto.png" />
              {editForm.formState.errors.photoURL && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.photoURL.message}</p>}
            </div>
            <div>
              <Label htmlFor="shift">Turno</Label>
              <Controller name="shift" control={editForm.control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <SelectTrigger id="shift"><SelectValue placeholder="Selecione o Turno" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(SHIFT_NUM_TO_NAME).map(turno => <SelectItem key={turno} value={turno}>{turno}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              {editForm.formState.errors.shift && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.shift.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="permitidos">Veículos Permitidos</Label>
              <Input id="permitidos" placeholder="Placas separadas por vírgula" {...editForm.register('permitidos')} />
            </div>
            {(editForm.watch('isAdmin') || editForm.watch('isOP')) && (
              <div className="space-y-2">
                <Label htmlFor="emailEdit" className="text-sm font-bold">E-mail para Notificações</Label>
                <Input id="emailEdit" placeholder="ex: admin@empresa.com" {...editForm.register('email')} />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Controller name="isOP" control={editForm.control} render={({ field }) => (
                <Switch id="isOP" checked={field.value} onCheckedChange={field.onChange} disabled={!currentUser?.isOP} />
              )} />
              <Label htmlFor="isOP" className={!currentUser?.isOP ? "text-muted-foreground" : "font-bold"}>É OP? (Superior ao Admin)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Controller name="isAdmin" control={editForm.control} render={({ field }) => (
                <Switch id="isAdmin" checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label htmlFor="isAdmin">É Administrador?</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Controller name="isTruck" control={editForm.control} render={({ field }) => (
                <Switch id="isTruck" checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label htmlFor="isTruck">É Motorista de Caminhão?</Label>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo usuário no setor atual.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userName">Nome</Label>
                <Input id="userName" {...createForm.register('userName')} placeholder="Nome do Usuário" />
                {createForm.formState.errors.userName && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.userName.message}</p>}
              </div>
              <div>
                <Label htmlFor="userMatricula">Matrícula</Label>
                <Input id="userMatricula" {...createForm.register('userMatricula')} placeholder="Matrícula" />
                {createForm.formState.errors.userMatricula && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.userMatricula.message}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="photoURLCreate">URL da Foto</Label>
              <Input id="photoURLCreate" {...createForm.register('photoURL')} placeholder="https://exemplo.com/foto.png" />
            </div>
            <div>
              <Label htmlFor="permitidosCreate">Veículos Permitidos</Label>
              <Input id="permitidosCreate" placeholder="Placas separadas por vírgula" {...createForm.register('permitidos')} />
            </div>
            {(createForm.watch('role') === ROLES.ADMINISTRADOR || createForm.watch('role') === ROLES.AMBOS || createForm.watch('isOP')) && (
              <div>
                <Label htmlFor="userEmail" className="font-bold">E-mail para Notificações</Label>
                <Input id="userEmail" placeholder="ex: adm@empresa.com" {...createForm.register('email')} />
                {createForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.email.message}</p>}
              </div>
            )}
            <div>
              <Label htmlFor="userPassword">Senha</Label>
              <Input id="userPassword" type="password" {...createForm.register('userPassword')} placeholder="Senha do Usuário" />
              {createForm.formState.errors.userPassword && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.userPassword.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Função</Label>
                <Controller name="role" control={createForm.control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger id="role"><SelectValue placeholder="Selecione a Função" /></SelectTrigger>
                    <SelectContent>
                      {Object.values(ROLES).map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                {createForm.formState.errors.role && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.role.message}</p>}
              </div>
              <div>
                <Label htmlFor="shiftCreate">Turno</Label>
                <Controller name="shift" control={createForm.control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger id="shiftCreate"><SelectValue placeholder="Selecione o Turno" /></SelectTrigger>
                    <SelectContent>
                      {Object.values(SHIFT_NUM_TO_NAME).map(turno => <SelectItem key={turno} value={turno}>{turno}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                {createForm.formState.errors.shift && <p className="text-sm text-destructive mt-1">{createForm.formState.errors.shift.message}</p>}
              </div>
            </div>
            <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <Controller name="isOP" control={createForm.control} render={({ field }) => (
                <Switch id="isOPCreate" checked={field.value} onCheckedChange={field.onChange} disabled={!currentUser?.isOP} />
              )} />
              <Label htmlFor="isOPCreate" className={!currentUser?.isOP ? "text-muted-foreground" : "font-bold text-primary"}>É OP? (Acesso Total)</Label>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
