import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useBookings } from '@/contexts/BookingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { Button } from '@/components/ui/button';
import { Download, Filter, Search, PlusCircle, Pencil, ChevronDown, Calendar, Building2, User, MessageSquare, Tag, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Site = {
  id: string;
  name: string;
};

const datePresets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This month', value: 'month' },
  { label: 'All time', value: 'all' },
];

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending Move-In', value: 'Pending Move-In' },
  { label: 'Moved In', value: 'Moved In' },
  { label: 'Member Rejected', value: 'Member Rejected' },
  { label: 'No Show', value: 'No Show' },
  { label: 'Cancelled', value: 'Cancelled' },
];

const bookingTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Inbound', value: 'Inbound' },
  { label: 'Outbound', value: 'Outbound' },
  { label: 'Referral', value: 'Referral' },
];

const communicationMethodOptions = [
  { label: 'All Methods', value: 'all' },
  { label: 'Phone', value: 'Phone' },
  { label: 'SMS', value: 'SMS' },
  { label: 'LC', value: 'LC' },
  { label: 'Email', value: 'Email' },
];

export default function Reports() {
  const { bookings } = useBookings();
  const { user } = useAuth();
  const { agents } = useAgents();
  const navigate = useNavigate();

  // Sites from Supabase
  const [sites, setSites] = useState<Site[]>([]);

  // Filter states
  const [dateRange, setDateRange] = useState('today');
  const [siteFilter, setSiteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch sites from Supabase
  useEffect(() => {
    const fetchSites = async () => {
      const { data } = await supabase.from('sites').select('id, name');
      if (data) setSites(data);
    };
    fetchSites();
  }, []);

  // Check if user can edit a specific booking
  const canEditBooking = (bookingAgentId: string) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (user.role === 'supervisor') {
      const agent = agents.find(a => a.id === bookingAgentId);
      return agent?.siteId === user.siteId;
    }
    if (user.role === 'agent') {
      const agent = agents.find(a => a.id === bookingAgentId);
      return agent?.userId === user.id;
    }
    return false;
  };

  // Get date range for filtering
  const getDateRange = (preset: string): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case '7d':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case '30d':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
      default:
        return null;
    }
  };

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Date range filter
      const dateRangeObj = getDateRange(dateRange);
      if (dateRangeObj) {
        const bookingDate = new Date(booking.bookingDate);
        if (!isWithinInterval(bookingDate, { start: dateRangeObj.start, end: dateRangeObj.end })) {
          return false;
        }
      }

      // Site filter
      if (siteFilter !== 'all') {
        const agent = agents.find(a => a.id === booking.agentId);
        if (agent?.siteId !== siteFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && booking.bookingType !== typeFilter) return false;

      // Method filter
      if (methodFilter !== 'all' && booking.communicationMethod !== methodFilter) return false;

      // Agent filter
      if (agentFilter !== 'all' && booking.agentId !== agentFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesMember = booking.memberName.toLowerCase().includes(query);
        const matchesAgent = booking.agentName.toLowerCase().includes(query);
        const matchesCity = booking.marketCity?.toLowerCase().includes(query);
        const matchesState = booking.marketState?.toLowerCase().includes(query);
        if (!matchesMember && !matchesAgent && !matchesCity && !matchesState) return false;
      }

      return true;
    });
  }, [bookings, dateRange, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, searchQuery, agents]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBookings = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, searchQuery]);

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'Booking Date',
      'Move-In Date',
      'Member Name',
      'Agent',
      'Market City',
      'Market State',
      'Booking Type',
      'Status',
      'Communication Method',
      'Notes',
    ];

    const rows = filteredBookings.map(booking => [
      format(booking.bookingDate, 'yyyy-MM-dd'),
      format(booking.moveInDate, 'yyyy-MM-dd'),
      booking.memberName,
      booking.agentName,
      booking.marketCity || '',
      booking.marketState || '',
      booking.bookingType,
      booking.status,
      booking.communicationMethod || '',
      booking.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bookings-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const statusColors: Record<string, string> = {
    'Pending Move-In': 'bg-warning/20 text-warning',
    'Moved In': 'bg-success/20 text-success',
    'Member Rejected': 'bg-destructive/20 text-destructive',
    'No Show': 'bg-muted text-muted-foreground',
    'Cancelled': 'bg-muted text-muted-foreground',
  };

  const selectedDateLabel = datePresets.find(p => p.value === dateRange)?.label || 'Select range';
  const selectedSiteLabel = siteFilter === 'all' ? 'All Sites' : sites.find(s => s.id === siteFilter)?.name || 'All Sites';

  return (
    <DashboardLayout 
      title="Reports" 
      subtitle="Detailed booking data and exports"
    >
      {/* Filters Row 1 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Date Range Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              {selectedDateLabel}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {datePresets.map((preset) => (
              <DropdownMenuItem
                key={preset.value}
                onClick={() => setDateRange(preset.value)}
                className={dateRange === preset.value ? 'bg-accent/20' : ''}
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Site Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Building2 className="w-4 h-4" />
              {selectedSiteLabel}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => setSiteFilter('all')}
              className={siteFilter === 'all' ? 'bg-accent/20' : ''}
            >
              All Sites
            </DropdownMenuItem>
            {sites.map((site) => (
              <DropdownMenuItem
                key={site.id}
                onClick={() => setSiteFilter(site.id)}
                className={siteFilter === site.id ? 'bg-accent/20' : ''}
              >
                {site.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              {statusOptions.find(s => s.value === statusFilter)?.label}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {statusOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={statusFilter === option.value ? 'bg-accent/20' : ''}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Booking Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Tag className="w-4 h-4" />
              {bookingTypeOptions.find(t => t.value === typeFilter)?.label}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {bookingTypeOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTypeFilter(option.value)}
                className={typeFilter === option.value ? 'bg-accent/20' : ''}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Communication Method Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              {communicationMethodOptions.find(m => m.value === methodFilter)?.label}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {communicationMethodOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setMethodFilter(option.value)}
                className={methodFilter === option.value ? 'bg-accent/20' : ''}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Agent Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <User className="w-4 h-4" />
              {agentFilter === 'all' ? 'All Agents' : agents.find(a => a.id === agentFilter)?.name || 'All Agents'}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => setAgentFilter('all')}
              className={agentFilter === 'all' ? 'bg-accent/20' : ''}
            >
              All Agents
            </DropdownMenuItem>
            {agents.filter(a => a.active).map((agent) => (
              <DropdownMenuItem
                key={agent.id}
                onClick={() => setAgentFilter(agent.id)}
                className={agentFilter === agent.id ? 'bg-accent/20' : ''}
              >
                {agent.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters Row 2 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by member, agent, market..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Items per page */}
        <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>

        {/* Export CSV */}
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>

        {/* Add Booking */}
        <Button className="gap-2" onClick={() => navigate('/add-booking')}>
          <PlusCircle className="w-4 h-4" />
          Add Booking
        </Button>
      </div>

      {/* Data Table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Move-In Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No bookings found matching your filters
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(booking.bookingDate, 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(booking.moveInDate, 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {booking.memberName}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {booking.agentName}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {booking.marketCity}, {booking.marketState}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {booking.bookingType}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        statusColors[booking.status]
                      )}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {booking.communicationMethod}
                    </td>
                    <td className="py-3 px-4">
                      {canEditBooking(booking.agentId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => navigate(`/edit-booking/${booking.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredBookings.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
