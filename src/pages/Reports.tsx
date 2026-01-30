import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useReportsData, ReportsFilters, ReportsPagination, ReportsSorting, SortColumn, SortDirection } from '@/hooks/useReportsData';
import { Button } from '@/components/ui/button';
import { Download, Search, PlusCircle, Pencil, ChevronDown, Building2, User, MessageSquare, Tag, CheckCircle, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, X, ExternalLink, Phone, UserCircle, Headphones, FileText, Loader2, MoreHorizontal, Clock, CalendarX, XCircle, Ban, AlertTriangle, Package } from 'lucide-react';
import { ContactProfileHoverCard } from '@/components/reports/ContactProfileHoverCard';
import { Input } from '@/components/ui/input';
import { format, startOfDay, endOfDay } from 'date-fns';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { Skeleton } from '@/components/ui/skeleton';

type Site = {
  id: string;
  name: string;
};

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending Move-In', value: 'Pending Move-In' },
  { label: 'Moved In', value: 'Moved In' },
  { label: 'Member Rejected', value: 'Member Rejected' },
  { label: 'No Show', value: 'No Show' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'Postponed', value: 'Postponed' },
  { label: 'Non Booking', value: 'Non Booking' },
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

const rebookingFilterOptions = [
  { label: 'All Records', value: 'all' },
  { label: 'New Bookings Only', value: 'new' },
  { label: 'Rebookings Only', value: 'rebooking' },
];

export default function Reports() {
  usePageTracking('view_reports');
  const { updateBooking } = useBookings();
  const { user } = useAuth();
  const { agents } = useAgents();
  const navigate = useNavigate();

  // Transcription modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Sites from Supabase
  const [sites, setSites] = useState<Site[]>([]);

  // Filter states - date ranges (default to "All Time" - undefined)
  const [recordDateRange, setRecordDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [moveInDateRange, setMoveInDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  // Import batch filter
  const [importBatchFilter, setImportBatchFilter] = useState('all');

  // Other filter states
  const [siteFilter, setSiteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [rebookingFilter, setRebookingFilter] = useState<'all' | 'new' | 'rebooking'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting (primary only for server-side)
  const [sortColumn, setSortColumn] = useState<SortColumn>('bookingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Build filters object for hook
  const filters: ReportsFilters = useMemo(() => ({
    recordDateRange,
    moveInDateRange,
    importBatchFilter,
    siteId: siteFilter,
    status: statusFilter,
    bookingType: typeFilter,
    communicationMethod: methodFilter,
    agentId: agentFilter,
    rebookingFilter,
    searchQuery,
  }), [recordDateRange, moveInDateRange, importBatchFilter, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, rebookingFilter, searchQuery]);

  const pagination: ReportsPagination = useMemo(() => ({
    page: currentPage,
    pageSize: itemsPerPage,
  }), [currentPage, itemsPerPage]);

  const sorting: ReportsSorting = useMemo(() => ({
    column: sortColumn,
    direction: sortDirection,
  }), [sortColumn, sortDirection]);

  // Use the server-side pagination hook
  const { 
    records, 
    totalCount, 
    isLoading, 
    importBatches, 
    manualRecordCount,
    refetch 
  } = useReportsData(filters, pagination, sorting);

  // Clear all filters
  const clearAllFilters = () => {
    setRecordDateRange({ from: undefined, to: undefined });
    setMoveInDateRange({ from: undefined, to: undefined });
    setImportBatchFilter('all');
    setSiteFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setMethodFilter('all');
    setAgentFilter('all');
    setRebookingFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    recordDateRange.from || recordDateRange.to ||
    moveInDateRange.from || moveInDateRange.to ||
    importBatchFilter !== 'all' ||
    siteFilter !== 'all' || statusFilter !== 'all' || 
    typeFilter !== 'all' || methodFilter !== 'all' || 
    agentFilter !== 'all' || rebookingFilter !== 'all' || searchQuery !== '';

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'bookingDate' || column === 'moveInDate' ? 'desc' : 'asc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [recordDateRange, moveInDateRange, importBatchFilter, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, searchQuery, rebookingFilter]);

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

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Format phone number helper
  const formatPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'Record Date',
      'Move-In Date',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
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

    const rows = records.map(booking => [
      format(booking.bookingDate, 'yyyy-MM-dd'),
      booking.status === 'Non Booking' ? '' : format(booking.moveInDate, 'yyyy-MM-dd'),
      booking.memberName,
      booking.contactEmail || '',
      booking.contactPhone || '',
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
    link.download = `records-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const statusColors: Record<string, string> = {
    'Pending Move-In': 'bg-warning/20 text-warning',
    'Moved In': 'bg-success/20 text-success',
    'Member Rejected': 'bg-destructive/20 text-destructive',
    'No Show': 'bg-muted text-muted-foreground',
    'Cancelled': 'bg-muted text-muted-foreground',
    'Postponed': 'bg-primary/20 text-primary',
    'Non Booking': 'bg-slate-500/20 text-slate-500',
  };

  const selectedSiteLabel = siteFilter === 'all' ? 'All Sites' : sites.find(s => s.id === siteFilter)?.name || 'All Sites';

  // Get import batch label
  const getImportBatchLabel = () => {
    if (importBatchFilter === 'all') return 'All Records';
    if (importBatchFilter === 'manual') return `Manual Entries (${manualRecordCount.toLocaleString()})`;
    const batch = importBatches.find(b => b.id === importBatchFilter);
    if (batch) return `${batch.id} (${batch.count.toLocaleString()})`;
    return 'All Records';
  };

  // Sortable header component
  const SortableHeader = ({ column, label }: { column: SortColumn; label: string }) => {
    const isPrimary = sortColumn === column;
    
    return (
      <th
        className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group select-none"
        onClick={() => handleSort(column)}
        title="Click to sort"
      >
        <div className="flex items-center gap-1">
          {label}
          {isPrimary ? (
            <span className="flex items-center">
              {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            </span>
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
          )}
        </div>
      </th>
    );
  };

  // Summary statistics (computed from server count, not records)
  const summaryStats = useMemo(() => {
    const total = totalCount;
    const pendingMoveIn = records.filter(b => b.status === 'Pending Move-In').length;
    const movedIn = records.filter(b => b.status === 'Moved In').length;
    const memberRejected = records.filter(b => b.status === 'Member Rejected').length;
    const noShowCancelled = records.filter(b => b.status === 'No Show' || b.status === 'Cancelled').length;
    const postponed = records.filter(b => b.status === 'Postponed').length;
    const nonBooking = records.filter(b => b.status === 'Non Booking').length;
    const rebookings = records.filter(b => b.isRebooking).length;
    const newBookings = records.length - rebookings - nonBooking;
    
    return { total, pendingMoveIn, movedIn, memberRejected, noShowCancelled, postponed, nonBooking, rebookings, newBookings };
  }, [totalCount, records]);

  // Loading skeleton for table rows
  const TableSkeleton = () => (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
          <td className="py-3 px-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
          <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
          <td className="py-3 px-4"><Skeleton className="h-8 w-8" /></td>
        </tr>
      ))}
    </>
  );

  return (
    <DashboardLayout 
      title="Reports" 
      subtitle="Detailed call records and exports"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Records</p>
          <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.total.toLocaleString()}</p>
          {!isLoading && summaryStats.rebookings > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.newBookings} new, {summaryStats.rebookings} rebookings
            </p>
          )}
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending Move-In</p>
          </div>
          <p className="text-2xl font-bold text-warning mt-1">{summaryStats.pendingMoveIn}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Postponed</p>
          </div>
          <p className="text-2xl font-bold text-primary mt-1">{summaryStats.postponed}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Moved In</p>
          </div>
          <p className="text-2xl font-bold text-success mt-1">{summaryStats.movedIn}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Member Rejected</p>
          </div>
          <p className="text-2xl font-bold text-destructive mt-1">{summaryStats.memberRejected}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">No Show / Cancelled</p>
          </div>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{summaryStats.noShowCancelled}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Non Booking</p>
          </div>
          <p className="text-2xl font-bold text-slate-500 mt-1">{summaryStats.nonBooking}</p>
        </div>
      </div>

      {/* Filters Row 1 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Record Date Range Filter */}
        <DateRangePicker
          label="Record Date"
          dateRange={recordDateRange}
          onDateRangeChange={setRecordDateRange}
        />

        {/* Move-In Date Range Filter */}
        <DateRangePicker
          label="Move-In Date"
          dateRange={moveInDateRange}
          onDateRangeChange={setMoveInDateRange}
        />

        {/* Import Batch Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Package className="w-4 h-4" />
              {getImportBatchLabel()}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => setImportBatchFilter('all')}
              className={importBatchFilter === 'all' ? 'bg-accent/20' : ''}
            >
              All Records
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setImportBatchFilter('manual')}
              className={importBatchFilter === 'manual' ? 'bg-accent/20' : ''}
            >
              Manual Entries ({manualRecordCount.toLocaleString()} records)
            </DropdownMenuItem>
            {importBatches.length > 0 && <DropdownMenuSeparator />}
            {importBatches.map((batch) => (
              <DropdownMenuItem
                key={batch.id}
                onClick={() => setImportBatchFilter(batch.id)}
                className={importBatchFilter === batch.id ? 'bg-accent/20' : ''}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{batch.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {batch.count.toLocaleString()} records • {format(new Date(batch.earliestDate), 'MMM d')} - {format(new Date(batch.latestDate), 'MMM d, yyyy')}
                  </span>
                </div>
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

        {/* Rebooking Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {rebookingFilterOptions.find(r => r.value === rebookingFilter)?.label}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {rebookingFilterOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setRebookingFilter(option.value as 'all' | 'new' | 'rebooking')}
                className={rebookingFilter === option.value ? 'bg-accent/20' : ''}
              >
                {option.label}
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

        {/* Items per page */}
        <Select value={String(itemsPerPage)} onValueChange={(v) => {
          setItemsPerPage(Number(v));
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>

        {/* Export CSV */}
        <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={records.length === 0}>
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
                <SortableHeader column="bookingDate" label="Record Date" />
                <SortableHeader column="moveInDate" label="Move-In Date" />
                <SortableHeader column="memberName" label="Contact" />
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                <SortableHeader column="market" label="Market" />
                <SortableHeader column="bookingType" label="Type" />
                <SortableHeader column="status" label="Status" />
                <SortableHeader column="communicationMethod" label="Method" />
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <TableSkeleton />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-muted-foreground">
                    No records found matching your filters
                  </td>
                </tr>
              ) : (
                records.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(booking.bookingDate, 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {booking.status === 'Non Booking' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        format(booking.moveInDate, 'MMM d, yyyy')
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      <ContactProfileHoverCard
                        memberName={booking.memberName}
                        callKeyPoints={booking.callKeyPoints}
                        transcriptionStatus={booking.transcriptionStatus}
                      >
                        <div className="flex items-center gap-2 cursor-default">
                          <span className="hover:text-primary transition-colors">{booking.memberName}</span>
                          {booking.isRebooking && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              <RotateCcw className="h-3 w-3" />
                              Rebooking
                            </span>
                          )}
                        </div>
                      </ContactProfileHoverCard>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {booking.contactEmail ? (
                        <a 
                          href={`mailto:${booking.contactEmail}`} 
                          className="text-primary hover:underline truncate max-w-[180px] block"
                          title={booking.contactEmail}
                        >
                          {booking.contactEmail}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {booking.contactPhone ? (
                        <a 
                          href={`tel:${booking.contactPhone}`} 
                          className="text-primary hover:underline whitespace-nowrap"
                        >
                          {formatPhone(booking.contactPhone)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                              booking.transcriptionStatus === 'failed' ? `Failed: ${booking.transcriptionErrorMessage || 'Unknown error'} - Click to retry` :
                              booking.transcriptionStatus === 'pending' ? 'Transcription pending...' :
                              'Transcribe Call'
                            }
                            className="hover:opacity-80 transition-opacity"
                          >
                            {booking.transcriptionStatus === 'completed' ? (
                              <FileText className="h-4 w-4 text-purple-500" />
                            ) : booking.transcriptionStatus === 'processing' ? (
                              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                            ) : booking.transcriptionStatus === 'failed' ? (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            ) : booking.transcriptionStatus === 'pending' ? (
                              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                            ) : (
                              <Headphones className="h-4 w-4 text-muted-foreground hover:text-purple-500 transition-colors" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {canEditBooking(booking.agentId) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateBooking(booking.id, { status: 'Moved In' });
                                toast.success('Status updated to Moved In');
                                refetch();
                              }}
                              className="text-green-600 focus:text-green-600"
                              disabled={booking.status === 'Moved In'}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Moved In
                              {booking.status === 'Moved In' && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateBooking(booking.id, { status: 'Postponed' });
                                toast.success('Status updated to Postponed');
                                refetch();
                              }}
                              className="text-primary focus:text-primary"
                              disabled={booking.status === 'Postponed'}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Mark as Postponed
                              {booking.status === 'Postponed' && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateBooking(booking.id, { status: 'No Show' });
                                toast.success('Status updated to No Show');
                                refetch();
                              }}
                              className="text-muted-foreground focus:text-muted-foreground"
                              disabled={booking.status === 'No Show'}
                            >
                              <CalendarX className="h-4 w-4 mr-2" />
                              Mark as No Show
                              {booking.status === 'No Show' && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateBooking(booking.id, { status: 'Member Rejected' });
                                toast.success('Status updated to Member Rejected');
                                refetch();
                              }}
                              className="text-destructive focus:text-destructive"
                              disabled={booking.status === 'Member Rejected'}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Mark as Rejected
                              {booking.status === 'Member Rejected' && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateBooking(booking.id, { status: 'Cancelled' });
                                toast.success('Status updated to Cancelled');
                                refetch();
                              }}
                              className="text-muted-foreground focus:text-muted-foreground"
                              disabled={booking.status === 'Cancelled'}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Mark as Cancelled
                              {booking.status === 'Cancelled' && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/edit-booking/${booking.id}`)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Full Details...
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            Showing {totalCount === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalCount)} of {totalCount.toLocaleString()} records
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1 || isLoading}
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
              disabled={currentPage >= totalPages || isLoading}
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
            // Background refresh
            refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}
