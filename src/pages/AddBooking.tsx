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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { Booking } from '@/types';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Save, PlusCircle, ArrowLeft, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const bookingTypes: Booking['bookingType'][] = ['Inbound', 'Outbound', 'Referral'];
const statuses: Booking['status'][] = ['Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled', 'Postponed'];
const commMethods: Booking['communicationMethod'][] = ['Phone', 'SMS', 'LC', 'Email'];

export default function AddBooking() {
  usePageTracking('view_add_booking');
  const { addBooking } = useBookings();
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
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation helpers for real-time feedback
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email.trim() !== '' && emailRegex.test(email.trim());
  };

  const isValidPhone = (phone: string) => {
    const phoneDigits = phone.replace(/\D/g, '');
    return phoneDigits.length >= 10;
  };

  // Get list of past bookings for rebooking dropdown
  const { bookings } = useBookings();

  // Filter agents based on user role
  const availableAgents = (() => {
    if (user?.role === 'agent') {
      // Agents can only select themselves
      return agents.filter(a => a.userId === user.id && a.active);
    } else if (user?.role === 'supervisor' && user.siteId) {
      // Supervisors see agents from their site
      return agents.filter(a => a.siteId === user.siteId && a.active);
    } else {
      // Admins see all active agents
      return agents.filter(a => a.active);
    }
  })();

  // Auto-select agent if there's only one option (for agents)
  useEffect(() => {
    if (availableAgents.length === 1 && !agentId) {
      setAgentId(availableAgents[0].id);
    }
  }, [availableAgents, agentId]);

  const handleSubmit = async (e: React.FormEvent, addAnother: boolean = false) => {
    e.preventDefault();

    if (isSubmitting) return;

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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!contactEmail.trim() || !emailRegex.test(contactEmail.trim())) {
      toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    // Phone validation (at least 10 digits)
    const phoneDigits = contactPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast({ title: 'Error', description: 'Please enter a valid phone number (at least 10 digits)', variant: 'destructive' });
      return;
    }

    const selectedAgent = agents.find(a => a.id === agentId);
    if (!selectedAgent) return;

    setIsSubmitting(true);

    try {
      // Check for duplicate booking (same member, agent, and booking date)
      const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('member_name', memberName.trim())
        .eq('agent_id', agentId)
        .eq('booking_date', bookingDateStr);

      if (existingBookings && existingBookings.length > 0) {
        const confirmed = window.confirm(
          `A booking for "${memberName.trim()}" by ${selectedAgent.name} on ${format(bookingDate, 'PPP')} already exists. Are you sure you want to create another one?`
        );
        if (!confirmed) {
          setIsSubmitting(false);
          return;
        }
      }

      const newBookingId = await addBooking({
        bookingDate,
        moveInDate,
        memberName: memberName.trim(),
        bookingType,
        agentId,
        agentName: selectedAgent.name,
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
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      });

      // Trigger email verification in background (fire and forget)
      if (newBookingId && contactEmail.trim()) {
        supabase.functions.invoke('verify-email', {
          body: { bookingId: newBookingId, email: contactEmail.trim() }
        }).catch(err => {
          console.error('Email verification trigger failed:', err);
        });
      }

      toast({
        title: 'Booking Added',
        description: `Successfully added booking for ${memberName}`,
      });

      if (addAnother) {
        setNotes('');
        setHubspotLink('');
        setKixieLink('');
        setAdminProfileLink('');
        setMoveInDayReachOut(false);
        setIsRebooking(false);
        setOriginalBookingId(undefined);
        setContactEmail('');
        setContactPhone('');
      } else {
        navigate('/reports');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add booking', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Add Booking" subtitle="Manually enter a new booking">
      <div className="max-w-3xl">
        <Button
          variant="ghost"
          className="mb-4 gap-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
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
                          .filter(b => b.status === 'Cancelled' || b.status === 'Postponed' || b.status === 'No Show' || b.status === 'Member Rejected')
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

          {/* Contact Information Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email Address *</Label>
                <div className="relative">
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="member@email.com"
                    className={isValidEmail(contactEmail) ? 'pr-10' : ''}
                  />
                  {isValidEmail(contactEmail) && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(000) 000-0000"
                    className={isValidPhone(contactPhone) ? 'pr-10' : ''}
                  />
                  {isValidPhone(contactPhone) && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
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
                <Label htmlFor="kixieLink">Kixie Recording Link</Label>
                <Input
                  id="kixieLink"
                  value={kixieLink}
                  onChange={(e) => setKixieLink(e.target.value)}
                  placeholder="https://calls.kixie.com/abc123.wav"
                  className={kixieLink && !kixieLink.includes('kixie.com') && !kixieLink.includes('.wav') && !kixieLink.includes('.mp3') ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                />
                {kixieLink && !kixieLink.includes('kixie.com') && !kixieLink.includes('.wav') && !kixieLink.includes('.mp3') && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ This doesn't look like a Kixie recording URL. Expected format: https://calls.kixie.com/...wav
                  </p>
                )}
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

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save & View Reports'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, true)}
            >
              <PlusCircle className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save & Add Another'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
