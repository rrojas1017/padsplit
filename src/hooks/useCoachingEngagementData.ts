import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDateRangeFromFilter, DateRangeFilter, CustomDateRange } from '@/utils/dashboardCalculations';
import { format } from 'date-fns';

export interface EngagementRecord {
  bookingId: string;
  agentId: string;
  bookingDate: string;
  coachingAudioUrl: string | null;
  coachingAudioListenedAt: string | null;
  qaCoachingAudioUrl: string | null;
  qaCoachingAudioListenedAt: string | null;
}

interface UseCoachingEngagementDataProps {
  dateRange: DateRangeFilter;
  customDates?: CustomDateRange;
}

export function useCoachingEngagementData({ dateRange, customDates }: UseCoachingEngagementDataProps) {
  const [records, setRecords] = useState<EngagementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('booking_transcriptions')
        .select('booking_id, coaching_audio_url, coaching_audio_listened_at, qa_coaching_audio_url, qa_coaching_audio_listened_at, bookings!inner(booking_date, agent_id)')
        .or('coaching_audio_url.not.is.null,qa_coaching_audio_url.not.is.null');

      if (dateRange !== 'all') {
        const { start, end } = getDateRangeFromFilter(dateRange, customDates);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        query = query.gte('bookings.booking_date', startStr).lte('bookings.booking_date', endStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching engagement data:', error);
        setRecords([]);
        return;
      }

      const mapped: EngagementRecord[] = (data || []).map((row: any) => ({
        bookingId: row.booking_id,
        agentId: row.bookings.agent_id,
        bookingDate: row.bookings.booking_date,
        coachingAudioUrl: row.coaching_audio_url,
        coachingAudioListenedAt: row.coaching_audio_listened_at,
        qaCoachingAudioUrl: row.qa_coaching_audio_url,
        qaCoachingAudioListenedAt: row.qa_coaching_audio_listened_at,
      }));

      setRecords(mapped);
    } catch (err) {
      console.error('Error fetching engagement data:', err);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, customDates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, isLoading };
}
