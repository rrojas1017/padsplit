import { useState, useEffect, useRef } from 'react';
import { Booking } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { DateRangeFilter as DateRangeFilterType } from '@/utils/dashboardCalculations';
import { resolveRange, type CustomRangeInput } from '@/utils/businessTime';

const LIGHTWEIGHT_COLUMNS = `
  id, member_name, booking_date, move_in_date, agent_id, status,
  booking_type, market_city, market_state, communication_method,
  notes, hubspot_link, kixie_link, admin_profile_link, move_in_day_reach_out,
  created_by, created_at,
  transcription_status, transcription_error_message, transcribed_at,
  call_duration_seconds, call_type_id,
  is_rebooking, original_booking_id,
  contact_email, contact_phone,
  email_verified, email_verified_at, email_verification_status,
  record_type, import_batch_id
`;

function transformRow(b: any): Booking {
  return {
    id: b.id,
    moveInDate: b.move_in_date ? new Date(b.move_in_date + 'T00:00:00') : null,
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
    recordType: b.record_type as Booking['recordType'],
    importBatchId: b.import_batch_id || undefined,
  };
}

interface FetchBounds {
  lower: string | null; // inclusive, null = no lower bound
  upper: string;        // inclusive
}

/**
 * Fetches every actual-booking-table row (record_type = 'booking') in the
 * bounds, 1000 rows per page, no row cap. Stable order: booking_date desc, id desc.
 */
async function fetchAllBookings(bounds: FetchBounds, agentId?: string): Promise<Booking[]> {
  const PAGE_SIZE = 1000;
  const rows: Booking[] = [];
  let from = 0;
  for (;;) {
    let query = supabase
      .from('bookings')
      .select(LIGHTWEIGHT_COLUMNS)
      .eq('record_type', 'booking')
      .lte('booking_date', bounds.upper);
    if (bounds.lower) query = query.gte('booking_date', bounds.lower);
    if (agentId) query = query.eq('agent_id', agentId);
    const { data, error } = await query
      .order('booking_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    for (const r of page) rows.push(transformRow(r));
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Loads one booking by id (used when it is outside the context's 90-day window). */
export async function fetchBookingById(id: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(LIGHTWEIGHT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? transformRow(data) : null;
}

export interface DashboardDataOptions {
  agentId?: string;
  skipPrevious?: boolean;
  enabled?: boolean;
}

export function useDashboardData(
  dateRange: DateRangeFilterType,
  customDates?: CustomRangeInput,
  options: DashboardDataOptions = {},
) {
  const { agentId, skipPrevious = false, enabled = true } = options;
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<{ key: string; data: Booking[] } | null>(null);

  const range = resolveRange(dateRange, customDates);
  const lower = skipPrevious ? range.from : (range.prevFrom ?? range.from);
  const bounds: FetchBounds = { lower: dateRange === 'all' ? null : lower, upper: range.to };
  const cacheKey = `${bounds.lower ?? 'none'}|${bounds.upper}|${agentId ?? ''}`;

  useEffect(() => {
    if (!enabled) return;
    if (cacheRef.current?.key === cacheKey) {
      setBookings(cacheRef.current.data);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const [lowerKey, upperKey, agentKey] = cacheKey.split('|');
    fetchAllBookings({ lower: lowerKey === 'none' ? null : lowerKey, upper: upperKey }, agentKey || undefined)
      .then((data) => {
        if (cancelled) return;
        cacheRef.current = { key: cacheKey, data };
        setBookings(data);
      })
      .catch((error: unknown) => {
        console.error('[useDashboardData] Query failed:', error);
        if (!cancelled) setBookings([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey, enabled]);

  const stale = cacheRef.current?.key !== cacheKey;
  return {
    bookings: stale ? [] : (bookings || []),
    isLoading: enabled && (isLoading || bookings === null || stale),
  };
}
