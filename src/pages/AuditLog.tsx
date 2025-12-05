import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { format } from 'date-fns';
import { LogIn, LogOut, Eye, Download, UserCog, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AccessLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource: string | null;
  created_at: string;
  ip_address: string | null;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setLogs(data);
      }
      setIsLoading(false);
    };

    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <LogIn className="w-4 h-4" />;
      case 'logout': return <LogOut className="w-4 h-4" />;
      case 'view_dashboard': return <Eye className="w-4 h-4" />;
      case 'export_csv': return <Download className="w-4 h-4" />;
      case 'role_change': return <UserCog className="w-4 h-4" />;
      case 'data_import': return <Database className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-success/20 text-success';
      case 'logout': return 'bg-muted text-muted-foreground';
      case 'export_csv': return 'bg-accent/20 text-accent';
      case 'role_change': return 'bg-warning/20 text-warning';
      case 'data_import': return 'bg-primary/20 text-primary';
      default: return 'bg-primary/20 text-primary';
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout 
        title="Audit Log" 
        subtitle="Track all user activities and access events"
      >
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="p-4 space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Audit Log" 
      subtitle="Track all user activities and access events"
    >
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp (EST)</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resource</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')} EST
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {log.user_name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                        getActionColor(log.action)
                      )}>
                        {getActionIcon(log.action)}
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                      {log.resource || '/'}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                      {log.ip_address || 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
