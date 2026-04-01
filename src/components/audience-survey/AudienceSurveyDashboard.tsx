import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { AudienceSurveyInsightData } from '@/types/research-insights';
import { AudienceSurveyExecutiveSummary } from './AudienceSurveyExecutiveSummary';
import { AudienceSurveyKPIRow } from './AudienceSurveyKPIRow';
import { PlatformBreakdownChart } from './PlatformBreakdownChart';
import { AdAwarenessPanel } from './AdAwarenessPanel';
import { AdPreferencesPanel } from './AdPreferencesPanel';
import { FirstImpressionsPanel } from './FirstImpressionsPanel';
import { RankedItemsTable } from './RankedItemsTable';
import { AudienceSegmentsPanel } from './AudienceSegmentsPanel';
import { AudienceRecommendationsPanel } from './RecommendationsPanel';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';

type TabValue = 'media' | 'engagement' | 'strategy';

interface Props {
  data: AudienceSurveyInsightData;
}

export function AudienceSurveyDashboard({ data }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabValue) || 'media';
  const setTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  const attentionTriggers = data.content_preferences?.stop_scrolling_triggers?.map(t => ({
    label: t.trigger, count: t.count, percentage: 0,
  })) ?? [];
  const clickMotivators = data.content_preferences?.click_motivations?.map(m => ({
    label: m.motivation, count: m.count, percentage: 0,
  })) ?? [];

  // Compute percentages relative to max
  const maxTrigger = Math.max(...attentionTriggers.map(t => t.count), 1);
  attentionTriggers.forEach(t => { t.percentage = Math.round((t.count / maxTrigger) * 100); });
  const maxMotivator = Math.max(...clickMotivators.map(m => m.count), 1);
  clickMotivators.forEach(m => { m.percentage = Math.round((m.count / maxMotivator) * 100); });

  return (
    <div className="space-y-6">
      {data.executive_summary && (
        <AudienceSurveyExecutiveSummary data={data.executive_summary} />
      )}

      <AudienceSurveyKPIRow data={data} />

      <Tabs value={currentTab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="media">Media &amp; Platforms</TabsTrigger>
          <TabsTrigger value="engagement">Ad Engagement</TabsTrigger>
          <TabsTrigger value="strategy">Strategy &amp; Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="media" className="space-y-6 mt-6">
          {data.platform_breakdown && (
            <PlatformBreakdownChart data={data.platform_breakdown} />
          )}
          {data.influencer_insights && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Influencer Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-foreground">
                    {data.influencer_insights.follows_influencers_pct != null
                      ? `${Math.round(data.influencer_insights.follows_influencers_pct)}%`
                      : '—'}
                  </div>
                  <p className="text-sm text-muted-foreground">follow influencers or content creators</p>
                </div>
                {data.influencer_insights.notable_influencers && data.influencer_insights.notable_influencers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.influencer_insights.notable_influencers.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {data.ad_awareness && (
            <AdAwarenessPanel data={data.ad_awareness} />
          )}
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6 mt-6">
          {(attentionTriggers.length > 0 || clickMotivators.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {attentionTriggers.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Attention Triggers</CardTitle>
                    <p className="text-xs text-muted-foreground">What makes members stop scrolling</p>
                  </CardHeader>
                  <CardContent>
                    <RankedItemsTable items={attentionTriggers} barColor="hsl(var(--primary))" />
                  </CardContent>
                </Card>
              )}
              {clickMotivators.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Click Motivators</CardTitle>
                    <p className="text-xs text-muted-foreground">What drives members to click</p>
                  </CardHeader>
                  <CardContent>
                    <RankedItemsTable items={clickMotivators} barColor="hsl(var(--accent-foreground))" />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {data.first_impressions && (
            <FirstImpressionsPanel data={data.first_impressions} />
          )}
          {data.content_preferences && (
            <AdPreferencesPanel data={data.content_preferences} />
          )}
        </TabsContent>

        <TabsContent value="strategy" className="space-y-6 mt-6">
          {data.audience_segments && (
            <AudienceSegmentsPanel data={data.audience_segments} />
          )}
          {data.recommendations && (
            <AudienceRecommendationsPanel data={data.recommendations} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
