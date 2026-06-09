'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Key, Loader2, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { getCarUsuario, trocarSenha, type CarUsuario } from '@/lib/car-rtdb';
import { CarHeader } from '@/components/car-header';

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [usuario, setUsuario] = useState<CarUsuario | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const u = getCarUsuario();
    if (!u) { router.replace('/login-car'); return; }
    setUsuario(u);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }

    if (novaSenha.length < 4) {
      toast({ variant: 'destructive', title: 'Senha muito curta', description: 'A nova senha deve ter pelo menos 4 caracteres.' });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast({ variant: 'destructive', title: 'Senhas nao conferem', description: 'A nova senha e a confirmacao devem ser iguais.' });
      return;
    }

    setIsVerifying(true);
    try {
      const { carLogin } = await import('@/lib/car-rtdb');
      await carLogin(usuario.empresa, usuario.setor, usuario.mat, senhaAtual);
    } catch {
      toast({ variant: 'destructive', title: 'Senha atual incorreta', description: 'A senha atual informada nao confere.' });
      setIsVerifying(false);
      return;
    }
    setIsVerifying(false);

    setIsSubmitting(true);
    try {
      await trocarSenha(usuario.empresa, usuario.setor, usuario.mat, novaSenha);
      toast({ title: 'Senha alterada!', description: 'Sua senha foi atualizada com sucesso.' });
      router.push('/dashboard-car');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Falha ao alterar a senha.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      <CarHeader usuario={usuario} onLogout={() => router.replace('/')} />

      <main className="flex-1 p-4 sm:p-6 container mx-auto max-w-lg pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard-car')}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Trocar Senha</h1>
            <p className="text-sm text-muted-foreground">Altere sua senha de acesso</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Dados de Acesso
              </CardTitle>
              <CardDescription className="text-xs">
                Matricula: <span className="font-mono font-bold text-foreground">{usuario?.mat}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="senha-atual">Senha Atual</Label>
                <div className="relative">
                  <Input
                    id="senha-atual"
                    type={showAtual ? 'text' : 'password'}
                    placeholder="Digite sua senha atual"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAtual(!showAtual)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="nova-senha">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="nova-senha"
                    type={showNova ? 'text' : 'password'}
                    placeholder="Minimo 4 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova(!showNova)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmar-senha"
                    type={showConfirmar ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmar(!showConfirmar)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {novaSenha && confirmarSenha && novaSenha === confirmarSenha && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3" /> Senhas conferem
                  </p>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-start gap-2 text-amber-700 dark:text-amber-300 text-sm">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-xs">Dica de seguranca</p>
                  <p className="text-xs mt-0.5">Nao use sua matricula como senha. Escolha uma senha forte e unica.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 font-bold"
            disabled={isSubmitting || isVerifying || !senhaAtual || !novaSenha || !confirmarSenha || novaSenha !== confirmarSenha}
          >
            {isSubmitting || isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
            ALTERAR SENHA
          </Button>
        </form>
      </main>
    </div>
  );
}

