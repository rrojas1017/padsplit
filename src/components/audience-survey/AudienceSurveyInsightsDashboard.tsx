import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Eye, MessageSquare, ShieldAlert, Palette, Video, LayoutDashboard, Users, Megaphone, Target, TrendingUp } from 'lucide-react';
import { useAudienceSurveyResponses } from '@/hooks/useAudienceSurveyResponses';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { PlatformGapChart } from './PlatformGapChart';
import { AdExposureDonut } from './AdExposureDonut';
import { MessagingMatrix } from './MessagingMatrix';
import { BarrierAnalysis } from './BarrierAnalysis';
import { CreativeStrategy } from './CreativeStrategy';
import { TestimonialPipeline } from './TestimonialPipeline';

type TabValue = 'overview' | 'platforms' | 'awareness' | 'messaging' | 'barriers' | 'creative' | 'testimonials';

export function AudienceSurveyInsightsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('stab') as TabValue) || 'overview';
  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('stab', tab);
    setSearchParams(params, { replace: true });
  };

  const { records, isLoading, refetch, aggregateArray, aggregateSingle, aggregateBoolean, crossTab } = useAudienceSurveyResponses();
  const { isAdmin } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Audience Survey Data</h3>
          <p className="text-sm text-muted-foreground">Survey responses will appear here after calls are processed.</p>
        </CardContent>
      </Card>
    );
  }

  // Aggregations
  const platformUsage = aggregateArray(records, r => r.extraction.social_media_platforms?.platforms_used);
  const adPrefPlatforms = aggregateArray(records, r => r.extraction.ad_awareness?.expected_padsplit_ad_platforms);
  const triggers = aggregateArray(records, r => r.extraction.ad_engagement?.what_makes_them_stop_scrolling);
  const motivators = aggregateArray(records, r => r.extraction.ad_engagement?.what_makes_them_click_ad);
  const concerns = aggregateArray(records, r => r.extraction.first_impressions?.initial_concerns);
  const interests = aggregateArray(records, r => r.extraction.first_impressions?.interest_drivers);
  const confusion = aggregateArray(records, r => r.extraction.first_impressions?.confusing_aspects);
  const detailPref = aggregateArray(records, r => r.extraction.ad_engagement?.ad_detail_preferences);
  const desiredContent = aggregateArray(records, r => r.extraction.ad_engagement?.preferred_content_types);

  const adRecall = aggregateBoolean(records, r => r.extraction.ad_awareness?.has_seen_padsplit_ads);
  const testimonialOptIn = aggregateBoolean(records, r => r.extraction.video_testimonial?.interested_in_recording);

  const topPlatform = platformUsage[0]?.label || 'N/A';
  const topMotivator = motivators[0]?.label || 'N/A';
  const topConcern = concerns[0]?.label || 'N/A';
  const topInterest = interests[0]?.label || 'N/A';

  // Cross-tab for messaging
  const motivatorPlatformCrossTab = crossTab(
    records,
    r => r.extraction.ad_engagement?.what_makes_them_click_ad,
    r => r.extraction.social_media_platforms?.platforms_used,
  );

  // Completion rate from questions_covered_estimate
  const withEstimate = records.filter(r => (r.extraction.agent_observations?.questions_covered_estimate ?? 0) > 0);
  const avgCoverage = withEstimate.length > 0
    ? Math.round(withEstimate.reduce((s, r) => s + (r.extraction.agent_observations?.questions_covered_estimate || 0), 0) / withEstimate.length)
    : 0;

  const kpis = [
    { label: 'Total Responses', value: records.length, icon: Users, color: 'text-primary' },
    { label: 'Avg Questions Covered', value: avgCoverage > 0 ? `${avgCoverage}` : '—', icon: Target, color: 'text-blue-600' },
    { label: 'Top Platform', value: topPlatform, icon: Megaphone, color: 'text-purple-600' },
    { label: 'Ad Recall Rate', value: `${adRecall.pct}%`, icon: Eye, color: 'text-amber-600' },
    { label: '#1 Click Motivator', value: topMotivator.length > 25 ? topMotivator.slice(0, 22) + '...' : topMotivator, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Testimonial Opt-In', value: `${testimonialOptIn.pct}%`, icon: Video, color: 'text-pink-600' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground truncate" title={String(kpi.value)}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={currentTab} onValueChange={setTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="platforms" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Platforms
          </TabsTrigger>
          <TabsTrigger value="awareness" className="gap-1.5 text-xs">
            <Eye className="w-3.5 h-3.5" /> Ad Awareness
          </TabsTrigger>
          <TabsTrigger value="messaging" className="gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" /> Messaging
          </TabsTrigger>
          <TabsTrigger value="barriers" className="gap-1.5 text-xs">
            <ShieldAlert className="w-3.5 h-3.5" /> Barriers
          </TabsTrigger>
          <TabsTrigger value="creative" className="gap-1.5 text-xs">
            <Palette className="w-3.5 h-3.5" /> Creative
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="gap-1.5 text-xs">
            <Video className="w-3.5 h-3.5" /> Testimonials
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <PlatformGapChart platformUsage={platformUsage.slice(0, 6)} adPreference={adPrefPlatforms.slice(0, 6)} />
          <AdExposureDonut records={records} />
          {triggers.length > 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-2">Top Scroll-Stoppers</p>
                <div className="flex flex-wrap gap-2">
                  {triggers.slice(0, 5).map(t => (
                    <Badge key={t.label} variant="secondary">{t.label} ({t.count})</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Platforms */}
        <TabsContent value="platforms" className="space-y-6 mt-6">
          <PlatformGapChart platformUsage={platformUsage} adPreference={adPrefPlatforms} />
        </TabsContent>

        {/* Ad Awareness */}
        <TabsContent value="awareness" className="space-y-6 mt-6">
          <AdExposureDonut records={records} />
        </TabsContent>

        {/* Messaging */}
        <TabsContent value="messaging" className="space-y-6 mt-6">
          <MessagingMatrix
            triggers={triggers}
            motivators={motivators}
            topPlatform={topPlatform}
            records={records}
            crossTabData={motivatorPlatformCrossTab}
          />
        </TabsContent>

        {/* Barriers */}
        <TabsContent value="barriers" className="space-y-6 mt-6">
          <BarrierAnalysis concerns={concerns} interests={interests} confusion={confusion} />
        </TabsContent>

        {/* Creative */}
        <TabsContent value="creative" className="space-y-6 mt-6">
          <CreativeStrategy
            detailPref={detailPref}
            desiredContent={desiredContent}
            topMotivator={topMotivator}
            topInterest={topInterest}
            topConcern={topConcern}
          />
        </TabsContent>

        {/* Testimonials */}
        <TabsContent value="testimonials" className="space-y-6 mt-6">
          <TestimonialPipeline records={records} isAdmin={isAdmin} onRefetch={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
