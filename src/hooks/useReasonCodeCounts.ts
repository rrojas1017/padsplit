import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapToCluster, extractSubReason, CLUSTER_COLORS, CLUSTER_ORDER } from '@/utils/reason-code-mapping';

export interface SubReason {
  name: string;
  count: number;
}

export interface ClusterData {
  name: string;
  count: number;
  percentage: number;
  color: string;
  subReasons: SubReason[];
}

export function useReasonCodeCounts() {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
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

      const clusterMap: Record<string, Record<string, number>> = {};

      for (const row of data) {
        const cls = row.research_classification as any;
        const reasonCode = cls?.primary_reason_code;
        if (!reasonCode || typeof reasonCode !== 'string') continue;

        const cluster = mapToCluster(reasonCode);
        // Use reason_detail for granular sub-reasons, fall back to primary_reason_code
        const subKey = (cls?.reason_detail && typeof cls.reason_detail === 'string' && cls.reason_detail.trim())
          ? cls.reason_detail.trim()
          : reasonCode;
        if (!clusterMap[cluster]) clusterMap[cluster] = {};
        clusterMap[cluster][subKey] = (clusterMap[cluster][subKey] || 0) + 1;
      }

      const totalCount = data.filter(r => {
        const c = r.research_classification as any;
        return c?.primary_reason_code && typeof c.primary_reason_code === 'string';
      }).length;

      const result: ClusterData[] = CLUSTER_ORDER.map(name => {
        const subs = clusterMap[name] || {};
        const entries = Object.entries(subs).sort((a, b) => b[1] - a[1]);

        // Group sub-reasons with < 3 records into "Other in this category"
        const mainSubs: SubReason[] = [];
        let otherCount = 0;
        for (const [subName, count] of entries) {
          if (count < 3) {
            otherCount += count;
          } else {
            mainSubs.push({ name: subName, count });
          }
        }
        if (otherCount > 0) {
          mainSubs.push({ name: 'Other in this category', count: otherCount });
        }

        const clusterCount = entries.reduce((s, [, c]) => s + c, 0);

        return {
          name,
          count: clusterCount,
          percentage: totalCount > 0 ? Math.round((clusterCount / totalCount) * 100) : 0,
          color: CLUSTER_COLORS[name] || '#718096',
          subReasons: mainSubs,
        };
      }).filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count);

      setClusters(result);
      setTotal(totalCount);
      setLoading(false);
    }

    fetch();
  }, []);

  return { clusters, total, loading };
}
