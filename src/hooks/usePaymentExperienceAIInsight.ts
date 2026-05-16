import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentKPIs, FrictionThemeAgg, AutopayBarrierAgg } from './usePaymentExperienceResponses';

export interface PaymentAIInsight {
  headline: string;
  finding: string | null;
  generatedAt: string | null;
  totalAnalyzed: number | null;
  source: 'ai' | 'derived';
}

interface DeriveInput {
  kpis: PaymentKPIs;
  topFriction: FrictionThemeAgg[];
  topBarriers: AutopayBarrierAgg[];
}

/** Deterministic client-derived headline used when no nightly insight row exists yet. */
function deriveHeadline({ kpis, topFriction, topBarriers }: DeriveInput): PaymentAIInsight {
  const parts: string[] = [];

  if (kpis.autopayEnrolled.denominator > 0 && kpis.autopayEnrolled.value != null) {
    const notEnrolledPct = Math.round(100 - kpis.autopayEnrolled.value);
    const barrier = topBarriers[0]?.label?.toLowerCase();
    parts.push(
      barrier
        ? `${notEnrolledPct}% of surveyed members are not enrolled in auto-pay — top barrier: ${barrier}.`
        : `${notEnrolledPct}% of surveyed members are not enrolled in auto-pay.`
    );
  } else if (topFriction[0]) {
    parts.push(`Top payment friction: ${topFriction[0].label.toLowerCase()} (${topFriction[0].count} members).`);
  } else {
    parts.push(`${kpis.totalEligible.toLocaleString()} payment surveys analyzed.`);
  }

  const findingBits: string[] = [];
  if (kpis.payCycleMisalignment.denominator > 0 && kpis.payCycleMisalignment.value != null) {
    findingBits.push(`${Math.round(kpis.payCycleMisalignment.value)}% are on a non-weekly pay cadence`);
  }
  if (kpis.moveInClarity.value != null) {
    findingBits.push(`avg move-in cost clarity ${kpis.moveInClarity.value.toFixed(1)}/5`);
  }
  if (topFriction[0] && kpis.autopayEnrolled.denominator > 0) {
    findingBits.push(`top friction theme: ${topFriction[0].label.toLowerCase()}`);
  }

  return {
    headline: parts.join(' '),
    finding: findingBits.length ? findingBits.join(' · ') + '.' : null,
    generatedAt: null,
    totalAnalyzed: kpis.totalEligible || null,
    source: 'derived',
  };
}

export function usePaymentExperienceAIInsight(input: DeriveInput) {
  const query = useQuery({
    queryKey: ['payment-experience-ai-insight'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_insights')
        .select('data, executive_brief, generated_at, total_records_analyzed, status')
        .eq('campaign_type', 'payment_experience')
        .eq('status', 'completed')
        .order('generated_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (query.data) {
    const row: any = query.data;
    const es = row.data?.executive_summary || row.executive_brief || {};
    const headline = es.headline || es.title || '';
    const findings = es.key_findings;
    const finding = Array.isArray(findings) ? findings.join(' ') : (typeof findings === 'string' ? findings : null);
    if (headline) {
      return {
        insight: {
          headline,
          finding,
          generatedAt: row.generated_at || null,
          totalAnalyzed: row.total_records_analyzed || null,
          source: 'ai' as const,
        } satisfies PaymentAIInsight,
        isLoading: false,
      };
    }
  }

  return {
    insight: deriveHeadline(input),
    isLoading: query.isLoading,
  };
}
