import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgents } from '@/contexts/AgentsContext';
import { Booking, CallKeyPoints, AgentFeedback } from '@/types';
import { startOfDay, endOfDay, format } from 'date-fns';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type SortColumn = 'bookingDate' | 'moveInDate' | 'memberName' | 'agentName' | 'market' | 'bookingType' | 'status' | 'communicationMethod' | null;
export type SortDirection = 'asc' | 'desc';

export interface ImportBatch {
  id: string;
  count: number;
  earliestDate: string;
  latestDate: string;
}

export interface ReportsFilters {
  recordDateRange: DateRange;
  moveInDateRange: DateRange;
  importBatchFilter: string; // 'all' | 'manual' | specific batch ID
  siteId: string;
  status: string;
  bookingType: string;
  communicationMethod: string;
  agentId: string;
  rebookingFilter: 'all' | 'new' | 'rebooking';
  searchQuery: string;
}

export interface ReportsPagination {
  page: number;
  pageSize: number;
}

export interface ReportsSorting {
  column: SortColumn;
  direction: SortDirection;
}

interface UseReportsDataReturn {
  records: Booking[];
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
  importBatches: ImportBatch[];
  manualRecordCount: number;
  refetch: () => void;
}

// Map sort column names to database column names
const sortColumnMap: Record<string, string> = {
  bookingDate: 'booking_date',
  moveInDate: 'move_in_date',
  memberName: 'member_name',
  market: 'market_city',
  bookingType: 'booking_type',
  status: 'status',
  communicationMethod: 'communication_method',
};

export function useReportsData(
  filters: ReportsFilters,
  pagination: ReportsPagination,
  sorting: ReportsSorting
): UseReportsDataReturn {
  const { agents } = useAgents();
  const [records, setRecords] = useState<Booking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [manualRecordCount, setManualRecordCount] = useState(0);

  // Fetch import batches for the dropdown filter
  useEffect(() => {
    const fetchImportBatches = async () => {
      try {
        // Get batches with counts
        const { data: batchData, error: batchError } = await supabase
          .from('bookings')
          .select('import_batch_id')
          .not('import_batch_id', 'is', null);

        if (batchError) throw batchError;

        // Group and count
        const batchCounts: Record<string, { count: number }> = {};
        batchData?.forEach(row => {
          const batchId = row.import_batch_id;
          if (batchId) {
            if (!batchCounts[batchId]) {
              batchCounts[batchId] = { count: 0 };
            }
            batchCounts[batchId].count++;
          }
        });

        // Get date ranges for each batch
        const batches: ImportBatch[] = [];
        for (const batchId of Object.keys(batchCounts)) {
          const { data: dateRange } = await supabase
            .from('bookings')
            .select('booking_date')
            .eq('import_batch_id', batchId)
            .order('booking_date', { ascending: true })
            .limit(1);

          const { data: latestRange } = await supabase
            .from('bookings')
            .select('booking_date')
            .eq('import_batch_id', batchId)
            .order('booking_date', { ascending: false })
            .limit(1);

          batches.push({
            id: batchId,
            count: batchCounts[batchId].count,
            earliestDate: dateRange?.[0]?.booking_date || '',
            latestDate: latestRange?.[0]?.booking_date || '',
          });
        }

        // Sort by batch ID (which contains timestamp) descending
        batches.sort((a, b) => b.id.localeCompare(a.id));
        setImportBatches(batches);

        // Get manual record count
        const { count: manualCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .is('import_batch_id', null);

        setManualRecordCount(manualCount || 0);
      } catch (err) {
        console.error('Error fetching import batches:', err);
      }
    };

    fetchImportBatches();
  }, []);

  // Main data fetching function
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Calculate offset for pagination
      const offset = (pagination.page - 1) * pagination.pageSize;

      // Build the query
      let query = supabase
        .from('bookings')
        .select(`
          id,
          booking_date,
          move_in_date,
          member_name,
          agent_id,
          booking_type,
          status,
          communication_method,
          market_city,
          market_state,
          notes,
          hubspot_link,
          kixie_link,
          admin_profile_link,
          is_rebooking,
          original_booking_id,
          call_transcription,
          call_summary,
          call_key_points,
          transcription_status,
          transcription_error_message,
          transcribed_at,
          call_duration_seconds,
          agent_feedback,
          coaching_audio_url,
          coaching_audio_generated_at,
          call_type_id,
          import_batch_id,
          created_by,
          created_at
        `, { count: 'exact' });

      // Apply record date range filter (only if dates are set)
      if (filters.recordDateRange.from) {
        query = query.gte('booking_date', format(startOfDay(filters.recordDateRange.from), 'yyyy-MM-dd'));
      }
      if (filters.recordDateRange.to) {
        query = query.lte('booking_date', format(endOfDay(filters.recordDateRange.to), 'yyyy-MM-dd'));
      }

      // Apply move-in date range filter
      if (filters.moveInDateRange.from) {
        query = query.gte('move_in_date', format(startOfDay(filters.moveInDateRange.from), 'yyyy-MM-dd'));
      }
      if (filters.moveInDateRange.to) {
        query = query.lte('move_in_date', format(endOfDay(filters.moveInDateRange.to), 'yyyy-MM-dd'));
      }

      // Apply import batch filter
      if (filters.importBatchFilter === 'manual') {
        query = query.is('import_batch_id', null);
      } else if (filters.importBatchFilter !== 'all') {
        query = query.eq('import_batch_id', filters.importBatchFilter);
      }

      // Apply status filter
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply booking type filter
      if (filters.bookingType !== 'all') {
        query = query.eq('booking_type', filters.bookingType);
      }

      // Apply communication method filter
      if (filters.communicationMethod !== 'all') {
        query = query.eq('communication_method', filters.communicationMethod);
      }

      // Apply agent filter
      if (filters.agentId !== 'all') {
        query = query.eq('agent_id', filters.agentId);
      }

      // Apply site filter (need to get agent IDs for site)
      if (filters.siteId !== 'all') {
        const siteAgentIds = agents
          .filter(a => a.siteId === filters.siteId)
          .map(a => a.id);
        if (siteAgentIds.length > 0) {
          query = query.in('agent_id', siteAgentIds);
        } else {
          // No agents for this site, return empty
          setRecords([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
      }

      // Apply rebooking filter
      if (filters.rebookingFilter === 'new') {
        query = query.eq('is_rebooking', false);
      } else if (filters.rebookingFilter === 'rebooking') {
        query = query.eq('is_rebooking', true);
      }

      // Apply search filter (member name, market city, market state)
      if (filters.searchQuery) {
        const searchTerm = `%${filters.searchQuery}%`;
        query = query.or(`member_name.ilike.${searchTerm},market_city.ilike.${searchTerm},market_state.ilike.${searchTerm}`);
      }

      // Apply sorting
      const dbColumn = sorting.column ? sortColumnMap[sorting.column] || 'booking_date' : 'booking_date';
      query = query.order(dbColumn, { ascending: sorting.direction === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + pagination.pageSize - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Transform to Booking type
      const transformedRecords: Booking[] = (data || []).map(row => ({
        id: row.id,
        bookingDate: new Date(row.booking_date),
        moveInDate: new Date(row.move_in_date),
        memberName: row.member_name,
        agentId: row.agent_id,
        agentName: agents.find(a => a.id === row.agent_id)?.name || 'Unknown',
        bookingType: row.booking_type as 'Inbound' | 'Outbound' | 'Referral',
        status: row.status as Booking['status'],
        communicationMethod: row.communication_method as 'Phone' | 'SMS' | 'LC' | 'Email' | undefined,
        marketCity: row.market_city || '',
        marketState: row.market_state || '',
        notes: row.notes || undefined,
        hubspotLink: row.hubspot_link || undefined,
        kixieLink: row.kixie_link || undefined,
        adminProfileLink: row.admin_profile_link || undefined,
        isRebooking: row.is_rebooking,
        originalBookingId: row.original_booking_id || undefined,
        callTranscription: row.call_transcription || undefined,
        callSummary: row.call_summary || undefined,
        callKeyPoints: row.call_key_points as unknown as CallKeyPoints | undefined,
        transcriptionStatus: row.transcription_status as Booking['transcriptionStatus'],
        transcriptionErrorMessage: row.transcription_error_message || undefined,
        transcribedAt: row.transcribed_at ? new Date(row.transcribed_at) : undefined,
        callDurationSeconds: row.call_duration_seconds || undefined,
        agentFeedback: row.agent_feedback as unknown as AgentFeedback | undefined,
        coachingAudioUrl: row.coaching_audio_url || undefined,
        coachingAudioGeneratedAt: row.coaching_audio_generated_at ? new Date(row.coaching_audio_generated_at) : undefined,
        callTypeId: row.call_type_id || undefined,
        createdBy: row.created_by || undefined,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
      }));

      setRecords(transformedRecords);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching reports data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch records'));
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination, sorting, agents]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    records,
    totalCount,
    isLoading,
    error,
    importBatches,
    manualRecordCount,
    refetch,
  };
}
