import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockAccessLogs } from '@/data/mockData';
import { format } from 'date-fns';
import { LogIn, LogOut, Eye, Download, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuditLog() {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <LogIn className="w-4 h-4" />;
      case 'logout': return <LogOut className="w-4 h-4" />;
      case 'view_dashboard': return <Eye className="w-4 h-4" />;
      case 'export_csv': return <Download className="w-4 h-4" />;
      case 'role_change': return <UserCog className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-success/20 text-success';
      case 'logout': return 'bg-muted text-muted-foreground';
      case 'export_csv': return 'bg-accent/20 text-accent';
      case 'role_change': return 'bg-warning/20 text-warning';
      default: return 'bg-primary/20 text-primary';
    }
  };

  // Combine mock logs with any stored logs
  const storedLogs = JSON.parse(localStorage.getItem('access_logs') || '[]');
  const allLogs = [...mockAccessLogs, ...storedLogs.map((log: any, i: number) => ({
    id: `stored-${i}`,
    userId: log.userId,
    userName: 'User',
    action: log.action,
    resource: '/',
    createdAt: new Date(log.timestamp),
    ipAddress: 'N/A'
  }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resource</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 text-sm text-foreground">
                    {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">
                    {log.userName}
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
                    {log.resource}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                    {log.ipAddress || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
