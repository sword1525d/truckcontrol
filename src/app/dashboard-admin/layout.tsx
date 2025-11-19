
'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './Sidebar';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <AdminSidebar />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-background px-6 sticky top-0 z-30">
             <div className="lg:hidden">
              <SidebarTrigger />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {format(new Date(), "eeee, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

    