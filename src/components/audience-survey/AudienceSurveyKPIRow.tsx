import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, Users, Eye, Video, Hash } from 'lucide-react';
import type { AudienceSurveyInsightData } from '@/types/research-insights';

interface Props {
  data: AudienceSurveyInsightData;
}

export function AudienceSurveyKPIRow({ data }: Props) {
  const es = data.executive_summary;
  const kpis = [
    {
      label: 'Total Responses',
      value: es?.total_responses || 0,
      icon: Users,
    },
    {
      label: 'Top Platform',
      value: es?.top_platform || data.platform_breakdown?.[0]?.platform || '—',
      icon: Hash,
      isText: true,
    },
    {
      label: 'PadSplit Ad Awareness',
      value: `${Math.round(es?.padsplit_ad_awareness_pct ?? data.ad_awareness?.seen_padsplit_ads_pct ?? 0)}%`,
      icon: Eye,
      isText: true,
    },
    {
      label: 'Platforms Tracked',
      value: data.platform_breakdown?.length || 0,
      icon: Megaphone,
    },
    {
      label: 'Video Interest',
      value: `${Math.round(es?.video_testimonial_interest_pct ?? data.video_testimonial?.interested_pct ?? 0)}%`,
      icon: Video,
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <kpi.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground truncate">
                {kpi.isText ? kpi.value : Number(kpi.value).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
