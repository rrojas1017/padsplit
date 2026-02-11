import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardLayout({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const { collapsed } = useSidebar();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(['super_admin']);
  const { criticalNotifications } = useAdminNotifications();

  const showCriticalBanner = isSuperAdmin && criticalNotifications.length > 0;

  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />
      <div className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        <Header title={title} subtitle={subtitle} actions={actions} />
        
        {/* Critical cost alert banner for super admins */}
        {showCriticalBanner && (
          <div className="bg-destructive/10 border-b border-destructive/30 px-6 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-destructive">
                COST ALERT: {criticalNotifications.length} unresolved critical {criticalNotifications.length === 1 ? 'alert' : 'alerts'}
              </span>
              {criticalNotifications[0] && (
                <span className="text-sm text-destructive/80 ml-2">
                  — {criticalNotifications[0].title}
                </span>
              )}
            </div>
          </div>
        )}

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
