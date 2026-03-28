'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { updatePassword, updateEmail, updateProfile, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Key, Mail, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function ProfilePage() {
    const { user, firestore, isUserLoading } = useFirebase();
    const { toast } = useToast();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isEmailUpdating, setIsEmailUpdating] = useState(false);
    const [isProfileUpdating, setIsProfileUpdating] = useState(false);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            const parsed = JSON.parse(stored);
            setUserData(parsed);
            
            // Tentar separar nome e sobrenome do displayName ou do firestore
            const nameParts = (parsed.name || '').split(' ');
            setFirstName(nameParts[0] || '');
            setLastName(nameParts.slice(1).join(' ') || '');
        }
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;

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
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            
            await updatePassword(user, newPassword);
            
            toast({ title: 'Sucesso!', description: 'Sua senha foi atualizada com sucesso.' });
            setNewPassword('');
            setConfirmPassword('');
            setCurrentPassword('');
        } catch (error: any) {
            console.error(error);
            let message = 'Erro ao atualizar senha.';
            if (error.code === 'auth/wrong-password') message = 'Senha atual incorreta.';
            if (error.code === 'auth/too-many-requests') message = 'Muitas tentativas. Tente mais tarde.';
            toast({ variant: 'destructive', title: 'Erro', description: message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !firestore) return;

        setIsProfileUpdating(true);
        try {
            const fullName = `${firstName} ${lastName}`.trim().toUpperCase();
            
            // 1. Update Firebase Auth
            await updateProfile(user, { displayName: fullName });
            
            // 2. Update Firestore
            const companyId = localStorage.getItem('companyId');
            const sectorId = localStorage.getItem('sectorId');
            if (companyId && sectorId) {
                const userRef = doc(firestore, `companies/${companyId}/sectors/${sectorId}/users`, user.uid);
                await updateDoc(userRef, { name: fullName });
            }

            // 3. Update localStorage
            if (userData) {
                const updated = { ...userData, name: fullName };
                localStorage.setItem('user', JSON.stringify(updated));
                setUserData(updated);
            }

            toast({ title: 'Perfil Atualizado', description: 'Seu nome foi alterado com sucesso.' });
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o perfil.' });
        } finally {
            setIsProfileUpdating(false);
        }
    };

    if (isUserLoading || !user) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Carregando perfil...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>

            <Card className="border-t-4 border-t-primary overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-6 bg-muted/30 pb-8">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                        <AvatarImage src={user.photoURL || undefined} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                            {user.displayName?.substring(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">{user.displayName}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-foreground/70 font-medium">
                            <Mail className="h-4 w-4" /> {user.email}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-primary/20">
                        <ShieldCheck className="h-3 w-3" />
                        {userData?.isOP ? 'Operador de Sistema' : 'Administrador'}
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t">
                        <h3 className="font-bold text-sm uppercase text-muted-foreground tracking-widest">Informações Pessoais</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="firstName" className="text-xs">Nome</Label>
                                <Input 
                                    id="firstName" 
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value)} 
                                    placeholder="Seu nome"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="lastName" className="text-xs">Sobrenome</Label>
                                <Input 
                                    id="lastName" 
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value)} 
                                    placeholder="Seu sobrenome"
                                />
                            </div>
                        </div>
                        <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={isProfileUpdating}>
                            {isProfileUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Alterações de Nome'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {userData?.isOP && (
                <Card className="shadow-xl bg-primary/[0.02]">
                    <CardHeader className="border-b bg-primary/5">
                        <CardTitle className="flex items-center gap-2 text-xl text-primary"><Mail className="h-5 w-5" /> Alterar E-mail de Login (Acesso OP)</CardTitle>
                        <CardDescription>Apenas OPs podem ver e realizar esta alteração de credencial.</CardDescription>
                    </CardHeader>
                    {/* Re-adicionando handleChangeEmail como uma sub-função apenas se necessário, 
                        mas aqui eu a removi do fluxo principal para simplificar conforme pedido: 
                        'usuários não podem'. Vou deixar o formulário mas desabilitado ou escondido se não for OP. */}
                    {/* Adicionando a função localmente para este bloco */}
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!user || !user.email || !firestore) return;
                        if (!currentPassword) { toast({ variant: 'destructive', title: 'Erro', description: 'Senha necessária.' }); return; }
                        setIsEmailUpdating(true);
                        try {
                            const credential = EmailAuthProvider.credential(user.email, currentPassword);
                            await reauthenticateWithCredential(user, credential);
                            await updateEmail(user, newEmail);
                            const companyId = localStorage.getItem('companyId');
                            const sectorId = localStorage.getItem('sectorId');
                            if (companyId && sectorId) {
                                await updateDoc(doc(firestore, `companies/${companyId}/sectors/${sectorId}/users`, user.uid), { email: newEmail });
                            }
                            toast({ title: 'Sucesso', description: 'E-mail atualizado.' });
                            setNewEmail('');
                        } catch (err: any) {
                            toast({ variant: 'destructive', title: 'Erro', description: err.message });
                        } finally {
                            setIsEmailUpdating(false);
                        }
                    }}>
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
                        {!newEmail && (
                            <div className="space-y-2">
                                <Label htmlFor="current-pwd" className="font-bold">Senha Atual</Label>
                                <Input 
                                    id="current-pwd" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={currentPassword} 
                                    onChange={(e) => setCurrentPassword(e.target.value)} 
                                    required={!newEmail} 
                                    className="bg-muted/30"
                                />
                            </div>
                        )}
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
