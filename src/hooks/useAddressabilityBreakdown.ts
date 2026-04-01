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

      // Group by addressability bucket → cluster → sub-reasons & scores
      const bucketMap: Record<string, Record<string, { count: number; scores: number[]; subs: Record<string, number> }>> = {};

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
        const caseBrief = (cls?.case_brief && typeof cls.case_brief === 'string') ? cls.case_brief : '';
        const subKey = extractSubReason(cluster, caseBrief);

        if (!bucketMap[bucket]) bucketMap[bucket] = {};
        if (!bucketMap[bucket][cluster]) bucketMap[bucket][cluster] = { count: 0, scores: [], subs: {} };
        bucketMap[bucket][cluster].count++;
        bucketMap[bucket][cluster].subs[subKey] = (bucketMap[bucket][cluster].subs[subKey] || 0) + 1;
        if (score != null) bucketMap[bucket][cluster].scores.push(score);
      }

      const result: AddressabilityBucket[] = ADDRESSABILITY_ORDER.map(name => {
        const clusterData = bucketMap[name] || {};
        const entries = Object.entries(clusterData).sort((a, b) => b[1].count - a[1].count);
        const bucketCount = entries.reduce((s, [, v]) => s + v.count, 0);

        const reasonBreakdown: ReasonInBucket[] = entries.map(([cluster, v]) => {
          const subEntries = Object.entries(v.subs).sort((a, b) => b[1] - a[1]);
          const mainSubs: SubReasonInBucket[] = [];
          let otherCount = 0;
          for (const [subName, count] of subEntries) {
            if (count < 3) { otherCount += count; } else { mainSubs.push({ name: subName, count }); }
          }
          if (otherCount > 0) mainSubs.push({ name: 'Other in this category', count: otherCount });

          return {
            cluster,
            count: v.count,
            avgScore: v.scores.length > 0 ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10 : 0,
            color: CLUSTER_COLORS[cluster] || '#718096',
            subReasons: mainSubs,
          };
        });

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
