import { ReactNode } from 'react';
import { ResearchSidebar } from './ResearchSidebar';
import { Header } from './Header';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface ResearchLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function ResearchLayout({ children, title, subtitle, actions }: ResearchLayoutProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background flex w-full">
      <ResearchSidebar />
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
