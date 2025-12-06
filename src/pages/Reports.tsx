import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useBookings } from '@/contexts/BookingsContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { Button } from '@/components/ui/button';
import { Download, Search, PlusCircle, Pencil, ChevronDown, Building2, User, MessageSquare, Tag, CheckCircle, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, X, ExternalLink, Phone, UserCircle, Headphones, FileText, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TranscriptionModal } from '@/components/booking/TranscriptionModal';
import { Booking } from '@/types';
import { getAgentName } from '@/utils/agentUtils';
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
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';

type Site = {
  id: string;
  name: string;
};

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

type SortColumn = 'bookingDate' | 'moveInDate' | 'memberName' | 'agentName' | 'market' | 'bookingType' | 'status' | 'communicationMethod' | null;
type SortDirection = 'asc' | 'desc';

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
  usePageTracking('view_reports');
  const { bookings, refreshBookings } = useBookings();
  const { user } = useAuth();
  const { agents } = useAgents();
  const navigate = useNavigate();

  // Transcription modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Sites from Supabase
  const [sites, setSites] = useState<Site[]>([]);

  // Filter states - date ranges
  const [bookingDateRange, setBookingDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [moveInDateRange, setMoveInDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  // Other filter states
  const [siteFilter, setSiteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Clear all filters
  const clearAllFilters = () => {
    setBookingDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
    setMoveInDateRange({ from: undefined, to: undefined });
    setSiteFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setMethodFilter('all');
    setAgentFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = 
    moveInDateRange.from || moveInDateRange.to ||
    siteFilter !== 'all' || statusFilter !== 'all' || 
    typeFilter !== 'all' || methodFilter !== 'all' || 
    agentFilter !== 'all' || searchQuery !== '';

  // Sorting (primary and secondary)
  const [sortColumn, setSortColumn] = useState<SortColumn>('bookingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [secondarySortColumn, setSecondarySortColumn] = useState<SortColumn>(null);
  const [secondarySortDirection, setSecondarySortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn, isShiftClick: boolean = false) => {
    if (isShiftClick && sortColumn && column !== sortColumn) {
      // Shift+click: set secondary sort
      if (secondarySortColumn === column) {
        setSecondarySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSecondarySortColumn(column);
        setSecondarySortDirection(column === 'bookingDate' || column === 'moveInDate' ? 'desc' : 'asc');
      }
    } else {
      // Regular click: set primary sort
      if (sortColumn === column) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection(column === 'bookingDate' || column === 'moveInDate' ? 'desc' : 'asc');
        // Clear secondary if it's the same as new primary
        if (secondarySortColumn === column) {
          setSecondarySortColumn(null);
        }
      }
    }
  };

  const clearSecondarySort = () => {
    setSecondarySortColumn(null);
  };

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

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Booking date range filter
      if (bookingDateRange.from && bookingDateRange.to) {
        const bookingDate = new Date(booking.bookingDate);
        if (!isWithinInterval(bookingDate, { 
          start: startOfDay(bookingDateRange.from), 
          end: endOfDay(bookingDateRange.to) 
        })) {
          return false;
        }
      }

      // Move-in date range filter
      if (moveInDateRange.from && moveInDateRange.to) {
        const moveInDate = new Date(booking.moveInDate);
        if (!isWithinInterval(moveInDate, { 
          start: startOfDay(moveInDateRange.from), 
          end: endOfDay(moveInDateRange.to) 
        })) {
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
        const agentName = getAgentName(agents, booking.agentId);
        const matchesMember = booking.memberName.toLowerCase().includes(query);
        const matchesAgent = agentName.toLowerCase().includes(query);
        const matchesCity = booking.marketCity?.toLowerCase().includes(query);
        const matchesState = booking.marketState?.toLowerCase().includes(query);
        if (!matchesMember && !matchesAgent && !matchesCity && !matchesState) return false;
      }

      return true;
    });
  }, [bookings, bookingDateRange, moveInDateRange, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, searchQuery, agents]);

  // Helper to get sort value for a booking by column
  const getSortValue = (booking: typeof filteredBookings[0], column: SortColumn): string | number => {
    switch (column) {
      case 'bookingDate':
        return new Date(booking.bookingDate).getTime();
      case 'moveInDate':
        return new Date(booking.moveInDate).getTime();
      case 'memberName':
        return booking.memberName.toLowerCase();
      case 'agentName':
        return getAgentName(agents, booking.agentId).toLowerCase();
      case 'market':
        return `${booking.marketCity || ''} ${booking.marketState || ''}`.toLowerCase();
      case 'bookingType':
        return booking.bookingType.toLowerCase();
      case 'status':
        return booking.status.toLowerCase();
      case 'communicationMethod':
        return (booking.communicationMethod || '').toLowerCase();
      default:
        return 0;
    }
  };

  // Sort bookings (with primary and secondary sort)
  const sortedBookings = useMemo(() => {
    if (!sortColumn) return filteredBookings;

    return [...filteredBookings].sort((a, b) => {
      // Primary sort
      const aValue = getSortValue(a, sortColumn);
      const bValue = getSortValue(b, sortColumn);

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;

      // Secondary sort (when primary values are equal)
      if (secondarySortColumn) {
        const aSecondary = getSortValue(a, secondarySortColumn);
        const bSecondary = getSortValue(b, secondarySortColumn);

        if (aSecondary < bSecondary) return secondarySortDirection === 'asc' ? -1 : 1;
        if (aSecondary > bSecondary) return secondarySortDirection === 'asc' ? 1 : -1;
      }

      return 0;
    });
  }, [filteredBookings, sortColumn, sortDirection, secondarySortColumn, secondarySortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBookings = sortedBookings.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [bookingDateRange, moveInDateRange, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, searchQuery, sortColumn, sortDirection, secondarySortColumn, secondarySortDirection]);

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
      'HubSpot Link',
      'Kixie Link',
      'Admin Profile Link',
    ];

    const rows = filteredBookings.map(booking => [
      format(booking.bookingDate, 'yyyy-MM-dd'),
      format(booking.moveInDate, 'yyyy-MM-dd'),
      booking.memberName,
      getAgentName(agents, booking.agentId),
      booking.marketCity || '',
      booking.marketState || '',
      booking.bookingType,
      booking.status,
      booking.communicationMethod || '',
      booking.notes || '',
      booking.hubspotLink || '',
      booking.kixieLink || '',
      booking.adminProfileLink || '',
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

  const selectedSiteLabel = siteFilter === 'all' ? 'All Sites' : sites.find(s => s.id === siteFilter)?.name || 'All Sites';

  // Sortable header component
  const SortableHeader = ({ column, label }: { column: SortColumn; label: string }) => {
    const isPrimary = sortColumn === column;
    const isSecondary = secondarySortColumn === column;
    
    return (
      <th
        className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group select-none"
        onClick={(e) => handleSort(column, e.shiftKey)}
        title={isPrimary ? "Primary sort" : isSecondary ? "Secondary sort (click to change)" : "Click to sort, Shift+click for secondary sort"}
      >
        <div className="flex items-center gap-1">
          {label}
          {isPrimary ? (
            <span className="flex items-center">
              {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              <span className="text-[10px] ml-0.5 text-primary font-bold">1</span>
            </span>
          ) : isSecondary ? (
            <span className="flex items-center text-muted-foreground">
              {secondarySortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              <span className="text-[10px] ml-0.5 font-bold">2</span>
            </span>
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
          )}
        </div>
      </th>
    );
  };

  return (
    <DashboardLayout 
      title="Reports" 
      subtitle="Detailed booking data and exports"
    >
      {/* Filters Row 1 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Booking Date Range Filter */}
        <DateRangePicker
          label="Booking Date"
          dateRange={bookingDateRange}
          onDateRangeChange={setBookingDateRange}
        />

        {/* Move-In Date Range Filter */}
        <DateRangePicker
          label="Move-In Date"
          dateRange={moveInDateRange}
          onDateRangeChange={setMoveInDateRange}
        />

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

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={clearAllFilters}>
            <RotateCcw className="w-4 h-4" />
            Clear Filters
          </Button>
        )}

        {/* Clear Secondary Sort */}
        {secondarySortColumn && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs" onClick={clearSecondarySort}>
            <X className="w-3 h-3" />
            Clear 2nd sort
          </Button>
        )}

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
                <SortableHeader column="bookingDate" label="Booking Date" />
                <SortableHeader column="moveInDate" label="Move-In Date" />
                <SortableHeader column="memberName" label="Member" />
                <SortableHeader column="agentName" label="Agent" />
                <SortableHeader column="market" label="Market" />
                <SortableHeader column="bookingType" label="Type" />
                <SortableHeader column="status" label="Status" />
                <SortableHeader column="communicationMethod" label="Method" />
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
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
                      {getAgentName(agents, booking.agentId)}
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
                      <div className="flex items-center gap-2">
                        {booking.hubspotLink && (
                          <a href={booking.hubspotLink} target="_blank" rel="noopener noreferrer" title="HubSpot">
                            <ExternalLink className="h-4 w-4 text-orange-500 hover:text-orange-600 transition-colors" />
                          </a>
                        )}
                        {booking.kixieLink && (
                          <a href={booking.kixieLink} target="_blank" rel="noopener noreferrer" title="Kixie Call">
                            <Phone className="h-4 w-4 text-green-500 hover:text-green-600 transition-colors" />
                          </a>
                        )}
                        {booking.adminProfileLink && (
                          <a href={booking.adminProfileLink} target="_blank" rel="noopener noreferrer" title="Admin Profile">
                            <UserCircle className="h-4 w-4 text-blue-500 hover:text-blue-600 transition-colors" />
                          </a>
                        )}
                        {/* Transcription Status Icon - Instant click, no blocking refresh */}
                        {booking.kixieLink && (
                          <button
                            onClick={() => {
                              // Open modal immediately with current data
                              setSelectedBooking(booking);
                              setShowTranscriptModal(true);
                            }}
                            title={
                              booking.transcriptionStatus === 'completed' ? 'View Call Insights' :
                              booking.transcriptionStatus === 'processing' ? 'Transcription in progress...' :
                              'Transcribe Call'
                            }
                            className="hover:opacity-80 transition-opacity"
                          >
                            {booking.transcriptionStatus === 'completed' ? (
                              <FileText className="h-4 w-4 text-purple-500" />
                            ) : booking.transcriptionStatus === 'processing' ? (
                              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                            ) : (
                              <Headphones className="h-4 w-4 text-muted-foreground hover:text-purple-500 transition-colors" />
                            )}
                          </button>
                        )}
                      </div>
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
            Showing {sortedBookings.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedBookings.length)} of {sortedBookings.length} bookings
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

      {/* Transcription Modal - uses realtime subscription for updates */}
      {selectedBooking && (
        <TranscriptionModal
          booking={selectedBooking}
          isOpen={showTranscriptModal}
          onClose={() => {
            setShowTranscriptModal(false);
            setSelectedBooking(null);
          }}
          onTranscriptionComplete={() => {
            // Background refresh, no need to close modal
            refreshBookings(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}
