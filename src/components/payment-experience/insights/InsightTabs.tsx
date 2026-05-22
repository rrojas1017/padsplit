import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PaymentExperienceOverviewTab } from './tabs/PaymentExperienceOverviewTab';
import { PaymentScheduleTab } from './tabs/PaymentScheduleTab';
import { MethodOfPaymentTab } from './tabs/MethodOfPaymentTab';
import { AutopayTab } from './tabs/AutopayTab';
import { SentimentFrustrationTab } from './tabs/SentimentFrustrationTab';
import { PaymentOptionsTab } from './tabs/PaymentOptionsTab';
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

type TabKey =
  | 'overview'
  | 'payment-schedule'
  | 'method-of-payment'
  | 'autopay'
  | 'sentiment-frustration'
  | 'payment-options'
  | 'script-responses';

interface InsightTabsProps {
  // Kept for backward-compat with the dashboard call site; no longer rendered
  // by the topic tabs but preserved so the parent component is unchanged.
  kpis?: PaymentKPIs;
  topFrictionThemes?: FrictionThemeAgg[];
  frictionSummary?: FrictionSummary;
  autopayBarriers?: AutopayBarrierAgg[];
  emergingRisks?: EmergingRisk[];
  keyDrivers?: DriverInsight[];
  segments?: SegmentCard[];
  suggestedActions?: SuggestedAction[];
  records: PaymentExperienceRecord[];
  eligibleRecords: PaymentExperienceRecord[];
}

const TRIGGER_CLASS =
  'gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-5 py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none';

export function InsightTabs({ records, eligibleRecords }: InsightTabsProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const totalRouted = records.length;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full mt-1">
      <TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0 mb-1 overflow-x-auto">
        <TabsTrigger value="overview" className={TRIGGER_CLASS}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="payment-schedule" className={TRIGGER_CLASS}>
          Payment Schedule
        </TabsTrigger>
        <TabsTrigger value="method-of-payment" className={TRIGGER_CLASS}>
          Method of Payment
        </TabsTrigger>
        <TabsTrigger value="autopay" className={TRIGGER_CLASS}>
          Autopay
        </TabsTrigger>
        <TabsTrigger value="sentiment-frustration" className={TRIGGER_CLASS}>
          Sentiment / Frustration
        </TabsTrigger>
        <TabsTrigger value="payment-options" className={TRIGGER_CLASS}>
          Payment Options
        </TabsTrigger>
        <TabsTrigger value="script-responses" className={TRIGGER_CLASS}>
          Script Responses
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-medium tabular-nums">
            {eligibleRecords.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-2">
        <PaymentExperienceOverviewTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>

      <TabsContent value="payment-schedule" className="mt-2">
        <PaymentScheduleTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>

      <TabsContent value="method-of-payment" className="mt-2">
        <MethodOfPaymentTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>

      <TabsContent value="autopay" className="mt-2">
        <AutopayTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>

      <TabsContent value="sentiment-frustration" className="mt-2">
        <SentimentFrustrationTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>

      <TabsContent value="payment-options" className="mt-2">
        <PaymentOptionsTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>

      <TabsContent value="script-responses" className="mt-2">
        <ScriptResponsesTab eligibleRecords={eligibleRecords} totalRouted={totalRouted} />
      </TabsContent>
    </Tabs>
  );
}
