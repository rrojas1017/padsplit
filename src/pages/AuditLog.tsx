import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { format, startOfDay, isToday } from 'date-fns';
import { LogIn, LogOut, Eye, Download, UserCog, Database, LayoutDashboard, FileText, Brain, Trophy, Tv, ChartBar, Users, Settings, Link, Upload, ClipboardList, PlusCircle, Pencil, Filter, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgents } from '@/contexts/AgentsContext';
import { getAgentName } from '@/utils/agentUtils';

interface AccessLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource: string | null;
  created_at: string;
  ip_address: string | null;
}

interface BookingEditLog {
  id: string;
  booking_id: string;
  agent_id: string | null;
  user_id: string;
  user_name: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  edit_reason: string;
  created_at: string;
  booking?: {
    member_name: string;
  };
}

type DateFilter = 'today' | 'yesterday' | '7d' | 'all';
type TabValue = 'access' | 'bookingEdits';

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; colorClass: string }> = {
  login: { icon: <LogIn className="w-4 h-4" />, label: 'Login', colorClass: 'bg-success/20 text-success' },
  logout: { icon: <LogOut className="w-4 h-4" />, label: 'Logout', colorClass: 'bg-muted text-muted-foreground' },
  view_dashboard: { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard', colorClass: 'bg-primary/20 text-primary' },
  view_reports: { icon: <FileText className="w-4 h-4" />, label: 'Reports', colorClass: 'bg-purple-500/20 text-purple-500' },
  view_member_insights: { icon: <Brain className="w-4 h-4" />, label: 'Member Insights', colorClass: 'bg-purple-500/20 text-purple-500' },
  view_leaderboard: { icon: <Trophy className="w-4 h-4" />, label: 'Leaderboard', colorClass: 'bg-primary/20 text-primary' },
  view_coaching_hub: { icon: <Brain className="w-4 h-4" />, label: 'Coaching Hub', colorClass: 'bg-success/20 text-success' },
  view_wallboard: { icon: <Tv className="w-4 h-4" />, label: 'Wallboard', colorClass: 'bg-primary/20 text-primary' },
  view_my_performance: { icon: <ChartBar className="w-4 h-4" />, label: 'My Performance', colorClass: 'bg-success/20 text-success' },
  view_agent_status: { icon: <Users className="w-4 h-4" />, label: 'Agent Status', colorClass: 'bg-warning/20 text-warning' },
  view_settings: { icon: <Settings className="w-4 h-4" />, label: 'Settings', colorClass: 'bg-muted text-muted-foreground' },
  view_user_management: { icon: <UserCog className="w-4 h-4" />, label: 'User Management', colorClass: 'bg-warning/20 text-warning' },
  view_import: { icon: <Upload className="w-4 h-4" />, label: 'Import', colorClass: 'bg-accent/20 text-accent' },
  view_display_links: { icon: <Link className="w-4 h-4" />, label: 'Display Links', colorClass: 'bg-primary/20 text-primary' },
  view_audit_log: { icon: <ClipboardList className="w-4 h-4" />, label: 'Audit Log', colorClass: 'bg-muted text-muted-foreground' },
  view_add_booking: { icon: <PlusCircle className="w-4 h-4" />, label: 'Add Booking', colorClass: 'bg-success/20 text-success' },
  view_edit_booking: { icon: <Pencil className="w-4 h-4" />, label: 'Edit Booking', colorClass: 'bg-success/20 text-success' },
  export_csv: { icon: <Download className="w-4 h-4" />, label: 'Export CSV', colorClass: 'bg-accent/20 text-accent' },
  role_change: { icon: <UserCog className="w-4 h-4" />, label: 'Role Change', colorClass: 'bg-warning/20 text-warning' },
  data_import: { icon: <Database className="w-4 h-4" />, label: 'Data Import', colorClass: 'bg-primary/20 text-primary' },
};

export default function AuditLog() {
  usePageTracking('view_audit_log');
  const { agents } = useAgents();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [bookingEditLogs, setBookingEditLogs] = useState<BookingEditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [activeTab, setActiveTab] = useState<TabValue>('access');
  const [editLogAgentFilter, setEditLogAgentFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      // Fetch access logs
      const { data: accessData } = await supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (accessData) {
        setLogs(accessData);
      }

      // Fetch booking edit logs
      const { data: editData } = await supabase
        .from('booking_edit_logs')
        .select(`
          *,
          booking:bookings(member_name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (editData) {
        setBookingEditLogs(editData as BookingEditLog[]);
      }

      setIsLoading(false);
    };

    fetchData();
  }, []);

  // Get unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    logs.forEach(log => {
      if (log.user_name) {
        users.set(log.user_id || log.user_name, log.user_name);
      }
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Action filter
      if (actionFilter === 'auth' && !['login', 'logout'].includes(log.action)) return false;
      if (actionFilter === 'page_views' && !log.action.startsWith('view_')) return false;
      if (actionFilter === 'data' && !['export_csv', 'data_import', 'role_change'].includes(log.action)) return false;

      // User filter
      if (userFilter !== 'all' && log.user_id !== userFilter && log.user_name !== userFilter) return false;

      // Date filter
      const logDate = new Date(log.created_at);
      const today = startOfDay(new Date());
      if (dateFilter === 'today' && !isToday(logDate)) return false;
      if (dateFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const logDay = startOfDay(logDate);
        if (logDay.getTime() !== yesterday.getTime()) return false;
      }
      if (dateFilter === '7d') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (logDate < weekAgo) return false;
      }

      return true;
    });
  }, [logs, actionFilter, userFilter, dateFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const todayLogs = logs.filter(log => isToday(new Date(log.created_at)));
    const pageViews = todayLogs.filter(log => log.action.startsWith('view_')).length;
    const activeUsers = new Set(todayLogs.map(log => log.user_id)).size;
    const logins = todayLogs.filter(log => log.action === 'login').length;

    // Most visited section
    const sectionCounts: Record<string, number> = {};
    todayLogs.filter(log => log.action.startsWith('view_')).forEach(log => {
      sectionCounts[log.action] = (sectionCounts[log.action] || 0) + 1;
    });
    const topSection = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1])[0];
    const topSectionLabel = topSection ? (ACTION_CONFIG[topSection[0]]?.label || topSection[0]) : 'N/A';

    return { pageViews, activeUsers, logins, topSectionLabel };
  }, [logs]);

  // Filter booking edit logs
  const filteredEditLogs = useMemo(() => {
    return bookingEditLogs.filter(log => {
      // Agent filter
      if (editLogAgentFilter !== 'all' && log.agent_id !== editLogAgentFilter) return false;

      // Date filter
      const logDate = new Date(log.created_at);
      const today = startOfDay(new Date());
      if (dateFilter === 'today' && !isToday(logDate)) return false;
      if (dateFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const logDay = startOfDay(logDate);
        if (logDay.getTime() !== yesterday.getTime()) return false;
      }
      if (dateFilter === '7d') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (logDate < weekAgo) return false;
      }

      return true;
    });
  }, [bookingEditLogs, editLogAgentFilter, dateFilter]);

  // Get unique agents for edit log filter
  const uniqueEditLogAgents = useMemo(() => {
    const agentIds = new Set(bookingEditLogs.map(log => log.agent_id).filter(Boolean));
    return Array.from(agentIds).map(id => ({
      id: id!,
      name: getAgentName(agents, id!),
    }));
  }, [bookingEditLogs, agents]);

  const getActionDisplay = (action: string) => {
    const config = ACTION_CONFIG[action];
    if (config) return config;
    return { icon: <Eye className="w-4 h-4" />, label: action.replace(/_/g, ' '), colorClass: 'bg-primary/20 text-primary' };
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pageViews}</p>
                <p className="text-sm text-muted-foreground">Page Views Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activeUsers}</p>
                <p className="text-sm text-muted-foreground">Active Users Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.topSectionLabel}</p>
                <p className="text-sm text-muted-foreground">Most Visited</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Pencil className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredEditLogs.length}</p>
                <p className="text-sm text-muted-foreground">Booking Edits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Access Logs vs Booking Edits */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="access">Access Logs</TabsTrigger>
          <TabsTrigger value="bookingEdits">Booking Edits</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="space-y-4">
          {/* Access Logs Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="auth">Login / Logout</SelectItem>
                <SelectItem value="page_views">Page Views</SelectItem>
                <SelectItem value="data">Data Actions</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Access Log Table */}
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
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const actionDisplay = getActionDisplay(log.action);
                      return (
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
                              actionDisplay.colorClass
                            )}>
                              {actionDisplay.icon}
                              {actionDisplay.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                            {log.resource || '/'}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                            {log.ip_address || 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bookingEdits" className="space-y-4">
          {/* Booking Edits Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={editLogAgentFilter} onValueChange={setEditLogAgentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {uniqueEditLogAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredEditLogs.length} {filteredEditLogs.length === 1 ? 'edit' : 'edits'}
            </span>
          </div>

          {/* Booking Edits Table */}
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp (EST)</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[300px]">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No booking edits found
                      </td>
                    </tr>
                  ) : (
                    filteredEditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-sm text-foreground">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')} EST
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {log.user_name}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {(log.booking as any)?.member_name || 'Unknown Member'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              "bg-muted text-muted-foreground"
                            )}>
                              {log.old_value || 'N/A'}
                            </span>
                            <RefreshCw className="w-3 h-3 text-muted-foreground" />
                            <span className={cn(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              log.new_value === 'Moved In' && 'bg-success/20 text-success',
                              log.new_value === 'Postponed' && 'bg-primary/20 text-primary',
                              log.new_value === 'No Show' && 'bg-muted text-muted-foreground',
                              log.new_value === 'Cancelled' && 'bg-muted text-muted-foreground',
                              log.new_value === 'Member Rejected' && 'bg-destructive/20 text-destructive',
                              !['Moved In', 'Postponed', 'No Show', 'Cancelled', 'Member Rejected'].includes(log.new_value || '') && 'bg-accent/20 text-accent'
                            )}>
                              {log.new_value || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {log.edit_reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}