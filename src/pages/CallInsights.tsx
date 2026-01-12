import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgents } from '@/contexts/AgentsContext';
import { CallDetailsModal } from '@/components/call-insights/CallDetailsModal';
import { CallsTable } from '@/components/call-insights/CallsTable';
import { CallInsightsStats } from '@/components/call-insights/CallInsightsStats';
import { 
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search, Filter,
  RefreshCw, AlertCircle
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export interface Call {
  id: string;
  kixie_call_id: string | null;
  recording_url: string | null;
  call_type: string;
  call_status: string;
  call_date: string;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  kixie_agent_name: string | null;
  agent_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  disposition: string | null;
  outcome_category: string | null;
  booking_id: string | null;
  transcription_status: string | null;
  source: string;
  created_at: string;
}

export default function CallInsights() {
  const { agents } = useAgents();
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');

  // Fetch calls
  const { data: calls, isLoading, refetch } = useQuery({
    queryKey: ['calls', agentFilter, statusFilter, outcomeFilter, dateRange],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), parseInt(dateRange)));
      
      let query = supabase
        .from('calls')
        .select('*')
        .gte('call_date', startDate.toISOString())
        .order('call_date', { ascending: false })
        .limit(500);

      if (agentFilter !== 'all') {
        query = query.eq('agent_id', agentFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('transcription_status', statusFilter);
      }
      if (outcomeFilter !== 'all') {
        if (outcomeFilter === 'booking') {
          query = query.not('booking_id', 'is', null);
        } else if (outcomeFilter === 'no_booking') {
          query = query.is('booking_id', null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Call[];
    },
  });

  // Filter by search query
  const filteredCalls = (calls || []).filter(call => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      call.contact_name?.toLowerCase().includes(search) ||
      call.contact_phone?.includes(search) ||
      call.kixie_agent_name?.toLowerCase().includes(search) ||
      call.disposition?.toLowerCase().includes(search)
    );
  });

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'Unknown';
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || 'Unknown';
  };

  return (
    <DashboardLayout title="Call Insights" subtitle="Analyze all calls including non-booking calls for coaching insights">
      <div className="space-y-6">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <CallInsightsStats calls={filteredCalls} />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or disposition..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Transcribed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="booking">With Booking</SelectItem>
                  <SelectItem value="no_booking">No Booking</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Calls Table */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <Phone className="h-4 w-4" />
              All Calls ({filteredCalls.length})
            </TabsTrigger>
            <TabsTrigger value="no-booking" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              No Booking ({filteredCalls.filter(c => !c.booking_id).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <CallsTable 
                calls={filteredCalls} 
                agents={agents}
                onSelectCall={setSelectedCall}
              />
            )}
          </TabsContent>

          <TabsContent value="no-booking">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <CallsTable 
                calls={filteredCalls.filter(c => !c.booking_id)} 
                agents={agents}
                onSelectCall={setSelectedCall}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Call Details Modal */}
        {selectedCall && (
          <CallDetailsModal
            call={selectedCall}
            agentName={getAgentName(selectedCall.agent_id)}
            onClose={() => setSelectedCall(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
