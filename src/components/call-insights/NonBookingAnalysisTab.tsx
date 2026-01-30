import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAgents } from '@/contexts/AgentsContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CallDetailsModal } from '@/components/call-insights/CallDetailsModal';
import { CallsTable } from '@/components/call-insights/CallsTable';
import { NonBookingSummaryCards } from '@/components/call-insights/NonBookingSummaryCards';
import { NonBookingReasonsChart } from '@/components/call-insights/NonBookingReasonsChart';
import { MissedOpportunitiesPanel } from '@/components/call-insights/MissedOpportunitiesPanel';
import { Search, RefreshCw, Phone, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subDays, startOfDay } from 'date-fns';
import { Call } from '@/pages/CallInsights';

type DateRangeOption = 'last7days' | 'last30days' | 'thisMonth' | 'last3months' | 'allTime';

interface NonBookingAnalysisTabProps {
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

export function NonBookingAnalysisTab({ dateRange, onDateRangeChange }: NonBookingAnalysisTabProps) {
  const { agents } = useAgents();
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getDateRangeDays = (option: DateRangeOption): number | null => {
    switch (option) {
      case 'last7days': return 7;
      case 'last30days': return 30;
      case 'thisMonth': return 30;
      case 'last3months': return 90;
      case 'allTime': return null;
      default: return 30;
    }
  };

  const { data: calls, isLoading, refetch } = useQuery({
    queryKey: ['non-booking-calls', agentFilter, statusFilter, dateRange],
    queryFn: async () => {
      const days = getDateRangeDays(dateRange);
      
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('status', 'Non Booking')
        .order('booking_date', { ascending: false });

      if (days !== null) {
        const startDate = startOfDay(subDays(new Date(), days));
        query = query.gte('booking_date', startDate.toISOString().split('T')[0]);
      }

      if (agentFilter !== 'all') {
        query = query.eq('agent_id', agentFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('transcription_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((booking): Call => ({
        id: booking.id,
        kixie_call_id: null,
        recording_url: booking.kixie_link,
        call_type: booking.booking_type,
        call_status: 'completed',
        call_date: booking.booking_date,
        duration_seconds: booking.call_duration_seconds,
        from_number: null,
        to_number: null,
        kixie_agent_name: null,
        agent_id: booking.agent_id,
        contact_name: booking.member_name,
        contact_phone: null,
        disposition: booking.notes,
        outcome_category: 'Non Booking',
        booking_id: null,
        transcription_status: booking.transcription_status,
        source: 'historical_import',
        created_at: booking.created_at,
      }));
    },
  });

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
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => onDateRangeChange(v as DateRangeOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="last3months">Last 3 Months</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <NonBookingSummaryCards calls={filteredCalls} />

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NonBookingReasonsChart />
        <MissedOpportunitiesPanel 
          calls={filteredCalls} 
          onSelectCall={setSelectedCall}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Phone className="h-4 w-4" />
            All Non-Booking Calls ({filteredCalls.length.toLocaleString()})
          </TabsTrigger>
          <TabsTrigger value="with-recording" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            With Recordings ({filteredCalls.filter(c => c.recording_url).length.toLocaleString()})
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

        <TabsContent value="with-recording">
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
              calls={filteredCalls.filter(c => c.recording_url)} 
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
  );
}
