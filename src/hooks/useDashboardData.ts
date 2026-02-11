import { useState, useEffect, useRef, useCallback } from 'react';
import { Booking } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useBookings } from '@/contexts/BookingsContext';
import { DateRangeFilter as DateRangeFilterType, CustomDateRange } from '@/utils/dashboardCalculations';
import { format, subDays } from 'date-fns';

const LIGHTWEIGHT_COLUMNS = `
  id, member_name, booking_date, move_in_date, agent_id, status,
  booking_type, market_city, market_state, communication_method,
  notes, hubspot_link, kixie_link, admin_profile_link, move_in_day_reach_out,
  created_by, created_at,
  transcription_status, transcription_error_message, transcribed_at,
  call_duration_seconds, call_type_id,
  is_rebooking, original_booking_id,
  contact_email, contact_phone,
  email_verified, email_verified_at, email_verification_status
`;

function transformRow(b: any): Booking {
  return {
    id: b.id,
    moveInDate: new Date(b.move_in_date + 'T00:00:00'),
    bookingDate: new Date(b.booking_date + 'T00:00:00'),
    memberName: b.member_name,
    bookingType: b.booking_type,
    agentId: b.agent_id,
    agentName: '',
    marketCity: b.market_city || '',
    marketState: b.market_state || '',
    communicationMethod: b.communication_method,
    status: b.status,
    notes: b.notes || undefined,
    hubspotLink: b.hubspot_link || undefined,
    kixieLink: b.kixie_link || undefined,
    adminProfileLink: b.admin_profile_link || undefined,
    moveInDayReachOut: b.move_in_day_reach_out || false,
    createdBy: b.created_by || undefined,
    createdAt: b.created_at ? new Date(b.created_at) : undefined,
    callTranscription: undefined,
    callSummary: undefined,
    callKeyPoints: undefined,
    transcriptionStatus: b.transcription_status || undefined,
    transcriptionErrorMessage: b.transcription_error_message || undefined,
    transcribedAt: b.transcribed_at ? new Date(b.transcribed_at) : undefined,
    callDurationSeconds: b.call_duration_seconds || undefined,
    agentFeedback: undefined,
    coachingAudioUrl: undefined,
    coachingAudioGeneratedAt: undefined,
    callTypeId: b.call_type_id || undefined,
    isRebooking: b.is_rebooking || false,
    originalBookingId: b.original_booking_id || undefined,
    contactEmail: b.contact_email || undefined,
    contactPhone: b.contact_phone || undefined,
    emailVerified: b.email_verified,
    emailVerifiedAt: b.email_verified_at ? new Date(b.email_verified_at) : undefined,
    emailVerificationStatus: b.email_verification_status as Booking['emailVerificationStatus'],
  };
}

function needsDirectQuery(dateRange: DateRangeFilterType, customDates?: CustomDateRange): boolean {
  if (dateRange === 'all') return true;
  if (dateRange === 'custom' && customDates) {
    const ninetyDaysAgo = subDays(new Date(), 90);
    return customDates.from < ninetyDaysAgo;
  }
  return false;
}

/**
 * Fetches all rows using .range() pagination to bypass Supabase's 1000-row default limit.
 */
async function fetchAllBookings(dateFilter?: { from: string; to: string }): Promise<Booking[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('bookings')
      .select(LIGHTWEIGHT_COLUMNS)
      .order('booking_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (dateFilter) {
      query = query.gte('booking_date', dateFilter.from).lte('booking_date', dateFilter.to);
    }

    const { data, error } = await query;
    if (error) throw error;

    allRows = allRows.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;

    // Safety cap at 10,000
    if (allRows.length >= 10000) break;
  }

  return allRows.map(transformRow);
}

export function useDashboardData(dateRange: DateRangeFilterType, customDates?: CustomDateRange) {
  const { bookings: contextBookings, isLoading: contextLoading } = useBookings();
  const [directBookings, setDirectBookings] = useState<Booking[] | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const cacheRef = useRef<{ key: string; data: Booking[] } | null>(null);

  const cacheKey = dateRange === 'custom' && customDates
    ? `custom-${format(customDates.from, 'yyyy-MM-dd')}-${format(customDates.to, 'yyyy-MM-dd')}`
    : dateRange;

  const fetchDirect = useCallback(async () => {
    // Check cache
    if (cacheRef.current?.key === cacheKey) {
      setDirectBookings(cacheRef.current.data);
      return;
    }

    setIsDirectLoading(true);
    try {
      const dateFilter = dateRange === 'custom' && customDates
        ? { from: format(customDates.from, 'yyyy-MM-dd'), to: format(customDates.to, 'yyyy-MM-dd') }
        : undefined; // 'all' = no date filter

      const data = await fetchAllBookings(dateFilter);
      cacheRef.current = { key: cacheKey, data };
      setDirectBookings(data);
    } catch (error) {
      console.error('[useDashboardData] Direct query failed:', error);
    } finally {
      setIsDirectLoading(false);
    }
  }, [cacheKey, dateRange, customDates]);

  useEffect(() => {
    if (needsDirectQuery(dateRange, customDates)) {
      fetchDirect();
    } else {
      setDirectBookings(null);
    }
  }, [dateRange, customDates, fetchDirect]);

  const useDirect = needsDirectQuery(dateRange, customDates);

  return {
    bookings: useDirect ? (directBookings || []) : contextBookings,
    isLoading: useDirect ? isDirectLoading : contextLoading,
  };
}
