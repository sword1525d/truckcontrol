'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from '@/hooks/use-mobile';
import AcompanhamentoTab from './AcompanhamentoTab';
import AnaliseTab from './AnaliseTab';

export default function DashboardPage() {
    const isMobile = useIsMobile();
    const auth = useAuth();
    const [activeTab, setActiveTab] = useState('acompanhamento');
    const [sectorName, setSectorName] = useState('');

    useEffect(() => {
        setSectorName(auth.profile?.sectorId || '');
    }, [auth.profile]);

    const isMilkrunAstec = sectorName.toUpperCase() === 'MILKRUN ASTEC';

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel de Controle</h1>
                <p className="text-muted-foreground">Visão geral do sistema Frotacontrol.</p>
            </div>

            <Tabs defaultValue="acompanhamento" className="w-full" onValueChange={setActiveTab}>
                <TabsList className={cn("grid w-full", isMobile ? "grid-cols-2" : (isMilkrunAstec ? "grid-cols-4" : "grid-cols-6"))}>
                    <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
                    {!isMilkrunAstec && <TabsTrigger value="roteirizacao">Roteirização</TabsTrigger>}
                    <TabsTrigger value="analise">Análise</TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                    <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>
                    <TabsTrigger value="checklists">Checklists</TabsTrigger>
                </TabsList>

                <TabsContent value="acompanhamento" className="mt-6">
                    <AcompanhamentoTab activeTab={activeTab} isMilkrunAstec={isMilkrunAstec} />
                </TabsContent>

                {/* Demais abas serão migradas incrementalmente */}
                <TabsContent value="roteirizacao" className="mt-6">
                    <div className="text-center py-12 text-muted-foreground">Roteirização — em migração.</div>
                </TabsContent>
                <TabsContent value="analise" className="mt-6">
                    <AnaliseTab activeTab={activeTab} />
                </TabsContent>
                <TabsContent value="historico" className="mt-6">
                    <div className="text-center py-12 text-muted-foreground">Histórico — em migração.</div>
                </TabsContent>
                <TabsContent value="abastecimentos" className="mt-6">
                    <div className="text-center py-12 text-muted-foreground">Abastecimentos — em migração.</div>
                </TabsContent>
                <TabsContent value="checklists" className="mt-6">
                    <div className="text-center py-12 text-muted-foreground">Checklists — em migração.</div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
