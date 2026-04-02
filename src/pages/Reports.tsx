import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useBookings } from '@/contexts/BookingsContext';
import { useReportsData, ReportsFilters, ReportsPagination, ReportsSorting, SortColumn, SortDirection } from '@/hooks/useReportsData';
import { Button } from '@/components/ui/button';
import { Download, Search, PlusCircle, Pencil, ChevronDown, Building2, User, MessageSquare, Tag, CheckCircle, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, X, ExternalLink, Phone, UserCircle, Headphones, FileText, Loader2, MoreHorizontal, Clock, CalendarX, XCircle, Ban, AlertTriangle, Package, FlaskConical, ShieldAlert, DollarSign, Timer, Video } from 'lucide-react';
import { ContactProfileHoverCard } from '@/components/reports/ContactProfileHoverCard';
import { FollowUpPriorityBadge } from '@/components/reports/FollowUpPriorityBadge';
import { calculateFollowUpPriority } from '@/utils/followUpPriority';
import { Input } from '@/components/ui/input';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TranscriptionModal } from '@/components/booking/TranscriptionModal';
import { Booking } from '@/types';
import { getAgentName } from '@/utils/agentUtils';
import { maskEmail, maskPhone, shouldMaskContactInfo } from '@/utils/contactPrivacy';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ChurnRiskBadge } from '@/components/reports/ChurnRiskBadge';
import { calculateChurnRisk } from '@/utils/churnPrediction';
import { useChurnPrediction } from '@/hooks/useChurnPrediction';
import { ISSUE_CATEGORIES, ISSUE_BADGE_CONFIG, normalizeDetectedIssues } from '@/utils/issueClassifier';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  { label: 'Research', value: 'Research' },
];

const bookingTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Inbound', value: 'Inbound' },
  { label: 'Outbound', value: 'Outbound' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Research', value: 'Research' },
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

const conversationFilterOptions = [
  { label: 'All Conversations', value: 'all' },
  { label: 'Valid Conversations', value: 'valid' },
  { label: 'No Conversation (Flagged)', value: 'no_conversation' },
];

// Duration formatter helper
const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

export default function Reports() {
  usePageTracking('view_reports');
  const { updateBooking } = useBookings();
  const { user } = useAuth();
  const { agents, isLoading: agentsLoading } = useAgents();
  const navigate = useNavigate();

  // Transcription modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Sites from Supabase
  const [sites, setSites] = useState<Site[]>([]);

  // View mode — drives entire page layout
  const [recordTypeFilter, setRecordTypeFilter] = useState<'booking' | 'research'>('booking');
  const isResearch = recordTypeFilter === 'research';

  // Filter states - date ranges (default to Today)
  const [recordDateRange, setRecordDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
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
  const [conversationFilter, setConversationFilter] = useState<'all' | 'valid' | 'no_conversation'>('all');
  const [issueFilter, setIssueFilter] = useState<string[]>([]);
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting (primary only for server-side)
  const [sortColumn, setSortColumn] = useState<SortColumn>('bookingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Reset booking-only filters when switching to research view
  const handleViewChange = (view: string) => {
    const newView = view as 'booking' | 'research';
    setRecordTypeFilter(newView);
    // Reset filters that don't apply to the new view
    setMoveInDateRange({ from: undefined, to: undefined });
    setStatusFilter('all');
    setTypeFilter('all');
    setMethodFilter('all');
    setRebookingFilter('all');
    setConversationFilter('all');
    setImportBatchFilter('all');
    setCampaignTypeFilter('all');
    setCurrentPage(1);
  };

  // Build filters object for hook
  const filters: ReportsFilters = useMemo(() => ({
    recordDateRange,
    moveInDateRange,
    importBatchFilter,
    recordTypeFilter,
    siteId: siteFilter,
    status: statusFilter,
    bookingType: typeFilter,
    communicationMethod: methodFilter,
    agentId: agentFilter,
    rebookingFilter,
    conversationFilter,
    issueFilter,
    campaignTypeFilter,
    searchQuery,
  }), [recordDateRange, moveInDateRange, importBatchFilter, recordTypeFilter, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, rebookingFilter, conversationFilter, issueFilter, campaignTypeFilter, searchQuery]);

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
    setConversationFilter('all');
    setIssueFilter([]);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    recordDateRange.from || recordDateRange.to ||
    moveInDateRange.from || moveInDateRange.to ||
    importBatchFilter !== 'all' ||
    siteFilter !== 'all' || statusFilter !== 'all' || 
    typeFilter !== 'all' || methodFilter !== 'all' || 
    agentFilter !== 'all' || rebookingFilter !== 'all' || 
    conversationFilter !== 'all' || issueFilter.length > 0 || campaignTypeFilter !== 'all' || searchQuery !== '';

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'bookingDate' || column === 'moveInDate' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change  
  useEffect(() => {
    setCurrentPage(1);
  }, [recordDateRange, moveInDateRange, importBatchFilter, recordTypeFilter, siteFilter, statusFilter, typeFilter, methodFilter, agentFilter, searchQuery, rebookingFilter, conversationFilter, issueFilter, campaignTypeFilter]);

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
      if (agentsLoading || agents.length === 0) return true;
      const agent = agents.find(a => a.id === bookingAgentId);
      return agent?.siteId === user.siteId;
    }
    if (user.role === 'agent') {
      if (agentsLoading || agents.length === 0) return true;
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

  // Export CSV — view-aware
  const exportCSV = () => {
    const shouldMask = shouldMaskContactInfo(user?.role);

    if (isResearch) {
      const headers = [
        'Call Date',
        'Campaign',
        'Contact Phone',
        'Contact Name',
        'Contact Email',
        'Duration',
        'Progress',
        'Video Interest',
        'Agent',
        'Market City',
        'Market State',
        'Transcription Status',
        'Detected Issues',
      ];
      const rows = records.map(booking => [
        format(booking.bookingDate, 'yyyy-MM-dd'),
        booking.researchCampaignType === 'audience_survey' ? 'Audience Survey' : 'Move-Out Survey',
        booking.contactPhone ? (shouldMask ? maskPhone(booking.contactPhone) : booking.contactPhone) : '',
        booking.memberName?.startsWith('API Submission') ? '' : booking.memberName,
        booking.contactEmail ? (shouldMask ? maskEmail(booking.contactEmail) : booking.contactEmail) : '',
        formatDuration(booking.callDurationSeconds),
        booking.questionsTotal ? `${booking.questionsAnswered || 0}/${booking.questionsTotal}` : '',
        booking.researchCampaignType === 'audience_survey' ? (booking.videoTestimonialInterest === true ? 'Yes' : booking.videoTestimonialInterest === false ? 'No' : '') : '',
        getAgentName(agents, booking.agentId),
        booking.marketCity || '',
        booking.marketState || '',
        booking.transcriptionStatus || '',
        booking.detectedIssues ? normalizeDetectedIssues(booking.detectedIssues).map(d => d.issue).join(', ') : '',
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `research-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } else {
      const headers = [
        'Record Date', 'Move-In Date', 'Contact Name', 'Contact Email', 'Contact Phone',
        'Agent', 'Market City', 'Market State', 'Booking Type', 'Status',
        'Communication Method', 'Notes', 'HubSpot Link', 'Kixie Link', 'Admin Profile Link', 'Detected Issues',
      ];
      const rows = records.map(booking => [
        format(booking.bookingDate, 'yyyy-MM-dd'),
        booking.status === 'Non Booking' ? '' : format(booking.moveInDate, 'yyyy-MM-dd'),
        booking.memberName,
        booking.contactEmail ? (shouldMask ? maskEmail(booking.contactEmail) : booking.contactEmail) : '',
        booking.contactPhone ? (shouldMask ? maskPhone(booking.contactPhone) : booking.contactPhone) : '',
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
        booking.detectedIssues ? normalizeDetectedIssues(booking.detectedIssues).map(d => d.issue).join(', ') : '',
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
    }
  };

  const statusColors: Record<string, string> = {
    'Pending Move-In': 'bg-warning/20 text-warning',
    'Moved In': 'bg-success/20 text-success',
    'Member Rejected': 'bg-destructive/20 text-destructive',
    'No Show': 'bg-muted text-muted-foreground',
    'Cancelled': 'bg-muted text-muted-foreground',
    'Postponed': 'bg-primary/20 text-primary',
    'Non Booking': 'bg-slate-500/20 text-slate-500',
    'Research': 'bg-purple-500/20 text-purple-500',
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

  // Summary statistics
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
    const issuesDetected = records.filter(b => b.detectedIssues && normalizeDetectedIssues(b.detectedIssues).length > 0).length;
    
    // Research-specific stats
    const successfulCalls = records.filter(b => b.hasValidConversation !== false && (b.callDurationSeconds || 0) >= 120).length;
    const totalDuration = records.reduce((sum, b) => sum + (b.callDurationSeconds || 0), 0);
    const avgDuration = records.length > 0 ? Math.round(totalDuration / records.length) : 0;
    
    return { total, pendingMoveIn, movedIn, memberRejected, noShowCancelled, postponed, nonBooking, rebookings, newBookings, issuesDetected, successfulCalls, avgDuration };
  }, [totalCount, records]);

  // Loading skeleton for table rows
  const TableSkeleton = () => (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: isResearch ? 12 : 15 }).map((_, j) => (
            <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
          ))}
        </tr>
      ))}
    </>
  );

  return (
    <DashboardLayout 
      title="Reports" 
      subtitle="Detailed call records and exports"
    >
      {/* View Toggle */}
      <Tabs value={recordTypeFilter} onValueChange={handleViewChange} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="booking" className="gap-2">
            <Building2 className="h-4 w-4" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Research
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards — Bookings View */}
      {!isResearch && (
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
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Issues Detected</p>
            </div>
            <p className="text-2xl font-bold text-amber-500 mt-1">{summaryStats.issuesDetected}</p>
            {!isLoading && records.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                of {records.length} shown
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards — Research View */}
      {isResearch && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Calls</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.total.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Successful Calls</p>
            </div>
            <p className="text-2xl font-bold text-success mt-1">{summaryStats.successfulCalls}</p>
            <p className="text-xs text-muted-foreground mt-1">valid + ≥2min</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Duration</p>
            </div>
            <p className="text-2xl font-bold text-primary mt-1">{formatDuration(summaryStats.avgDuration)}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Issues Detected</p>
            </div>
            <p className="text-2xl font-bold text-amber-500 mt-1">{summaryStats.issuesDetected}</p>
            {!isLoading && records.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                of {records.length} shown
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters Row 1 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Record Date Range Filter — both views */}
        <DateRangePicker
          label={isResearch ? "Call Date" : "Record Date"}
          dateRange={recordDateRange}
          onDateRangeChange={setRecordDateRange}
        />

        {/* Move-In Date Range Filter — bookings only */}
        {!isResearch && (
          <DateRangePicker
            label="Move-In Date"
            dateRange={moveInDateRange}
            onDateRangeChange={setMoveInDateRange}
          />
        )}

        {/* Import Batch Filter — bookings only */}
        {!isResearch && (
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
        )}

        {/* Site Filter — both views */}
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

        {/* Campaign Type Filter — research only */}
        {isResearch && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={campaignTypeFilter !== 'all' ? 'default' : 'outline'} className="gap-2">
                <FlaskConical className="w-4 h-4" />
                {campaignTypeFilter === 'all' ? 'All Campaigns' : campaignTypeFilter === 'move_out_survey' ? 'Move-Out Survey' : 'Audience Survey'}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem
                onClick={() => setCampaignTypeFilter('all')}
                className={campaignTypeFilter === 'all' ? 'bg-accent/20' : ''}
              >
                All Campaigns
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCampaignTypeFilter('move_out_survey')}
                className={campaignTypeFilter === 'move_out_survey' ? 'bg-accent/20' : ''}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Move-Out Survey
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCampaignTypeFilter('audience_survey')}
                className={campaignTypeFilter === 'audience_survey' ? 'bg-accent/20' : ''}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Audience Survey
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isResearch && (
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
        )}

        {/* Booking Type Filter — bookings only */}
        {!isResearch && (
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
        )}

        {/* Communication Method Filter — bookings only */}
        {!isResearch && (
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
        )}

        {/* Agent Filter — both views */}
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

        {/* Rebooking Filter — bookings only */}
        {!isResearch && (
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
        )}

        {/* Conversation Validity Filter — bookings only */}
        {!isResearch && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={conversationFilter === 'no_conversation' ? 'destructive' : 'outline'} className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                {conversationFilterOptions.find(c => c.value === conversationFilter)?.label}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {conversationFilterOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setConversationFilter(option.value as 'all' | 'valid' | 'no_conversation')}
                  className={conversationFilter === option.value ? 'bg-accent/20' : ''}
                >
                  {option.value === 'no_conversation' && (
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                  )}
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Pain Point Issues Filter — both views */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={issueFilter.length > 0 ? 'default' : 'outline'} className="gap-2">
              <ShieldAlert className="w-4 h-4" />
              {issueFilter.length > 0 ? `Issues (${issueFilter.length})` : 'Pain Point Issues'}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => setIssueFilter([])}
              className={issueFilter.length === 0 ? 'bg-accent/20' : ''}
            >
              All Records
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {ISSUE_CATEGORIES.map((category) => (
              <DropdownMenuItem
                key={category}
                onClick={() => {
                  setIssueFilter(prev =>
                    prev.includes(category)
                      ? prev.filter(c => c !== category)
                      : [...prev, category]
                  );
                }}
                className={issueFilter.includes(category) ? 'bg-accent/20' : ''}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`w-2 h-2 rounded-full ${ISSUE_BADGE_CONFIG[category]?.color.split(' ')[0] || 'bg-muted'}`}></span>
                  <span className="flex-1 text-sm">{category}</span>
                  {issueFilter.includes(category) && <CheckCircle className="w-3 h-3" />}
                </div>
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
            placeholder={isResearch ? "Search by contact, agent, market..." : "Search by member, agent, market..."} 
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

        {/* Add Booking — bookings view only */}
        {!isResearch && (
          <Button className="gap-2" onClick={() => navigate('/add-booking')}>
            <PlusCircle className="w-4 h-4" />
            Add Booking
          </Button>
        )}
      </div>

      {/* Data Table */}
      <TooltipProvider>
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {isResearch ? (
                  <>
                    <SortableHeader column="bookingDate" label="Call Date" />
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaign</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                    <SortableHeader column="memberName" label="Name" />
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />Video</div>
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                    <SortableHeader column="market" label="Market" />
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transcription</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issues</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </>
                ) : (
                  <>
                    <SortableHeader column="bookingDate" label="Record Date" />
                    <SortableHeader column="moveInDate" label="Move-In Date" />
                    <SortableHeader column="memberName" label="Contact" />
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                    <SortableHeader column="market" label="Market" />
                    <SortableHeader column="bookingType" label="Type" />
                    <SortableHeader column="status" label="Status" />
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Churn Risk</th>
                    <SortableHeader column="communicationMethod" label="Method" />
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issues</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <TableSkeleton />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={isResearch ? 12 : 15} className="py-8 text-center text-muted-foreground">
                    No records found matching your filters
                  </td>
                </tr>
              ) : isResearch ? (
                /* ===== RESEARCH VIEW ROWS ===== */
                records.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                    {/* Call Date */}
                    <td className="py-3 px-4 text-sm text-foreground">
                      <div className="flex items-center gap-1.5">
                        {format(booking.bookingDate, 'MMM d, yyyy')}
                        {(() => {
                          const issues = normalizeDetectedIssues(booking.detectedIssues);
                          return issues.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-0.5 cursor-help text-amber-500">
                                  <ShieldAlert className="h-4 w-4" />
                                  {issues.length > 1 && <span className="text-[10px] font-bold">{issues.length}</span>}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-sm">
                                <p className="font-semibold mb-1">{issues.length} Issue{issues.length > 1 ? 's' : ''} Detected</p>
                                <div className="text-xs space-y-2">
                                  {issues.map((detail, i) => (
                                    <div key={i}>
                                      <p className="font-medium">• {detail.issue}</p>
                                      {detail.matchingConcerns.length > 0 && (
                                        <div className="ml-3 mt-0.5 text-muted-foreground">
                                          {detail.matchingConcerns.map((c, j) => (
                                            <p key={j} className="italic">"{c}"</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
                    </td>
                    {/* Campaign */}
                    <td className="py-3 px-4 text-sm">
                      {booking.researchCampaignType === 'audience_survey' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Audience
                          {(booking.questionsAnswered || 0) < 3 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-3 w-3 text-amber-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="text-xs font-medium">Thin Data</p>
                                <p className="text-xs text-muted-foreground">Only {booking.questionsAnswered || 0} questions answered</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                          Move-Out
                        </span>
                      )}
                    </td>
                    {/* Contact (phone-first) */}
                    <td className="py-3 px-4 text-sm text-foreground">
                      {booking.contactPhone ? (
                        shouldMaskContactInfo(user?.role) ? (
                          <span className="text-muted-foreground whitespace-nowrap">{maskPhone(booking.contactPhone)}</span>
                        ) : (
                          <a href={`tel:${booking.contactPhone}`} className="text-primary hover:underline whitespace-nowrap">
                            {formatPhone(booking.contactPhone)}
                          </a>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Name (enriched only) */}
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {booking.memberName?.startsWith('API Submission') ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ContactProfileHoverCard
                          memberName={booking.memberName}
                          callKeyPoints={booking.callKeyPoints}
                          callSummary={booking.callSummary}
                          transcriptionStatus={booking.transcriptionStatus}
                          contactEmail={booking.contactEmail || undefined}
                          contactPhone={booking.contactPhone || undefined}
                          bookingId={booking.id}
                          shouldMaskContact={shouldMaskContactInfo(user?.role)}
                          bookingStatus={booking.status}
                          moveInDate={booking.moveInDate}
                          bookingDate={booking.bookingDate}
                          marketCity={booking.marketCity || undefined}
                          marketState={booking.marketState || undefined}
                          emailVerificationStatus={booking.emailVerificationStatus}
                          emailVerified={booking.emailVerified}
                        >
                          <span className="hover:text-primary transition-colors cursor-default">{booking.memberName}</span>
                        </ContactProfileHoverCard>
                      )}
                    </td>
                    {/* Email */}
                    <td className="py-3 px-4 text-sm">
                      {booking.contactEmail ? (
                        shouldMaskContactInfo(user?.role) ? (
                          <span className="text-muted-foreground truncate max-w-[180px] block">{maskEmail(booking.contactEmail)}</span>
                        ) : (
                          <a href={`mailto:${booking.contactEmail}`} className="text-primary hover:underline truncate max-w-[180px] block" title={booking.contactEmail}>
                            {booking.contactEmail}
                          </a>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Duration */}
                    <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5" />
                        {formatDuration(booking.callDurationSeconds)}
                      </div>
                    </td>
                    {/* Survey Progress */}
                    <td className="py-3 px-4 text-sm">
                      {booking.questionsTotal != null && booking.questionsTotal > 0 ? (
                        <div className="flex flex-col gap-1 min-w-[60px]">
                          <span className={cn(
                            "font-medium text-xs",
                            booking.questionsAnswered === booking.questionsTotal ? "text-green-600 dark:text-green-400" :
                            (booking.questionsAnswered || 0) / booking.questionsTotal >= 0.5 ? "text-amber-600 dark:text-amber-400" :
                            "text-red-600 dark:text-red-400"
                          )}>
                            {booking.questionsAnswered || 0}/{booking.questionsTotal}
                          </span>
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                booking.questionsAnswered === booking.questionsTotal ? "bg-green-500" :
                                (booking.questionsAnswered || 0) / booking.questionsTotal >= 0.5 ? "bg-amber-500" :
                                "bg-red-500"
                              )}
                              style={{ width: `${Math.round(((booking.questionsAnswered || 0) / booking.questionsTotal) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    {/* Video Testimonial Interest */}
                    <td className="py-3 px-4 text-sm text-center">
                      {booking.researchCampaignType === 'audience_survey' ? (
                        booking.videoTestimonialInterest === true ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : booking.videoTestimonialInterest === false ? (
                          <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Agent */}
                    <td className="py-3 px-4 text-sm text-foreground">
                      {getAgentName(agents, booking.agentId)}
                    </td>
                    {/* Market */}
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {booking.marketCity && booking.marketState ? `${booking.marketCity}, ${booking.marketState}` : booking.marketCity || booking.marketState || '—'}
                    </td>
                    {/* Transcription Status */}
                    <td className="py-3 px-4">
                      {booking.kixieLink ? (
                        <span
                          title={
                            booking.transcriptionStatus === 'completed' ? 'Transcription completed' :
                            booking.transcriptionStatus === 'processing' ? 'Transcription in progress...' :
                            booking.transcriptionStatus === 'failed' ? `Failed: ${booking.transcriptionErrorMessage || 'Unknown error'}` :
                            booking.transcriptionStatus === 'pending' ? 'Transcription pending...' :
                            'Not transcribed'
                          }
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
                            <Headphones className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    {/* Issues */}
                    <td className="py-3 px-4">
                      {(() => {
                        const issues = normalizeDetectedIssues(booking.detectedIssues);
                        return issues.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {issues.map((detail) => {
                              const config = ISSUE_BADGE_CONFIG[detail.issue];
                              return (
                                <Tooltip key={detail.issue}>
                                  <TooltipTrigger asChild>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-help ${config?.color || 'bg-muted text-muted-foreground border-border'}`}>
                                      {detail.issue.split(' ')[0]}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="font-semibold text-xs">{detail.issue}</p>
                                    {detail.matchingConcerns.length > 0 && (
                                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                        {detail.matchingConcerns.map((c, j) => (
                                          <p key={j} className="italic">"{c}"</p>
                                        ))}
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        );
                      })()}
                    </td>
                    {/* Actions — research: view transcript only */}
                    <td className="py-3 px-4">
                      {booking.kixieLink && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowTranscriptModal(true);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Transcript
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                /* ===== BOOKINGS VIEW ROWS ===== */
                records.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      <div className="flex items-center gap-1.5">
                        {format(booking.bookingDate, 'MMM d, yyyy')}
                        {booking.callKeyPoints?.pricingDiscussed?.mentioned === false && booking.transcriptionStatus === 'completed' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center cursor-help text-warning">
                                <DollarSign className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="font-semibold text-xs">Pricing Not Discussed</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Agent did not cover pricing on this call.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {(() => {
                          const issues = normalizeDetectedIssues(booking.detectedIssues);
                          return issues.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                "inline-flex items-center gap-0.5 cursor-help",
                                issues.length === 1
                                  ? ISSUE_BADGE_CONFIG[issues[0].issue]?.color.split(' ')[1] || 'text-amber-500'
                                  : 'text-amber-500'
                              )}>
                                <ShieldAlert className="h-4 w-4" />
                                {issues.length > 1 && (
                                  <span className="text-[10px] font-bold">{issues.length}</span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-sm">
                              <p className="font-semibold mb-1">{issues.length} Issue{issues.length > 1 ? 's' : ''} Detected</p>
                              <div className="text-xs space-y-2">
                                {issues.map((detail, i) => (
                                  <div key={i}>
                                    <p className="font-medium">• {detail.issue}</p>
                                    {detail.matchingConcerns.length > 0 && (
                                      <div className="ml-3 mt-0.5 text-muted-foreground">
                                        {detail.matchingConcerns.map((c, j) => (
                                          <p key={j} className="italic">"{c}"</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                        })()}
                      </div>
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
                        callSummary={booking.callSummary}
                        transcriptionStatus={booking.transcriptionStatus}
                        contactEmail={booking.contactEmail || undefined}
                        contactPhone={booking.contactPhone || undefined}
                        bookingId={booking.id}
                        shouldMaskContact={shouldMaskContactInfo(user?.role)}
                        bookingStatus={booking.status}
                        moveInDate={booking.moveInDate}
                        bookingDate={booking.bookingDate}
                        marketCity={booking.marketCity || undefined}
                        marketState={booking.marketState || undefined}
                        emailVerificationStatus={booking.emailVerificationStatus}
                        emailVerified={booking.emailVerified}
                      >
                        <div className="flex items-center gap-2 cursor-default">
                          {booking.hasValidConversation === false && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="font-medium">No Real Conversation</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  This call was a voicemail or failed connection - no actual conversation took place.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <span className="hover:text-primary transition-colors">
                            {booking.memberName}
                          </span>
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
                        shouldMaskContactInfo(user?.role) ? (
                          <span className="text-muted-foreground truncate max-w-[180px] block">
                            {maskEmail(booking.contactEmail)}
                          </span>
                        ) : (
                          <a 
                            href={`mailto:${booking.contactEmail}`} 
                            className="text-primary hover:underline truncate max-w-[180px] block"
                            title={booking.contactEmail}
                          >
                            {booking.contactEmail}
                          </a>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {booking.contactPhone ? (
                        shouldMaskContactInfo(user?.role) ? (
                          <span className="text-muted-foreground whitespace-nowrap">
                            {maskPhone(booking.contactPhone)}
                          </span>
                        ) : (
                          <a 
                            href={`tel:${booking.contactPhone}`} 
                            className="text-primary hover:underline whitespace-nowrap"
                          >
                            {formatPhone(booking.contactPhone)}
                          </a>
                        )
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
                    <td className="py-3 px-4">
                      <FollowUpPriorityBadge 
                        priority={calculateFollowUpPriority(
                          {
                            status: booking.status,
                            moveInDate: booking.moveInDate,
                            bookingDate: booking.bookingDate,
                            callKeyPoints: booking.callKeyPoints,
                            transcriptionStatus: booking.transcriptionStatus,
                          },
                          null
                        )}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      {booking.status === 'Pending Move-In' ? (
                        <ChurnRiskBadge
                          risk={calculateChurnRisk({
                            callDurationSeconds: booking.callDurationSeconds || null,
                            bookingDate: booking.bookingDate instanceof Date ? booking.bookingDate.toISOString() : String(booking.bookingDate),
                            moveInDate: booking.moveInDate instanceof Date ? booking.moveInDate.toISOString() : String(booking.moveInDate),
                            communicationMethod: booking.communicationMethod || null,
                            transcription: booking.callKeyPoints ? (typeof booking.callKeyPoints === 'string' ? JSON.parse(booking.callKeyPoints) : booking.callKeyPoints) : null,
                          })}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {booking.communicationMethod}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const issues = normalizeDetectedIssues(booking.detectedIssues);
                        return issues.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {issues.map((detail) => {
                            const config = ISSUE_BADGE_CONFIG[detail.issue];
                            return (
                              <Tooltip key={detail.issue}>
                                <TooltipTrigger asChild>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-help ${config?.color || 'bg-muted text-muted-foreground border-border'}`}
                                  >
                                    {detail.issue.split(' ')[0]}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-semibold text-xs">{detail.issue}</p>
                                  {detail.matchingConcerns.length > 0 && (
                                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                      {detail.matchingConcerns.map((c, j) => (
                                        <p key={j} className="italic">"{c}"</p>
                                      ))}
                                    </div>
                                  )}
                                  {detail.matchingKeywords.length > 0 && (
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                      Keywords: {detail.matchingKeywords.join(', ')}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      );
                      })()}
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
                        {booking.kixieLink && (
                          <button
                            onClick={() => {
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
                                try {
                                  await updateBooking(booking.id, { status: 'Pending Move-In' });
                                  toast.success('Status updated to Pending Move-In');
                                  refetch();
                                } catch (error) {
                                  console.error('Error updating booking:', error);
                                  toast.error('Failed to update status. You may not have permission to edit this booking.');
                                }
                              }}
                              className="text-yellow-600 focus:text-yellow-600"
                              disabled={booking.status === 'Pending Move-In'}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Mark as Pending Move-In
                              {booking.status === 'Pending Move-In' && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await updateBooking(booking.id, { status: 'Moved In' });
                                  toast.success('Status updated to Moved In');
                                  refetch();
                                } catch (error) {
                                  console.error('Error updating booking:', error);
                                  toast.error('Failed to update status. You may not have permission to edit this booking.');
                                }
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
                                try {
                                  await updateBooking(booking.id, { status: 'Postponed' });
                                  toast.success('Status updated to Postponed');
                                  refetch();
                                } catch (error) {
                                  console.error('Error updating booking:', error);
                                  toast.error('Failed to update status. You may not have permission to edit this booking.');
                                }
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
                                try {
                                  await updateBooking(booking.id, { status: 'No Show' });
                                  toast.success('Status updated to No Show');
                                  refetch();
                                } catch (error) {
                                  console.error('Error updating booking:', error);
                                  toast.error('Failed to update status. You may not have permission to edit this booking.');
                                }
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
                                try {
                                  await updateBooking(booking.id, { status: 'Member Rejected' });
                                  toast.success('Status updated to Member Rejected');
                                  refetch();
                                } catch (error) {
                                  console.error('Error updating booking:', error);
                                  toast.error('Failed to update status. You may not have permission to edit this booking.');
                                }
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
                                try {
                                  await updateBooking(booking.id, { status: 'Cancelled' });
                                  toast.success('Status updated to Cancelled');
                                  refetch();
                                } catch (error) {
                                  console.error('Error updating booking:', error);
                                  toast.error('Failed to update status. You may not have permission to edit this booking.');
                                }
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
            Showing {totalCount === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalCount)} of {totalCount.toLocaleString()} {isResearch ? 'calls' : 'records'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      </div>
      </TooltipProvider>

      {/* Transcription Modal */}
      {selectedBooking && (
        <TranscriptionModal
          booking={selectedBooking}
          isOpen={showTranscriptModal}
          onClose={() => {
            setShowTranscriptModal(false);
            refetch();
          }}
          onTranscriptionComplete={refetch}
        />
      )}
    </DashboardLayout>
  );
}
