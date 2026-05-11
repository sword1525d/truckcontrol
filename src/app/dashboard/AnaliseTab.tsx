'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import type { RunDto, RunSummaryDto, UserDto } from '@/types/api';
import { SHIFT_NUM_TO_NAME } from './types';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Truck, User, Calendar as CalendarIcon, Building, ClipboardCheck, Route, Timer, Milestone } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';

interface SectorInfo { id: string; name: string; }

const KpiCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon?: React.ElementType }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const ChartCard = ({ title, description, children, className }: { title: string; description: string; children: React.ReactNode; className?: string }) => (
  <Card className={cn("flex flex-col", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
      <div className="space-y-1">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="flex-1 pb-4">
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

export default function AnaliseTab({ activeTab }: { activeTab: string }) {
  const auth = useAuth();
  const isMobile = useIsMobile();
  const profile = auth.profile;
  const companyId = profile?.companyId || '';
  const sectorId = profile?.sectorId || '';
  const isSuperAdmin = profile?.matricula === '801231';

  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) });

  const [allSectors, setAllSectors] = useState<SectorInfo[]>([]);
  const [users, setUsers] = useState<Map<string, UserDto>>(new Map());
  const [allRuns, setAllRuns] = useState<RunDto[]>([]);

  const [selectedShift, setSelectedShift] = useState<string>('1° NORMAL');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>(sectorId);

  useEffect(() => {
    if (!sectorId) return;
    setSelectedSector(sectorId);
  }, [sectorId]);

  useEffect(() => {
    if (!profile || !companyId || !selectedSector || !date?.from || activeTab !== 'analise') return;

    const effectiveSector = selectedSector !== 'all' ? selectedSector : sectorId;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const usersMap = new Map<string, UserDto>();
        const sectorRefs: SectorInfo[] = [];

        if (isSuperAdmin) {
          const sectors = await api.get<any[]>(`/api/companies/${companyId}/sectors`);
          sectors.forEach((s: any) => sectorRefs.push({ id: s.id, name: s.name }));
        } else {
          sectorRefs.push({ id: effectiveSector, name: '' });
        }
        setAllSectors(sectorRefs);

        const from = startOfDay(date.from!).toISOString();
        const to = endOfDay(date.to || date.from!).toISOString();

        const sectorUsers = await api.get<UserDto[]>(`/api/companies/${companyId}/sectors/${effectiveSector}/users`);
        sectorUsers.forEach(u => { if (!usersMap.has(u.id)) usersMap.set(u.id, u); });

        const summaries = await api.get<RunSummaryDto[]>(`/api/companies/${companyId}/sectors/${effectiveSector}/runs?dateFrom=${from}&dateTo=${to}`);
        const completedSummaries = summaries.filter(s => s.status === 'COMPLETED');

        const details = await Promise.all(completedSummaries.map(s =>
          api.get<RunDto>(`/api/companies/${companyId}/sectors/${effectiveSector}/runs/${s.id}`).catch(() => null)
        ));

        setUsers(usersMap);
        setAllRuns((details.filter(Boolean) as RunDto[]));
      } catch (error) {
        console.error("Error fetching analysis data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile, companyId, sectorId, selectedSector, isSuperAdmin, date, activeTab]);

  const { filteredRuns, vehicleList, driverList } = useMemo(() => {
    const vehicles = new Set<string>();
    allRuns.forEach(run => vehicles.add(run.vehicleId));

    const drivers = new Map<string, UserDto>();
    allRuns.forEach(run => {
      if (!drivers.has(run.driverId)) {
        const driverInfo = users.get(run.driverId);
        if (driverInfo) drivers.set(run.driverId, driverInfo);
      }
    });

    const filtered = allRuns.filter(run => {
      const driver = users.get(run.driverId);
      const driverShiftName = driver ? SHIFT_NUM_TO_NAME[driver.shift] : '';
      if (selectedShift !== 'TODOS' && driverShiftName !== selectedShift) return false;
      if (isSuperAdmin && selectedSector !== 'all') {
        // Runs don't have sectorId in DTO, skip sector filter for non-superAdmin
      }
      if (selectedVehicle !== 'all' && run.vehicleId !== selectedVehicle) return false;
      if (selectedDriver !== 'all' && run.driverId !== selectedDriver) return false;
      return true;
    });

    return {
      filteredRuns: filtered,
      vehicleList: Array.from(vehicles).sort(),
      driverList: Array.from(drivers.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [allRuns, selectedShift, selectedVehicle, selectedDriver, selectedSector, users, isSuperAdmin]);

  const kpis = useMemo(() => {
    const totalRuns = filteredRuns.length;
    const totalDistance = filteredRuns.reduce((acc, run) => {
      const d = (run.endMileage ?? run.startMileage) - run.startMileage;
      return acc + (d > 0 ? d : 0);
    }, 0);
    const totalDurationMs = filteredRuns.reduce((acc, run) => {
      if (!run.endTime) return acc;
      return acc + (new Date(run.endTime).getTime() - new Date(run.startTime).getTime());
    }, 0);
    const avgDurationMinutes = totalRuns > 0 ? (totalDurationMs / totalRuns / 60000) : 0;
    const totalStops = filteredRuns.reduce((acc, run) => acc + run.stops.length, 0);
    return { totalRuns, totalDistance, avgDurationMinutes, totalStops };
  }, [filteredRuns]);

  const chartData = useMemo(() => {
    if (!date || !date.from) return { runsByDay: [], distanceByVehicle: [], stoppedTimeByVehicle: [] };

    const from = startOfDay(date.from);
    const to = endOfDay(date.to || date.from);
    const dateMap = new Map<string, number>();
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dateMap.set(format(d, 'dd/MM'), 0);
    }
    filteredRuns.forEach(run => {
      const day = format(new Date(run.startTime), 'dd/MM');
      if (dateMap.has(day)) dateMap.set(day, (dateMap.get(day) || 0) + 1);
    });

    const distanceMap = new Map<string, number>();
    filteredRuns.forEach(run => {
      const distance = (run.endMileage || run.startMileage) - run.startMileage;
      if (distance > 0) distanceMap.set(run.vehicleId, (distanceMap.get(run.vehicleId) || 0) + distance);
    });

    const stoppedTimeMap = new Map<string, number>();
    filteredRuns.forEach(run => {
      const runStopTimeMs = run.stops.reduce((acc, stop) => {
        if (!stop.arrivalTime || !stop.departureTime) return acc;
        const dt = new Date(stop.departureTime).getTime() - new Date(stop.arrivalTime).getTime();
        return acc + (dt > 0 ? dt : 0);
      }, 0);
      if (runStopTimeMs > 0) stoppedTimeMap.set(run.vehicleId, (stoppedTimeMap.get(run.vehicleId) || 0) + runStopTimeMs);
    });

    const stoppedTimes = Array.from(stoppedTimeMap.entries())
      .map(([name, totalMs]) => ({ name, total: parseFloat((totalMs / 3600000).toFixed(1)) }))
      .sort((a, b) => b.total - a.total);

    return {
      runsByDay: Array.from(dateMap, ([name, total]) => ({ name, total })),
      distanceByVehicle: Array.from(distanceMap, ([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total),
      stoppedTimeByVehicle: stoppedTimes,
    };
  }, [filteredRuns, date]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className={cn("flex w-full flex-wrap items-center justify-center gap-2", isMobile && "flex-col")}>
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: ptBR })} - {format(date.to, "LLL dd, y", { locale: ptBR })}</>) : (format(date.from, "LLL dd, y", { locale: ptBR }))) : (<span>Selecione uma data</span>)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>

          {isSuperAdmin && (
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filtrar por setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><Building className="h-4 w-4 inline-block mr-2" />Todos os Setores</SelectItem>
                {allSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar por Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os Turnos</SelectItem>
              {Object.values(SHIFT_NUM_TO_NAME).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar por veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><Truck className="h-4 w-4 inline-block mr-2" />Todos os Veículos</SelectItem>
              {vehicleList.map(v => <SelectItem key={v} value={v}><Truck className="h-4 w-4 inline-block mr-2" />{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Filtrar por motorista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><User className="h-4 w-4 inline-block mr-2" />Todos os Motoristas</SelectItem>
              {driverList.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="py-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Corridas Concluídas" value={kpis.totalRuns} icon={ClipboardCheck} />
          <KpiCard title="Paradas Totais" value={kpis.totalStops} icon={Milestone} />
          <KpiCard title="Distância Total" value={`${kpis.totalDistance.toFixed(1)} km`} icon={Route} />
          <KpiCard title="Duração Média" value={`${kpis.avgDurationMinutes.toFixed(0)} min`} icon={Timer} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Corridas por Dia" description="Total de corridas concluídas por dia.">
            <BarChart data={chartData.runsByDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="Km Rodados por Caminhão" description="Distância total percorrida por caminhão.">
            <BarChart data={chartData.distanceByVehicle} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} formatter={(value: any) => `${value} km`} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="Tempo Parado por Caminhão (Horas)" description="Soma do tempo em que o veículo ficou parado nas paradas (coletas/entregas)." className="lg:col-span-2">
            <BarChart data={chartData.stoppedTimeByVehicle}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} unit="h" />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} formatter={(value: number) => `${value.toFixed(1)} horas`} />
              <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
