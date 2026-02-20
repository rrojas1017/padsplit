import { useState, useEffect } from 'react';
import { Bell, Send, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function MovedInNotificationSettings() {
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEmail();
  }, []);

  const loadEmail = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('value')
        .eq('key', 'moved_in_notification_email')
        .single();

      if (!error && data?.value) {
        setEmail(data.value);
      }
    } catch (err) {
      console.error('Failed to load notification email:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!email.trim()) {
      toast.error('Please enter a recipient email address.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ value: email.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'moved_in_notification_email');

      if (error) throw error;
      toast.success('Notification email saved successfully.');
    } catch (err) {
      console.error('Failed to save notification email:', err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!email.trim()) {
      toast.error('Save a recipient email first before sending a test.');
      return;
    }
    setIsTesting(true);
    toast.info('Sending test email…', { duration: 4000 });

    try {
      // Fetch the most recent booking to use as the test payload
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, member_name')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (bookingError || !booking) {
        toast.error('No bookings found to use for the test email.');
        return;
      }

      const { error } = await supabase.functions.invoke('notify-moved-in', {
        body: { bookingId: booking.id },
      });

      if (error) throw error;
      toast.success(`Test email sent using booking for "${booking.member_name}". Check your inbox.`, { duration: 8000 });
    } catch (err) {
      console.error('Test email failed:', err);
      toast.error('Failed to send test email. Check the edge function logs.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-5 h-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Move-In Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Configure who receives an email when a booking status changes to <strong>Moved In</strong>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notification-email">Recipient Email Address</Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <Input
              id="notification-email"
              type="email"
              placeholder="e.g. ops@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-md"
            />
          )}
          <p className="text-xs text-muted-foreground">
            This address will receive an automated email each time a member is marked as Moved In.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Email
              </>
            )}
          </Button>

          <Button
            onClick={handleSendTest}
            disabled={isTesting || isLoading}
            variant="outline"
            className="gap-2"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending Test…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Test Email
              </>
            )}
          </Button>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <span>
              The test email uses the most recent booking in the database and sends a real notification to the configured address. Make sure to <strong>Save Email</strong> before testing.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
