import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ContactCommunication {
  id: string;
  bookingId: string;
  userId: string;
  userName: string;
  communicationType: 'sms' | 'email' | 'voice_note';
  recipientEmail: string | null;
  recipientPhone: string | null;
  messagePreview: string | null;
  sentAt: Date;
  status: 'sent' | 'failed' | 'delivered';
}

interface SendEmailParams {
  bookingId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

interface SendSMSParams {
  bookingId: string;
  recipientPhone: string;
  recipientName: string;
  message: string;
}

interface UseContactCommunicationsReturn {
  communications: ContactCommunication[];
  lastCommunication: ContactCommunication | null;
  isLoading: boolean;
  canSendCommunications: boolean;
  canSendEmail: boolean;
  canSendSMS: boolean;
  canSendVoice: boolean;
  logCommunication: (data: {
    bookingId: string;
    communicationType: 'sms' | 'email' | 'voice_note';
    recipientEmail?: string;
    recipientPhone?: string;
    messagePreview?: string;
  }) => Promise<boolean>;
  sendEmail: (params: SendEmailParams) => Promise<{ success: boolean; error?: string }>;
  sendSMS: (params: SendSMSParams) => Promise<{ success: boolean; error?: string }>;
  refreshCommunications: () => Promise<void>;
}

export function useContactCommunications(bookingId?: string): UseContactCommunicationsReturn {
  const { user } = useAuth();
  const [communications, setCommunications] = useState<ContactCommunication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canSendCommunications, setCanSendCommunications] = useState(false);
  const [canSendEmail, setCanSendEmail] = useState(false);
  const [canSendSMS, setCanSendSMS] = useState(false);
  const [canSendVoice, setCanSendVoice] = useState(false);

  // Check if current user can send communications
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.id) {
        setCanSendCommunications(false);
        setCanSendEmail(false);
        setCanSendSMS(false);
        setCanSendVoice(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('can_send_communications, can_send_email, can_send_sms, can_send_voice')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        const masterEnabled = data.can_send_communications ?? false;
        setCanSendCommunications(masterEnabled);
        // Each channel requires both master toggle AND specific channel toggle
        setCanSendEmail(masterEnabled && (data.can_send_email ?? false));
        setCanSendSMS(masterEnabled && (data.can_send_sms ?? false));
        setCanSendVoice(masterEnabled && (data.can_send_voice ?? false));
      }
    };

    checkPermission();
  }, [user?.id]);

  // Fetch communication history for a booking
  useEffect(() => {
    const fetchCommunications = async () => {
      if (!bookingId) {
        setCommunications([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('contact_communications')
          .select('*')
          .eq('booking_id', bookingId)
          .order('sent_at', { ascending: false });

        if (error) throw error;

        const mapped: ContactCommunication[] = (data || []).map(row => ({
          id: row.id,
          bookingId: row.booking_id,
          userId: row.user_id,
          userName: row.user_name,
          communicationType: row.communication_type as 'sms' | 'email' | 'voice_note',
          recipientEmail: row.recipient_email,
          recipientPhone: row.recipient_phone,
          messagePreview: row.message_preview,
          sentAt: new Date(row.sent_at),
          status: row.status as 'sent' | 'failed' | 'delivered',
        }));

        setCommunications(mapped);
      } catch (error) {
        console.error('Error fetching communications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommunications();
  }, [bookingId]);

  const refreshCommunications = useCallback(async () => {
    if (!bookingId) return;
    
    const { data } = await supabase
      .from('contact_communications')
      .select('*')
      .eq('booking_id', bookingId)
      .order('sent_at', { ascending: false });

    if (data) {
      setCommunications(data.map(row => ({
        id: row.id,
        bookingId: row.booking_id,
        userId: row.user_id,
        userName: row.user_name,
        communicationType: row.communication_type as 'sms' | 'email' | 'voice_note',
        recipientEmail: row.recipient_email,
        recipientPhone: row.recipient_phone,
        messagePreview: row.message_preview,
        sentAt: new Date(row.sent_at),
        status: row.status as 'sent' | 'failed' | 'delivered',
      })));
    }
  }, [bookingId]);

  const logCommunication = async (data: {
    bookingId: string;
    communicationType: 'sms' | 'email' | 'voice_note';
    recipientEmail?: string;
    recipientPhone?: string;
    messagePreview?: string;
  }): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('contact_communications')
        .insert({
          booking_id: data.bookingId,
          user_id: user.id,
          user_name: user.name,
          communication_type: data.communicationType,
          recipient_email: data.recipientEmail || null,
          recipient_phone: data.recipientPhone || null,
          message_preview: data.messagePreview || null,
          status: 'sent',
        });

      if (error) throw error;

      // Refresh the list if this is the same booking
      if (data.bookingId === bookingId) {
        await refreshCommunications();
      }

      return true;
    } catch (error) {
      console.error('Error logging communication:', error);
      return false;
    }
  };

  const sendEmail = async (params: SendEmailParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-follow-up-email', {
        body: params,
      });

      if (error) {
        return { success: false, error: error.message || 'Failed to send email' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      // Refresh communications list if this is the same booking
      if (params.bookingId === bookingId) {
        await refreshCommunications();
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  };

  const sendSMS = async (params: SendSMSParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-follow-up-sms', {
        body: params,
      });

      if (error) {
        return { success: false, error: error.message || 'Failed to send SMS' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      // Refresh communications list if this is the same booking
      if (params.bookingId === bookingId) {
        await refreshCommunications();
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  };

  const lastCommunication = communications.length > 0 ? communications[0] : null;

  return {
    communications,
    lastCommunication,
    isLoading,
    canSendCommunications,
    canSendEmail,
    canSendSMS,
    canSendVoice,
    logCommunication,
    sendEmail,
    sendSMS,
    refreshCommunications,
  };
}
