import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAgentStatus } from '@/contexts/AgentStatusContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Users, Clock, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes, differenceInSeconds } from 'date-fns';

interface SiteInfo {
  id: string;
  name: string;
}

interface ProfileInfo {
  id: string;
  name: string | null;
  site_id: string | null;
}

const STALE_THRESHOLD_MINUTES = 2; // Consider session stale if no activity for 2 minutes

export default function AgentStatus() {
  usePageTracking('view_agent_status');
  const { user, hasRole } = useAuth();
  const { sessions, isLoading: sessionsLoading } = useAgentStatus();
  const { agents } = useAgents();
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for live duration display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch sites
  useEffect(() => {
    const fetchSites = async () => {
      const { data } = await supabase.from('sites').select('id, name');
      if (data) setSites(data);
    };
    fetchSites();
  }, []);

  // Fetch profiles (for user names)
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, name, site_id');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  // Get agents who are supposed to be trackable (linked to users)
  const trackableAgents = useMemo(() => {
    return agents.filter(agent => agent.userId && agent.active);
  }, [agents]);

  // Build agent status list with online/offline
  const agentStatuses = useMemo(() => {
    return trackableAgents.map(agent => {
      // Find active session for this agent's user
      const session = sessions.find(s => s.user_id === agent.userId && s.is_active);
      
      // Check if session is stale (no activity for too long)
      const isStale = session && differenceInMinutes(currentTime, new Date(session.last_activity)) > STALE_THRESHOLD_MINUTES;
      const isOnline = session && !isStale;

      return {
        agentId: agent.id,
        userId: agent.userId,
        agentName: agent.name,
        siteId: agent.siteId,
        siteName: agent.siteName,
        isOnline,
        isStale,
        session,
        loginTime: session?.login_time ? new Date(session.login_time) : null,
        lastActivity: session?.last_activity ? new Date(session.last_activity) : null,
      };
    });
  }, [trackableAgents, sessions, currentTime]);

  // Filter by site
  const filteredStatuses = useMemo(() => {
    let filtered = agentStatuses;

    // Apply site filter
    if (selectedSiteId !== 'all') {
      filtered = filtered.filter(s => s.siteId === selectedSiteId);
    }

    // For supervisors, only show their site's agents
    if (hasRole(['supervisor']) && !hasRole(['super_admin', 'admin'])) {
      filtered = filtered.filter(s => s.siteId === user?.siteId);
    }

    // Sort: online first, then by name
    return filtered.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.agentName.localeCompare(b.agentName);
    });
  }, [agentStatuses, selectedSiteId, hasRole, user?.siteId]);

  // Summary stats
  const onlineCount = filteredStatuses.filter(s => s.isOnline).length;
  const offlineCount = filteredStatuses.filter(s => !s.isOnline).length;

  // Format duration
  const formatDuration = (startTime: Date | null) => {
    if (!startTime) return '-';
    
    const seconds = differenceInSeconds(currentTime, startTime);
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Format last activity
  const formatLastActivity = (lastActivity: Date | null) => {
    if (!lastActivity) return 'Never';
    return formatDistanceToNow(lastActivity, { addSuffix: true });
  };

  const canFilterSites = hasRole(['super_admin', 'admin']);

  return (
    <DashboardLayout 
      title="Agent Status" 
      subtitle="Real-time agent login status monitoring"
      actions={
        canFilterSites && (
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map(site => (
                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Now</p>
                <p className="text-3xl font-bold text-green-600">{onlineCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wifi className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-3xl font-bold text-muted-foreground">{offlineCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <WifiOff className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Agents</p>
                <p className="text-3xl font-bold">{filteredStatuses.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Agent Sessions
            <Badge variant="outline" className="ml-2">
              Live
              <span className="ml-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredStatuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No agents found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Site</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Session Duration</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatuses.map(status => (
                    <tr key={status.agentId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            status.isOnline 
                              ? 'bg-green-500' 
                              : status.isStale 
                                ? 'bg-amber-500' 
                                : 'bg-muted-foreground/30'
                          }`} />
                          <span className="font-medium">{status.agentName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{status.siteName}</td>
                      <td className="py-3 px-4">
                        {status.isOnline ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                            Online
                          </Badge>
                        ) : status.isStale ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600/30">
                            Idle
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Offline</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {status.isOnline ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDuration(status.loginTime)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {status.isOnline 
                          ? formatLastActivity(status.lastActivity)
                          : 'Offline'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
