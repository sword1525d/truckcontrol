
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Slider } from '@/components/ui/slider';

type UserData = {
  companyId: string;
  sectorId: string;
};

type AppSettings = {
  map?: {
    defaultZoom?: number;
  };
};

const DEFAULT_ZOOM = 12;

const SettingsPage = () => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [session, setSession] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const companyId = localStorage.getItem('companyId');
    const sectorId = localStorage.getItem('sectorId');

    if (companyId && sectorId) {
      setSession({ companyId, sectorId });
    } else {
      toast({ variant: 'destructive', title: 'Sessão inválida', description: 'Faça login novamente.' });
      router.push('/login');
    }
  }, [router, toast]);

  const fetchSettings = useCallback(async () => {
    if (!firestore || !session) return;
    setIsLoading(true);
    try {
      const settingsRef = doc(firestore, `companies/${session.companyId}/sectors/${session.sectorId}/settings`, 'app');
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as AppSettings;
        setSettings(data);
        setZoomLevel(data.map?.defaultZoom ?? DEFAULT_ZOOM);
      } else {
        setZoomLevel(DEFAULT_ZOOM);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as configurações.' });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, session, toast]);

  useEffect(() => {
    if (session) {
      fetchSettings();
    }
  }, [session, fetchSettings]);

  const handleSave = async () => {
    if (!firestore || !session) return;
    setIsSaving(true);
    try {
      const settingsRef = doc(firestore, `companies/${session.companyId}/sectors/${session.sectorId}/settings`, 'app');
      const newSettings: AppSettings = {
        ...settings,
        map: {
          ...settings.map,
          defaultZoom: zoomLevel,
        },
      };
      
      await setDoc(settingsRef, newSettings, { merge: true });
      setSettings(newSettings);

      toast({ title: 'Sucesso!', description: 'Configurações salvas com sucesso.' });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações do Mapa</CardTitle>
          <CardDescription>Ajuste os parâmetros de exibição dos mapas no sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="zoom-slider">Zoom Padrão do Mapa ({zoomLevel})</Label>
             <p className="text-sm text-muted-foreground">
                Define o nível de zoom inicial para o mapa de acompanhamento em tempo real.
            </p>
            <div className="flex items-center gap-4 pt-2">
                <Slider
                    id="zoom-slider"
                    min={1}
                    max={20}
                    step={1}
                    value={[zoomLevel]}
                    onValueChange={(value) => setZoomLevel(value[0])}
                />
                <span className="w-10 text-center font-mono text-lg">{zoomLevel}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
       <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Configurações
            </Button>
       </div>
    </div>
  );
};

export default SettingsPage;
