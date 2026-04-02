import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import { DISTINCT_COLORS } from '@/utils/audienceSurveyInsights';
import type { AudienceSurveyRecord } from '@/hooks/useAudienceSurveyResponses';

interface Props {
  records: AudienceSurveyRecord[];
}

export function AdExposureDonut({ records }: Props) {
  // PadSplit ad exposure breakdown
  const seenYesLiked = records.filter(r => r.extraction.ad_awareness?.has_seen_padsplit_ads === true && r.extraction.ad_awareness?.what_they_liked_about_ads).length;
  const seenYes = records.filter(r => r.extraction.ad_awareness?.has_seen_padsplit_ads === true).length;
  const seenNo = records.filter(r => r.extraction.ad_awareness?.has_seen_padsplit_ads === false).length;
  const total = seenYes + seenNo || 1;
  const recallPct = Math.round((seenYes / total) * 100);

  const donutData = [
    { name: 'Saw & Liked', value: seenYesLiked },
    { name: 'Saw (Neutral)', value: Math.max(0, seenYes - seenYesLiked) },
    { name: "Haven't Seen", value: seenNo },
  ].filter(d => d.value > 0);

  const followsInfluencers = records.filter(r => r.extraction.influencer_following?.follows_influencers === true).length;
  const influencerPct = Math.round((followsInfluencers / (records.length || 1)) * 100);

  const noticedAds = records.filter(r => r.extraction.ad_awareness?.noticed_standout_ads === true).length;
  const adAwarenessPct = Math.round((noticedAds / (records.length || 1)) * 100);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          PadSplit Ad Exposure
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DISTINCT_COLORS[i % DISTINCT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{recallPct}%</p>
                <p className="text-[10px] text-muted-foreground">Ad Recall</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 flex flex-col justify-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Follow Influencers</span>
                <Badge variant="secondary">{influencerPct}%</Badge>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${influencerPct}%` }} />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Noticed Standout Ads</span>
                <Badge variant="secondary">{adAwarenessPct}%</Badge>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${adAwarenessPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
