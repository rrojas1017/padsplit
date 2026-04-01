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
import { AudienceSegmentsPanel } from './AudienceSegmentsPanel';
import { AudienceRecommendationsPanel } from './RecommendationsPanel';
import { useSearchParams } from 'react-router-dom';

type TabValue = 'overview' | 'engagement' | 'strategy';

interface Props {
  data: AudienceSurveyInsightData;
}

export function AudienceSurveyDashboard({ data }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabValue) || 'overview';
  const setTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="space-y-6">
      <AudienceSurveyKPIRow data={data} />

      <Tabs value={currentTab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {data.executive_summary && (
            <AudienceSurveyExecutiveSummary data={data.executive_summary} />
          )}
          {data.platform_breakdown && (
            <PlatformBreakdownChart data={data.platform_breakdown} />
          )}
          {data.ad_awareness && (
            <AdAwarenessPanel data={data.ad_awareness} />
          )}
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6 mt-6">
          {data.content_preferences && (
            <AdPreferencesPanel data={data.content_preferences} />
          )}
          {data.first_impressions && (
            <FirstImpressionsPanel data={data.first_impressions} />
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
