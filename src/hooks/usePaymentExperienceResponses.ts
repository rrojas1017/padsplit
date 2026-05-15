import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentExperienceExtraction } from '@/types/research-insights';

export interface PaymentExperienceRecord {
  id: string;
  booking_id: string;
  member_name: string;
  contact_phone: string | null;
  booking_date: string;
  extraction: PaymentExperienceExtraction;
}

export interface PaymentKPIs {
  totalSurveyed: number;
  avgLiteracyScore: number | null;
  autopayEnrolledPct: number | null;
  avgMoveInClarity: number | null;
  hardshipAwarePct: number | null;
  payCycleMisalignmentPct: number | null;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function deriveKPIs(records: PaymentExperienceRecord[]): PaymentKPIs {
  const total = records.length;

  const literacyScores = records
    .map((r) => r.extraction?.payment_literacy_score)
    .filter((v): v is number => typeof v === 'number');

  const autopayValues = records
    .map((r) => r.extraction?.autopay_status)
    .filter((v): v is NonNullable<typeof v> => !!v);
  const autopayEnrolled = autopayValues.filter((v) => v === 'enrolled').length;

  const clarityValues = records
    .map((r) => r.extraction?.move_in_cost_clarity_1to5)
    .filter((v): v is number => typeof v === 'number');

  const hardshipKnown = records.filter((r) => r.extraction?.hardship_awareness_gap === false).length;
  const hardshipAnswered = records.filter((r) => typeof r.extraction?.hardship_awareness_gap === 'boolean').length;

  // Pay-cycle misalignment: members not on weekly cadence (PadSplit dues are weekly)
  const cadenceValues = records
    .map((r) => (r.extraction?.pay_cadence || '').toString().toLowerCase())
    .filter((v) => !!v);
  const misaligned = cadenceValues.filter((v) => !v.includes('week')).length;

  return {
    totalSurveyed: total,
    avgLiteracyScore: avg(literacyScores),
    autopayEnrolledPct: autopayValues.length ? (autopayEnrolled / autopayValues.length) * 100 : null,
    avgMoveInClarity: avg(clarityValues),
    hardshipAwarePct: hardshipAnswered ? (hardshipKnown / hardshipAnswered) * 100 : null,
    payCycleMisalignmentPct: cadenceValues.length ? (misaligned / cadenceValues.length) * 100 : null,
  };
}

export function usePaymentExperienceResponses() {
  const query = useQuery({
    queryKey: ['payment-experience-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, research_extraction, bookings!inner(member_name, contact_phone, booking_date)')
        .eq('research_campaign_type', 'payment_experience')
        .not('research_extraction', 'is', null);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        booking_id: row.booking_id,
        member_name: row.bookings?.member_name || 'Unknown',
        contact_phone: row.bookings?.contact_phone || null,
        booking_date: row.bookings?.booking_date || '',
        extraction: (row.research_extraction || {}) as PaymentExperienceExtraction,
      })) as PaymentExperienceRecord[];
    },
  });

  const records = query.data || [];
  const kpis = deriveKPIs(records);

  return {
    records,
    kpis,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
