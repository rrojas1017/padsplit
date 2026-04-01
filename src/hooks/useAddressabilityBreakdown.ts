import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapToCluster, extractSubReason, normalizeAddressability, ADDRESSABILITY_COLORS, ADDRESSABILITY_ORDER, CLUSTER_COLORS } from '@/utils/reason-code-mapping';

export interface SubReasonInBucket {
  name: string;
  count: number;
}

export interface ReasonInBucket {
  cluster: string;
  count: number;
  avgScore: number;
  color: string;
  subReasons: SubReasonInBucket[];
}

export interface AddressabilityBucket {
  name: string;
  count: number;
  percentage: number;
  color: string;
  reasonBreakdown: ReasonInBucket[];
}

export function useAddressabilityBreakdown() {
  const [buckets, setBuckets] = useState<AddressabilityBucket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('research_classification, booking_id')
        .not('research_classification', 'is', null)
        .eq('research_campaign_type', 'move_out_survey');

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Group by addressability bucket → cluster → scores
      const bucketMap: Record<string, Record<string, { count: number; scores: number[] }>> = {};

      let totalCount = 0;
      for (const row of data) {
        const cls = row.research_classification as any;
        const addressability = cls?.addressability;
        const reasonCode = cls?.primary_reason_code;
        if (!addressability || typeof addressability !== 'string') continue;
        if (!reasonCode || typeof reasonCode !== 'string') continue;

        totalCount++;
        const bucket = normalizeAddressability(addressability);
        const cluster = mapToCluster(reasonCode);
        const score = typeof cls?.preventability_score === 'number' ? cls.preventability_score : null;

        if (!bucketMap[bucket]) bucketMap[bucket] = {};
        if (!bucketMap[bucket][cluster]) bucketMap[bucket][cluster] = { count: 0, scores: [] };
        bucketMap[bucket][cluster].count++;
        if (score != null) bucketMap[bucket][cluster].scores.push(score);
      }

      const result: AddressabilityBucket[] = ADDRESSABILITY_ORDER.map(name => {
        const clusterData = bucketMap[name] || {};
        const entries = Object.entries(clusterData).sort((a, b) => b[1].count - a[1].count);
        const bucketCount = entries.reduce((s, [, v]) => s + v.count, 0);

        const reasonBreakdown: ReasonInBucket[] = entries.map(([cluster, v]) => ({
          cluster,
          count: v.count,
          avgScore: v.scores.length > 0 ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10 : 0,
          color: CLUSTER_COLORS[cluster] || '#718096',
        }));

        return {
          name,
          count: bucketCount,
          percentage: totalCount > 0 ? Math.round((bucketCount / totalCount) * 100) : 0,
          color: ADDRESSABILITY_COLORS[name] || '#718096',
          reasonBreakdown,
        };
      }).filter(b => b.count > 0);

      setBuckets(result);
      setTotal(totalCount);
      setLoading(false);
    }

    fetch();
  }, []);

  return { buckets, total, loading };
}
