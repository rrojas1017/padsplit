import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardLayout({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const { collapsed } = useSidebar();
  
  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />
      <div className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        <Header title={title} subtitle={subtitle} actions={actions} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
