import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useBookings } from '@/contexts/BookingsContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { BroadcastBanner } from '@/components/broadcast/BroadcastBanner';
import { ContactProfileHoverCard } from '@/components/reports/ContactProfileHoverCard';
import { shouldMaskContactInfo } from '@/utils/contactPrivacy';
import { Button } from '@/components/ui/button';
import { Search, PlusCircle, MoreHorizontal, Clock, CheckCircle, CalendarX, XCircle, Ban, ExternalLink, Phone, UserCircle, Headphones, FileText, Loader2, RotateCcw, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TranscriptionModal } from '@/components/booking/TranscriptionModal';
import { BookingEditReasonDialog } from '@/components/booking/BookingEditReasonDialog';
import { BookingHistoryTimeline } from '@/components/booking/BookingHistoryTimeline';
import { Booking } from '@/types';
import { getAgentName } from '@/utils/agentUtils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { Skeleton } from '@/components/ui/skeleton';

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
];

export default function MyBookings() {
  usePageTracking('view_my_bookings');
  const { bookings, isLoading, updateBooking } = useBookings();
  const { user } = useAuth();
  const { agents } = useAgents();
  const navigate = useNavigate();

  // Transcription modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Edit reason dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    bookingId: string;
    newStatus: string;
    memberName: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History sheet state
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historyBooking, setHistoryBooking] = useState<Booking | null>(null);

  // Filter states
  const [bookingDateRange, setBookingDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get the agent record for the current user
  const myAgent = useMemo(() => {
    if (!user) return null;
    return agents.find(a => a.userId === user.id);
  }, [agents, user]);

  // Filter bookings to only show agent's own bookings
  const myBookings = useMemo(() => {
    if (!myAgent) return [];
    return bookings.filter(booking => booking.agentId === myAgent.id);
  }, [bookings, myAgent]);

  // Apply filters
  const filteredBookings = useMemo(() => {
    return myBookings.filter(booking => {
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

      // Status filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesMember = booking.memberName.toLowerCase().includes(query);
        const matchesCity = booking.marketCity?.toLowerCase().includes(query);
        const matchesState = booking.marketState?.toLowerCase().includes(query);
        if (!matchesMember && !matchesCity && !matchesState) return false;
      }

      return true;
    });
  }, [myBookings, bookingDateRange, statusFilter, searchQuery]);

  // Sort by booking date descending
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => 
      new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );
  }, [filteredBookings]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const total = filteredBookings.length;
    const newBookings = filteredBookings.filter(b => !b.isRebooking).length;
    const rebookings = filteredBookings.filter(b => b.isRebooking).length;
    const pendingMoveIn = filteredBookings.filter(b => b.status === 'Pending Move-In').length;
    const movedIn = filteredBookings.filter(b => b.status === 'Moved In').length;
    const postponed = filteredBookings.filter(b => b.status === 'Postponed').length;
    const noShowCancelled = filteredBookings.filter(b => b.status === 'No Show' || b.status === 'Cancelled' || b.status === 'Member Rejected').length;
    
    return { total, newBookings, rebookings, pendingMoveIn, movedIn, postponed, noShowCancelled };
  }, [filteredBookings]);

  const statusColors: Record<string, string> = {
    'Pending Move-In': 'bg-warning/20 text-warning',
    'Moved In': 'bg-success/20 text-success',
    'Member Rejected': 'bg-destructive/20 text-destructive',
    'No Show': 'bg-muted text-muted-foreground',
    'Cancelled': 'bg-muted text-muted-foreground',
    'Postponed': 'bg-primary/20 text-primary',
  };

  const handleStatusChangeRequest = (booking: Booking, newStatus: string) => {
    setPendingStatusChange({
      bookingId: booking.id,
      newStatus,
      memberName: booking.memberName,
    });
    setEditDialogOpen(true);
  };

  const handleStatusChangeConfirm = async (reason: string, newMoveInDate?: Date) => {
    if (!pendingStatusChange || !user || !myAgent) return;

    setIsSubmitting(true);
    try {
      const booking = bookings.find(b => b.id === pendingStatusChange.bookingId);
      if (!booking) throw new Error('Booking not found');

      // Prepare update data
      const updates: Partial<Booking> = {
        status: pendingStatusChange.newStatus as Booking['status'],
      };

      if (newMoveInDate) {
        updates.moveInDate = newMoveInDate;
        updates.isRebooking = true;
        updates.originalBookingId = booking.originalBookingId || booking.id;
      }

      // Log the edit
      const { error: logError } = await supabase.from('booking_edit_logs').insert({
        booking_id: pendingStatusChange.bookingId,
        agent_id: myAgent.id,
        user_id: user.id,
        user_name: user.name,
        field_changed: 'status',
        old_value: booking.status,
        new_value: pendingStatusChange.newStatus,
        edit_reason: reason,
      });

      if (logError) {
        console.error('Error logging edit:', logError);
        // Continue with update even if logging fails
      }

      // Update the booking
      await updateBooking(pendingStatusChange.bookingId, updates);

      toast.success(`Status updated to "${pendingStatusChange.newStatus}"`);
      setEditDialogOpen(false);
      setPendingStatusChange(null);
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewInsights = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowTranscriptModal(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout 
        title="My Bookings" 
        subtitle="Manage and follow up on your bookings"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!myAgent) {
    return (
      <DashboardLayout 
        title="My Bookings" 
        subtitle="Manage and follow up on your bookings"
      >
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Agent Profile Not Found</h3>
          <p className="text-muted-foreground max-w-md">
            Your user account is not linked to an agent profile. Please contact your supervisor or admin.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="My Bookings" 
      subtitle="Manage and follow up on your bookings"
    >
      <BroadcastBanner />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {summaryStats.newBookings} new • {summaryStats.rebookings} rebooks
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">New</p>
          </div>
          <p className="text-2xl font-bold text-accent mt-1">{summaryStats.newBookings}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-3 h-3 text-primary" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rebooks</p>
          </div>
          <p className="text-2xl font-bold text-primary mt-1">{summaryStats.rebookings}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
          </div>
          <p className="text-2xl font-bold text-warning mt-1">{summaryStats.pendingMoveIn}</p>
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
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Postponed</p>
          </div>
          <p className="text-2xl font-bold text-primary mt-1">{summaryStats.postponed}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Other</p>
          </div>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{summaryStats.noShowCancelled}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DateRangePicker
          dateRange={bookingDateRange}
          onDateRangeChange={setBookingDateRange}
          label="Booking Date"
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {statusOptions.find(s => s.value === statusFilter)?.label || 'All Statuses'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover">
            {statusOptions.map(option => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={cn(statusFilter === option.value && 'bg-accent')}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by member name or market..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button onClick={() => navigate('/add-booking')} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Add Booking
        </Button>
      </div>

      {/* Bookings Table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Move-In Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No bookings found
                  </td>
                </tr>
              ) : (
                sortedBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(new Date(booking.bookingDate), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {format(new Date(booking.moveInDate), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4">
                      <ContactProfileHoverCard
                        memberName={booking.memberName}
                        callKeyPoints={booking.callKeyPoints}
                        transcriptionStatus={booking.transcriptionStatus}
                        contactEmail={booking.contactEmail || undefined}
                        contactPhone={booking.contactPhone || undefined}
                        bookingId={booking.id}
                        shouldMaskContact={shouldMaskContactInfo(user?.role)}
                        emailVerificationStatus={booking.emailVerificationStatus}
                        emailVerified={booking.emailVerified}
                      >
                        <div className="flex items-center gap-2 cursor-default">
                          <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                            {booking.memberName}
                          </span>
                          {booking.isRebooking && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary">
                              <RotateCcw className="w-3 h-3" />
                              Rebooking
                            </span>
                          )}
                        </div>
                      </ContactProfileHoverCard>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {booking.marketCity}{booking.marketCity && booking.marketState && ', '}{booking.marketState}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        statusColors[booking.status] || 'bg-muted text-muted-foreground'
                      )}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {booking.hubspotLink && (
                          <a href={booking.hubspotLink} target="_blank" rel="noopener noreferrer" title="HubSpot">
                            <ExternalLink className="w-4 h-4 text-orange-500 hover:text-orange-600" />
                          </a>
                        )}
                        {booking.kixieLink && (
                          <a href={booking.kixieLink} target="_blank" rel="noopener noreferrer" title="Kixie">
                            <Phone className="w-4 h-4 text-success hover:opacity-80" />
                          </a>
                        )}
                        {booking.adminProfileLink && (
                          <a href={booking.adminProfileLink} target="_blank" rel="noopener noreferrer" title="Admin Profile">
                            <UserCircle className="w-4 h-4 text-primary hover:opacity-80" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {booking.kixieLink ? (
                        booking.transcriptionStatus === 'processing' ? (
                          <Loader2 className="w-4 h-4 text-warning animate-spin" />
                        ) : booking.transcriptionStatus === 'completed' ? (
                          <button
                            onClick={() => handleViewInsights(booking)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="View Call Insights"
                          >
                            <FileText className="w-4 h-4 text-primary" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleViewInsights(booking)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="View Call Insights"
                          >
                            <Headphones className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleStatusChangeRequest(booking, 'Moved In')}>
                            <CheckCircle className="w-4 h-4 mr-2 text-success" />
                            Mark as Moved In
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChangeRequest(booking, 'Postponed')}>
                            <Clock className="w-4 h-4 mr-2 text-primary" />
                            Mark as Postponed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChangeRequest(booking, 'No Show')}>
                            <CalendarX className="w-4 h-4 mr-2 text-muted-foreground" />
                            Mark as No Show
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChangeRequest(booking, 'Member Rejected')}>
                            <XCircle className="w-4 h-4 mr-2 text-destructive" />
                            Mark as Member Rejected
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChangeRequest(booking, 'Cancelled')}>
                            <Ban className="w-4 h-4 mr-2 text-muted-foreground" />
                            Mark as Cancelled
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setHistoryBooking(booking);
                            setHistorySheetOpen(true);
                          }}>
                            <History className="w-4 h-4 mr-2 text-primary" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/edit-booking/${booking.id}`)}>
                            Edit Full Details...
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Reason Dialog */}
      {pendingStatusChange && (
        <BookingEditReasonDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          newStatus={pendingStatusChange.newStatus}
          memberName={pendingStatusChange.memberName}
          onConfirm={handleStatusChangeConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Transcription Modal */}
      {selectedBooking && (
        <TranscriptionModal
          booking={selectedBooking}
          isOpen={showTranscriptModal}
          onClose={() => setShowTranscriptModal(false)}
          onTranscriptionComplete={() => {}}
        />
      )}

      {/* History Sheet */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Booking History
            </SheetTitle>
          </SheetHeader>
          {historyBooking && (
            <div className="mt-6">
              <div className="mb-4 p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground">{historyBooking.memberName}</p>
                <p className="text-xs text-muted-foreground">
                  Booked {format(new Date(historyBooking.bookingDate), 'MMM d, yyyy')}
                </p>
              </div>
              <BookingHistoryTimeline
                bookingId={historyBooking.id}
                bookingCreatedAt={historyBooking.createdAt}
                initialStatus="Pending Move-In"
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}