import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from './tabs/OverviewTab';
import { DriversTab } from './tabs/DriversTab';
import { SegmentsTab } from './tabs/SegmentsTab';
import { ActionsTab } from './tabs/ActionsTab';
import type {
  DriverInsight,
  EmergingRisk,
  SegmentCard,
  SuggestedAction,
} from '@/utils/paymentExperienceAnalytics';
import type {
  AutopayBarrierAgg,
  FrictionSummary,
  FrictionThemeAgg,
  PaymentKPIs,
} from '@/hooks/usePaymentExperienceResponses';

type TabKey = 'overview' | 'drivers' | 'segments' | 'actions';

interface InsightTabsProps {
  kpis: PaymentKPIs;
  topFrictionThemes: FrictionThemeAgg[];
  frictionSummary: FrictionSummary;
  autopayBarriers: AutopayBarrierAgg[];
  emergingRisks: EmergingRisk[];
  keyDrivers: DriverInsight[];
  segments: SegmentCard[];
  suggestedActions: SuggestedAction[];
}

const TRIGGER_CLASS =
  'gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-5 py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none';

export function InsightTabs({
  kpis,
  topFrictionThemes,
  frictionSummary,
  autopayBarriers,
  emergingRisks,
  keyDrivers,
  segments,
  suggestedActions,
}: InsightTabsProps) {
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full mt-1">
      <TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0 mb-1 overflow-x-auto">
        <TabsTrigger value="overview" className={TRIGGER_CLASS}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="drivers" className={TRIGGER_CLASS}>
          Drivers &amp; Friction
        </TabsTrigger>
        <TabsTrigger value="segments" className={TRIGGER_CLASS}>
          Segments
        </TabsTrigger>
        <TabsTrigger value="actions" className={TRIGGER_CLASS}>
          Actions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-2">
        <OverviewTab
          emergingRisks={emergingRisks}
          suggestedActions={suggestedActions}
          autopayBarriers={autopayBarriers}
          segments={segments}
          keyDrivers={keyDrivers}
        />
      </TabsContent>

      <TabsContent value="drivers" className="mt-2">
        <DriversTab
          kpis={kpis}
          topFrictionThemes={topFrictionThemes}
          frictionSummary={frictionSummary}
          autopayBarriers={autopayBarriers}
          keyDrivers={keyDrivers}
        />
      </TabsContent>

      <TabsContent value="segments" className="mt-2">
        <SegmentsTab segments={segments} />
      </TabsContent>

      <TabsContent value="actions" className="mt-2">
        <ActionsTab actions={suggestedActions} />
      </TabsContent>
    </Tabs>
  );
}
