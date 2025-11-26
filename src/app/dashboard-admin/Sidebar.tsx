
'use client';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LogOut,
  Truck,
  PanelLeft,
  LayoutDashboard,
  Map,
  History,
  Users,
  Fuel,
  ClipboardCheck,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useFirebase } from '@/firebase';

export function AdminSidebar() {
  const { auth } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar, state } = useSidebar();
  
  const handleLogout = () => {
    if (auth && confirm('Tem certeza que deseja sair da conta?')) {
      auth.signOut();
      localStorage.clear();
      router.push('/login');
    }
  };

  const menuItems = [
    { href: '/dashboard-admin', label: 'Visão Geral', icon: LayoutDashboard },
    { href: '/dashboard-admin/tracking', label: 'Acompanhamento', icon: Map },
    { href: '/dashboard-admin/history', label: 'Histórico e Análise', icon: History },
    { href: '/dashboard-admin/refueling', label: 'Abastecimentos', icon: Fuel },
    { href: '/dashboard-admin/checklists', label: 'Checklists', icon: ClipboardCheck },
    { href: '/dashboard-admin/manage', label: 'Gerenciamento', icon: Users },
  ];

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
            Frotacontrol
            </h1>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                onClick={() => router.push(item.href)}
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="hidden lg:block">
            <SidebarMenuButton onClick={toggleSidebar} tooltip="Recolher">
                <PanelLeft className={`transition-transform duration-300 ${state === 'collapsed' ? 'rotate-180' : ''}`} />
                <span>Recolher</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

    