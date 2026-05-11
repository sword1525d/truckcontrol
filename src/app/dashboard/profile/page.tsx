'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Key, Mail, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function ProfilePage() {
  const auth = useAuth();
  const { toast } = useToast();
  const profile = auth.profile;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEmailUpdating, setIsEmailUpdating] = useState(false);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);

  if (auth.isLoading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'As senhas não coincidem.' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    setIsUpdating(true);
    try {
      await api.post('/api/me/change-password', { currentPassword, newPassword });
      toast({ title: 'Sucesso!', description: 'Sua senha foi atualizada com sucesso.' });
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao atualizar senha.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsProfileUpdating(true);
    try {
      const name = displayName.toUpperCase();
      await api.put(`/api/companies/${profile.companyId}/sectors/${profile.sectorId}/users/${profile.id}`, { name });
      auth.updateProfile({ name });
      toast({ title: 'Perfil Atualizado', description: 'Seu nome foi alterado com sucesso.' });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o perfil.' });
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!currentPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Senha atual necessária.' });
      return;
    }
    setIsEmailUpdating(true);
    try {
      await api.put('/api/me/email', { currentPassword, newEmail });
      toast({ title: 'Sucesso', description: 'E-mail atualizado.' });
      setNewEmail('');
      setCurrentPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao atualizar e-mail.' });
    } finally {
      setIsEmailUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>

      <Card className="border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-6 bg-muted/30 pb-8">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={profile.photoURL || undefined} />
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">{profile.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 text-foreground/70 font-medium">
              <Mail className="h-4 w-4" /> {profile.email || `${profile.matricula}@frotacontrol.com`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-primary/20">
            <ShieldCheck className="h-3 w-3" />
            {profile.isOP ? 'Operador de Sistema' : profile.isAdmin ? 'Administrador' : 'Motorista'}
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t">
            <h3 className="font-bold text-sm uppercase text-muted-foreground tracking-widest">Informações Pessoais</h3>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs">Nome Completo</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={isProfileUpdating}>
              {isProfileUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Alterações de Nome'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {profile.isOP && (
        <Card className="shadow-xl bg-primary/[0.02]">
          <CardHeader className="border-b bg-primary/5">
            <CardTitle className="flex items-center gap-2 text-xl text-primary"><Mail className="h-5 w-5" /> Alterar E-mail de Login (Acesso OP)</CardTitle>
            <CardDescription>Apenas OPs podem ver e realizar esta alteração de credencial.</CardDescription>
          </CardHeader>
          <form onSubmit={handleChangeEmail}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1">
                <Label htmlFor="current-email-op" className="font-bold">Senha Atual</Label>
                <Input id="current-email-op" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email-new-op" className="font-bold">Novo E-mail</Label>
                <Input id="email-new-op" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="border-t py-4">
              <Button type="submit" variant="destructive" className="w-full font-black uppercase tracking-tighter" disabled={isEmailUpdating}>
                {isEmailUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar Troca de E-mail de Acesso'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <Card className="shadow-xl">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl"><Key className="h-5 w-5 text-primary" /> Alterar Senha</CardTitle>
          <CardDescription>Mude sua senha de acesso ao sistema.</CardDescription>
        </CardHeader>
        <form onSubmit={handleChangePassword}>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="current-pwd" className="font-bold">Senha Atual</Label>
              <Input
                id="current-pwd"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="bg-muted/30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t mt-4">
              <div className="space-y-2">
                <Label htmlFor="new-pwd" className="font-bold">Nova Senha</Label>
                <Input
                  id="new-pwd"
                  type="password"
                  placeholder="Mínimo 6 dígitos"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pwd" className="font-bold">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-pwd"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/5 border-t pt-6">
            <Button type="submit" className="w-full font-bold h-12 shadow-md hover:shadow-lg transition-all" disabled={isUpdating}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              {isUpdating ? 'Processando...' : 'Salvar Nova Senha'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
