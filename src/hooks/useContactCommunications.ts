import { useState, useEffect } from 'react';
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

interface UseContactCommunicationsReturn {
  communications: ContactCommunication[];
  lastCommunication: ContactCommunication | null;
  isLoading: boolean;
  canSendCommunications: boolean;
  logCommunication: (data: {
    bookingId: string;
    communicationType: 'sms' | 'email' | 'voice_note';
    recipientEmail?: string;
    recipientPhone?: string;
    messagePreview?: string;
  }) => Promise<boolean>;
}

export function useContactCommunications(bookingId?: string): UseContactCommunicationsReturn {
  const { user } = useAuth();
  const [communications, setCommunications] = useState<ContactCommunication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canSendCommunications, setCanSendCommunications] = useState(false);

  // Check if current user can send communications
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.id) {
        setCanSendCommunications(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('can_send_communications')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setCanSendCommunications(data.can_send_communications ?? false);
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

      // Refresh the list
      if (data.bookingId === bookingId) {
        const { data: newData } = await supabase
          .from('contact_communications')
          .select('*')
          .eq('booking_id', bookingId)
          .order('sent_at', { ascending: false });

        if (newData) {
          setCommunications(newData.map(row => ({
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
      }

      return true;
    } catch (error) {
      console.error('Error logging communication:', error);
      return false;
    }
  };

  const lastCommunication = communications.length > 0 ? communications[0] : null;

  return {
    communications,
    lastCommunication,
    isLoading,
    canSendCommunications,
    logCommunication,
  };
}
