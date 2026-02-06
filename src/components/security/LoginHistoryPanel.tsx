import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Plus, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LoginHistoryEntry {
  id: string;
  user_id: string | null;
  ip_address: string | null;
  action: string;
  resource: string | null;
  created_at: string;
  profiles?: { 
    name: string | null;
    email: string | null;
    site_id: string | null;
  } | null;
}

interface IPAllowlistEntry {
  ip_address: string;
  is_active: boolean;
}

interface Site {
  id: string;
  name: string;
}

interface LoginHistoryPanelProps {
  entries: IPAllowlistEntry[];
  sites: Site[];
  onQuickAdd: (ip: string, siteId: string | null, description: string) => void;
}

export function LoginHistoryPanel({ entries, sites, onQuickAdd }: LoginHistoryPanelProps) {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchLoginHistory();
  }, []);

  const fetchLoginHistory = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select(`
          id,
          user_id,
          ip_address,
          action,
          resource,
          created_at,
          profiles!access_logs_user_id_fkey(name, email, site_id)
        `)
        .in('action', ['login', 'login_ip_allowed', 'blocked_login_ip'])
        .not('ip_address', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLoginHistory(data || []);
    } catch (error) {
      console.error('Error fetching login history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const isIpInAllowlist = (ip: string): boolean => {
    return entries.some(e => e.ip_address === ip && e.is_active);
  };

  const parseResource = (resource: string | null): Record<string, any> => {
    if (!resource) return {};
    try {
      return JSON.parse(resource);
    } catch {
      return {};
    }
  };

  const getSiteName = (siteId: string | null): string => {
    if (!siteId) return 'Unknown';
    const site = sites.find(s => s.id === siteId);
    return site?.name || 'Unknown';
  };

  const filteredHistory = loginHistory.filter(entry => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'allowed') return entry.action === 'login_ip_allowed' || entry.action === 'login';
    if (statusFilter === 'blocked') return entry.action === 'blocked_login_ip';
    return true;
  });

  // Aggregate unique IPs
  const uniqueIPs = filteredHistory.reduce((acc, entry) => {
    if (!entry.ip_address) return acc;
    const existing = acc.find(u => u.ip === entry.ip_address);
    if (existing) {
      existing.count++;
      if (new Date(entry.created_at) > new Date(existing.lastSeen)) {
        existing.lastSeen = entry.created_at;
      }
    } else {
      acc.push({
        ip: entry.ip_address,
        count: 1,
        lastSeen: entry.created_at,
        isBlocked: entry.action === 'blocked_login_ip',
        siteId: entry.profiles?.site_id || null,
      });
    }
    return acc;
  }, [] as { ip: string; count: number; lastSeen: string; isBlocked: boolean; siteId: string | null }[]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-8 pt-8 border-t">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Recent Login Activity</h3>
          <p className="text-sm text-muted-foreground">
            IP addresses captured from recent login attempts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Logins</SelectItem>
              <SelectItem value="allowed">Allowed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchLoginHistory}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* No data state */}
      {loginHistory.length === 0 && (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">No Login History Yet</h3>
          <p className="text-sm text-muted-foreground">
            Login IPs will appear here after agents log in with IP validation enabled.
          </p>
        </div>
      )}

      {/* Login history table */}
      {filteredHistory.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.slice(0, 20).map(entry => {
                const resource = parseResource(entry.resource);
                const isInAllowlist = entry.ip_address ? isIpInAllowlist(entry.ip_address) : false;
                const isBlocked = entry.action === 'blocked_login_ip';
                
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.profiles?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{entry.profiles?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.ip_address}</TableCell>
                    <TableCell>
                      {isBlocked ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          Blocked
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Allowed
                        </Badge>
                      )}
                      {resource.matched_rule && (
                        <div className="text-xs text-muted-foreground mt-1">
                          via {resource.matched_rule}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInAllowlist ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          In Allowlist
                        </Badge>
                      ) : entry.ip_address ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => onQuickAdd(
                            entry.ip_address!,
                            entry.profiles?.site_id || null,
                            `Added from login history - ${entry.profiles?.name || 'Unknown user'}`
                          )}
                        >
                          <Plus className="w-4 h-4" />
                          Add to Allowlist
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Unique IPs summary */}
      {uniqueIPs.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Unique IPs Summary</h4>
          <div className="border rounded-lg divide-y">
            {uniqueIPs.slice(0, 10).map(({ ip, count, lastSeen, isBlocked, siteId }) => {
              const isInAllowlist = isIpInAllowlist(ip);
              return (
                <div key={ip} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm">{ip}</span>
                    <span className="text-sm text-muted-foreground">
                      {count} login{count !== 1 ? 's' : ''} • last {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isBlocked && (
                      <Badge variant="destructive" className="text-xs">Blocked</Badge>
                    )}
                    {isInAllowlist ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={() => onQuickAdd(ip, siteId, 'Added from login history')}
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
