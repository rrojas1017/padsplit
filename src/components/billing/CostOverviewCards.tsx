import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, FileCheck, Mic } from 'lucide-react';
import { formatCurrency } from '@/utils/billingCalculations';
import { CostSummary, ApiCost } from '@/hooks/useBillingData';
import { SOWPricingConfig, getApplicableRate } from '@/utils/billingCalculations';
import { DateFilterValue } from '@/components/dashboard/DateRangeFilter';

interface CostOverviewCardsProps {
  summary: CostSummary;
  costs: ApiCost[];
  dateRange: DateFilterValue;
  sowPricing: SOWPricingConfig[];
}

const CostOverviewCards = ({ summary, costs, dateRange, sowPricing }: CostOverviewCardsProps) => {
  // Calculate billable revenue from SOW pricing
  const totalVolume = summary.voiceRecordCount + summary.textRecordCount;
  
  const getRate = (category: string) => {
    const config = sowPricing.find(p => p.service_category === category);
    if (!config) return 0;
    return getApplicableRate(config, totalVolume);
  };

  const billableRevenue = 
    summary.voiceRecordCount * getRate('voice_processing') +
    summary.textRecordCount * getRate('text_processing') +
    
    summary.emailDeliveryCount * getRate('email_delivery') +
    summary.smsDeliveryCount * getRate('sms_delivery') +
    summary.telephonyMinutes * getRate('telephony');

  const margin = billableRevenue - summary.totalCost;
  const marginPercent = billableRevenue > 0 ? (margin / billableRevenue) * 100 : 0;

  const cards = [
    {
      title: 'Billable Revenue',
      value: formatCurrency(billableRevenue),
      subtitle: `${summary.voiceRecordCount + summary.textRecordCount} records processed`,
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Internal Cost',
      value: formatCurrency(summary.totalCost),
      subtitle: `${costs.length} API calls`,
      icon: FileCheck,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Margin',
      value: formatCurrency(margin),
      subtitle: `${marginPercent.toFixed(1)}% margin`,
      icon: TrendingUp,
      color: margin >= 0 ? 'text-emerald-500' : 'text-destructive',
      bgColor: margin >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10',
    },
    {
      title: 'Records Breakdown',
      value: `${summary.voiceRecordCount + summary.textRecordCount}`,
      subtitle: `${summary.voiceRecordCount} voice · ${summary.textRecordCount} text`,
      icon: Mic,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CostOverviewCards;
