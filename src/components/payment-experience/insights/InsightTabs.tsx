import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { OverviewTab } from './tabs/OverviewTab';
import { DriversTab } from './tabs/DriversTab';
import { SegmentsTab } from './tabs/SegmentsTab';
import { ActionsTab } from './tabs/ActionsTab';
import { ScriptResponsesTab } from './tabs/ScriptResponsesTab';
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
  PaymentExperienceRecord,
  PaymentKPIs,
} from '@/hooks/usePaymentExperienceResponses';

type TabKey = 'overview' | 'drivers' | 'segments' | 'actions' | 'script-responses';

interface InsightTabsProps {
  kpis: PaymentKPIs;
  topFrictionThemes: FrictionThemeAgg[];
  frictionSummary: FrictionSummary;
  autopayBarriers: AutopayBarrierAgg[];
  emergingRisks: EmergingRisk[];
  keyDrivers: DriverInsight[];
  segments: SegmentCard[];
  suggestedActions: SuggestedAction[];
  records: PaymentExperienceRecord[];
  eligibleRecords: PaymentExperienceRecord[];
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
  records,
  eligibleRecords,
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
        <TabsTrigger value="script-responses" className={TRIGGER_CLASS}>
          Script Responses
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-medium tabular-nums">
            {eligibleRecords.length}
          </Badge>
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

      <TabsContent value="script-responses" className="mt-2">
        <ScriptResponsesTab eligibleRecords={eligibleRecords} totalRouted={records.length} />
      </TabsContent>
    </Tabs>
  );
}
