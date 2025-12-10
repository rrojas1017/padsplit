import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBookings } from '@/contexts/BookingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { Booking } from '@/types';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Save, ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CallInsights } from '@/components/booking/CallInsights';

const bookingTypes: Booking['bookingType'][] = ['Inbound', 'Outbound', 'Referral'];
const statuses: Booking['status'][] = ['Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled', 'Postponed'];
const commMethods: Booking['communicationMethod'][] = ['Phone', 'SMS', 'LC', 'Email'];

export default function EditBooking() {
  usePageTracking('view_edit_booking');
  const { id } = useParams<{ id: string }>();
  const { bookings, updateBooking, isLoading: bookingsLoading, refreshBookings } = useBookings();
  const { user } = useAuth();
  const { agents } = useAgents();
  const navigate = useNavigate();

  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [moveInDate, setMoveInDate] = useState<Date | undefined>();
  const [memberName, setMemberName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [marketCity, setMarketCity] = useState('');
  const [marketState, setMarketState] = useState('');
  const [bookingType, setBookingType] = useState<Booking['bookingType']>('Inbound');
  const [status, setStatus] = useState<Booking['status']>('Pending Move-In');
  const [communicationMethod, setCommunicationMethod] = useState<Booking['communicationMethod']>('Phone');
  const [notes, setNotes] = useState('');
  const [hubspotLink, setHubspotLink] = useState('');
  const [kixieLink, setKixieLink] = useState('');
  const [adminProfileLink, setAdminProfileLink] = useState('');
  const [moveInDayReachOut, setMoveInDayReachOut] = useState(false);
  const [isRebooking, setIsRebooking] = useState(false);
  const [originalBookingId, setOriginalBookingId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find the booking
  const booking = bookings.find(b => b.id === id);

  // Check if user can edit this booking
  const canEdit = (() => {
    if (!user || !booking) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (user.role === 'supervisor') {
      const agent = agents.find(a => a.id === booking.agentId);
      return agent?.siteId === user.siteId;
    }
    if (user.role === 'agent') {
      const agent = agents.find(a => a.id === booking.agentId);
      return agent?.userId === user.id;
    }
    return false;
  })();

  // Filter agents based on user role
  const availableAgents = (() => {
    if (user?.role === 'agent') {
      return agents.filter(a => a.userId === user.id && a.active);
    } else if (user?.role === 'supervisor' && user.siteId) {
      return agents.filter(a => a.siteId === user.siteId && a.active);
    } else {
      return agents.filter(a => a.active);
    }
  })();

  // Load booking data into form
  useEffect(() => {
    if (booking) {
      setBookingDate(booking.bookingDate);
      setMoveInDate(booking.moveInDate);
      setMemberName(booking.memberName);
      setAgentId(booking.agentId);
      setMarketCity(booking.marketCity);
      setMarketState(booking.marketState);
      setBookingType(booking.bookingType);
      setStatus(booking.status);
      setCommunicationMethod(booking.communicationMethod);
      setNotes(booking.notes || '');
      setHubspotLink(booking.hubspotLink || '');
      setKixieLink(booking.kixieLink || '');
      setAdminProfileLink(booking.adminProfileLink || '');
      setMoveInDayReachOut(booking.moveInDayReachOut || false);
      setIsRebooking(booking.isRebooking || false);
      setOriginalBookingId(booking.originalBookingId || undefined);
    }
  }, [booking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    if (!memberName.trim()) {
      toast({ title: 'Error', description: 'Member name is required', variant: 'destructive' });
      return;
    }
    if (!agentId) {
      toast({ title: 'Error', description: 'Please select an agent', variant: 'destructive' });
      return;
    }
    if (!marketCity.trim() || !marketState.trim()) {
      toast({ title: 'Error', description: 'Market city and state are required', variant: 'destructive' });
      return;
    }
    if (!moveInDate) {
      toast({ title: 'Error', description: 'Move-in date is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      await updateBooking(id, {
        bookingDate,
        moveInDate,
        memberName: memberName.trim(),
        bookingType,
        agentId,
        marketCity: marketCity.trim(),
        marketState: marketState.trim().toUpperCase(),
        communicationMethod,
        status,
        notes: notes.trim() || undefined,
        hubspotLink: hubspotLink.trim() || undefined,
        kixieLink: kixieLink.trim() || undefined,
        adminProfileLink: adminProfileLink.trim() || undefined,
        moveInDayReachOut,
        isRebooking,
        originalBookingId: isRebooking ? originalBookingId : undefined,
      });

      toast({
        title: 'Booking Updated',
        description: `Successfully updated booking for ${memberName}`,
      });

      navigate('/reports');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update booking',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bookingsLoading) {
    return (
      <DashboardLayout title="Edit Booking" subtitle="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!booking) {
    return (
      <DashboardLayout title="Edit Booking" subtitle="Booking not found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">The booking you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate('/reports')}>Back to Reports</Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!canEdit) {
    return (
      <DashboardLayout title="Edit Booking" subtitle="Access denied">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You don't have permission to edit this booking.</p>
          <Button onClick={() => navigate('/reports')}>Back to Reports</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Edit Booking" subtitle={`Editing booking for ${booking.memberName}`}>
      <div className="max-w-3xl">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Booking Info Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Booking Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Booking Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !bookingDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bookingDate ? format(bookingDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={bookingDate}
                      onSelect={(date) => date && setBookingDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Move-In Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !moveInDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {moveInDate ? format(moveInDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={moveInDate}
                      onSelect={setMoveInDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Booking Type</Label>
                <Select value={bookingType} onValueChange={(v) => setBookingType(v as Booking['bookingType'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Booking['status'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Member Info Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Member Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberName">Member Name *</Label>
                <Input
                  id="memberName"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Enter member's full name"
                />
              </div>
              
              {/* Rebooking Section */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRebooking"
                    checked={isRebooking}
                    onCheckedChange={(checked) => {
                      setIsRebooking(checked === true);
                      if (!checked) setOriginalBookingId(undefined);
                    }}
                  />
                  <Label htmlFor="isRebooking" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                    This is a rebooking (member previously booked)
                  </Label>
                </div>
                
                {isRebooking && (
                  <div className="space-y-2 pl-6">
                    <Label>Link to Original Booking (Optional)</Label>
                    <Select value={originalBookingId || ''} onValueChange={(v) => setOriginalBookingId(v || undefined)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select original booking..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bookings
                          .filter(b => b.id !== id && (b.status === 'Cancelled' || b.status === 'Postponed' || b.status === 'No Show' || b.status === 'Member Rejected'))
                          .slice(0, 50)
                          .map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.memberName} - {format(b.bookingDate, 'PP')} ({b.status})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Linking helps track member history and won't count as a duplicate booking.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Agent & Location Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Agent & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agent *</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.siteName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketCity">Market City *</Label>
                <Input
                  id="marketCity"
                  value={marketCity}
                  onChange={(e) => setMarketCity(e.target.value)}
                  placeholder="e.g., Atlanta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketState">State *</Label>
                <Input
                  id="marketState"
                  value={marketState}
                  onChange={(e) => setMarketState(e.target.value)}
                  placeholder="e.g., GA"
                  maxLength={2}
                  className="uppercase"
                />
              </div>
            </div>
          </div>

          {/* Communication Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Communication</h3>
            <div className="space-y-2">
              <Label>Communication Method</Label>
              <Select value={communicationMethod} onValueChange={(v) => setCommunicationMethod(v as Booking['communicationMethod'])}>
                <SelectTrigger className="w-full md:w-1/2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commMethods.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Links Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">External Links (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hubspotLink">HubSpot Link</Label>
                <Input
                  id="hubspotLink"
                  value={hubspotLink}
                  onChange={(e) => setHubspotLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kixieLink">Kixie Link</Label>
                <Input
                  id="kixieLink"
                  value={kixieLink}
                  onChange={(e) => setKixieLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminProfileLink">Admin Profile Link</Label>
                <Input
                  id="adminProfileLink"
                  value={adminProfileLink}
                  onChange={(e) => setAdminProfileLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Notes & Follow-up</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this booking..."
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="moveInReachOut"
                  checked={moveInDayReachOut}
                  onCheckedChange={(checked) => setMoveInDayReachOut(checked === true)}
                />
                <Label htmlFor="moveInReachOut" className="text-sm font-normal cursor-pointer">
                  Move-in day reach out completed
                </Label>
              </div>
            </div>
          </div>

          {/* Call Recording Section */}
          {booking && booking.kixieLink && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <CallInsights booking={booking} onTranscriptionComplete={refreshBookings} />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/reports')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
