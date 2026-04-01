import { Card, CardContent } from '@/components/ui/card';
import { Users, Eye, Hash, MousePointerClick, Video } from 'lucide-react';
import type { AudienceSurveyInsightData } from '@/types/research-insights';

interface Props {
  data: AudienceSurveyInsightData;
}

export function AudienceSurveyKPIRow({ data }: Props) {
  const es = data.executive_summary;

  // Derive top click motivator from content_preferences
  const topClickMotivator =
    data.content_preferences?.click_motivations?.[0]?.motivation ||
    data.content_preferences?.stop_scrolling_triggers?.[0]?.trigger ||
    '—';

  const kpis = [
    {
      label: 'Total Responses',
      value: String(es?.total_responses || 0),
      icon: Users,
      color: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      label: 'Ad Awareness',
      value: `${Math.round(es?.padsplit_ad_awareness_pct ?? data.ad_awareness?.seen_padsplit_ads_pct ?? 0)}%`,
      icon: Eye,
      color: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Top Platform',
      value: es?.top_platform || data.platform_breakdown?.[0]?.platform || '—',
      icon: Hash,
      color: 'bg-sky-500/10 text-sky-600',
    },
    {
      label: 'Top Click Motivator',
      value: topClickMotivator.length > 20 ? topClickMotivator.slice(0, 18) + '…' : topClickMotivator,
      icon: MousePointerClick,
      color: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Video Interest',
      value: `${Math.round(es?.video_testimonial_interest_pct ?? data.video_testimonial?.interested_pct ?? 0)}%`,
      icon: Video,
      color: 'bg-rose-500/10 text-rose-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground truncate">{kpi.value}</p>
              <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
