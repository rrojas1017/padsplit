import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateChurnRisk, ChurnRiskResult } from '@/utils/churnPrediction';

export interface ChurnPredictionRecord {
  bookingId: string;
  memberName: string;
  moveInDate: string;
  bookingDate: string;
  agentId: string;
  marketCity: string | null;
  marketState: string | null;
  communicationMethod: string | null;
  callDurationSeconds: number | null;
  risk: ChurnRiskResult;
}

export function useChurnPrediction() {
  return useQuery({
    queryKey: ['churn-prediction'],
    queryFn: async () => {
      // Fetch all Pending Move-In bookings
      const { data: bookings, error: bErr } = await supabase
        .from('bookings')
        .select('id, member_name, move_in_date, booking_date, agent_id, market_city, market_state, communication_method, call_duration_seconds')
        .eq('status', 'Pending Move-In')
        .order('move_in_date', { ascending: true });

      if (bErr) throw bErr;
      if (!bookings || bookings.length === 0) return { records: [], summary: { high: 0, medium: 0, low: 0, total: 0 } };

      // Fetch transcriptions for these bookings
      const ids = bookings.map(b => b.id);
      const allTranscriptions: any[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { data: trans } = await supabase
          .from('booking_transcriptions')
          .select('booking_id, call_key_points, agent_feedback')
          .in('booking_id', chunk);
        if (trans) allTranscriptions.push(...trans);
      }

      const transMap = new Map(allTranscriptions.map(t => [t.booking_id, t]));

      // Compute market-level churn rates for the "high market churn" signal
      const { data: allBookings } = await supabase
        .from('bookings')
        .select('market_state, market_city, status')
        .not('status', 'eq', 'Non Booking');

      const marketChurnMap = new Map<string, number>();
      if (allBookings) {
        const grouped = new Map<string, { total: number; churned: number }>();
        for (const b of allBookings) {
          const key = `${b.market_state || ''}|${b.market_city || ''}`;
          const g = grouped.get(key) || { total: 0, churned: 0 };
          g.total++;
          if (['Member Rejected', 'No Show', 'Cancelled'].includes(b.status)) g.churned++;
          grouped.set(key, g);
        }
        for (const [key, g] of grouped) {
          if (g.total >= 5) marketChurnMap.set(key, (g.churned / g.total) * 100);
        }
      }

      const records: ChurnPredictionRecord[] = bookings.map(b => {
        const trans = transMap.get(b.id);
        const kp = trans?.call_key_points ? (typeof trans.call_key_points === 'string' ? JSON.parse(trans.call_key_points) : trans.call_key_points) : null;
        const af = trans?.agent_feedback ? (typeof trans.agent_feedback === 'string' ? JSON.parse(trans.agent_feedback) : trans.agent_feedback) : null;
        const marketKey = `${b.market_state || ''}|${b.market_city || ''}`;

        const risk = calculateChurnRisk({
          callDurationSeconds: b.call_duration_seconds,
          bookingDate: b.booking_date,
          moveInDate: b.move_in_date,
          communicationMethod: b.communication_method,
          transcription: kp,
          agentFeedback: af,
          marketChurnRate: marketChurnMap.get(marketKey),
        });

        return {
          bookingId: b.id,
          memberName: b.member_name,
          moveInDate: b.move_in_date,
          bookingDate: b.booking_date,
          agentId: b.agent_id,
          marketCity: b.market_city,
          marketState: b.market_state,
          communicationMethod: b.communication_method,
          callDurationSeconds: b.call_duration_seconds,
          risk,
        };
      });

      // Sort by risk score descending
      records.sort((a, b) => b.risk.score - a.risk.score);

      const summary = {
        high: records.filter(r => r.risk.level === 'high').length,
        medium: records.filter(r => r.risk.level === 'medium').length,
        low: records.filter(r => r.risk.level === 'low').length,
        total: records.length,
      };

      return { records, summary };
    },
    staleTime: 5 * 60 * 1000,
  });
}
