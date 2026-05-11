'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

const DEFAULT_ZOOM = 12;

const SettingsPage = () => {
  const { toast } = useToast();

  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('appSettings');
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        setZoomLevel(settings.map?.defaultZoom ?? DEFAULT_ZOOM);
      } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings = { map: { defaultZoom: zoomLevel } };
      localStorage.setItem('appSettings', JSON.stringify(settings));
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
