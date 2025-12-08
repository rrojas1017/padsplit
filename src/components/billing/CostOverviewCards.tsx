import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, FileCheck, Timer } from 'lucide-react';
import { formatCurrency } from '@/utils/billingCalculations';
import { CostSummary, ApiCost } from '@/hooks/useBillingData';
import { DateFilterValue } from '@/components/dashboard/DateRangeFilter';

interface CostOverviewCardsProps {
  summary: CostSummary;
  costs: ApiCost[];
  dateRange: DateFilterValue;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const CostOverviewCards = ({ summary, costs, dateRange }: CostOverviewCardsProps) => {
  const cards = [
    {
      title: 'Total Raw Cost',
      value: formatCurrency(summary.totalCost),
      subtitle: `${costs.length} API calls`,
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Bookings Processed',
      value: summary.uniqueBookingsProcessed.toString(),
      subtitle: summary.uniqueBookingsProcessed > 0 
        ? `${formatCurrency(summary.costPerBooking)}/booking`
        : 'No bookings yet',
      icon: FileCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Talk Time Processed',
      value: formatDuration(summary.totalTalkTimeSeconds),
      subtitle: summary.totalTalkTimeSeconds > 0 
        ? `${formatCurrency(summary.costPerMinute)}/min`
        : 'No audio processed',
      icon: Timer,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Cost Per Booking',
      value: summary.uniqueBookingsProcessed > 0 
        ? formatCurrency(summary.costPerBooking) 
        : '—',
      subtitle: summary.uniqueBookingsProcessed > 0 
        ? 'Avg across all services'
        : 'Process bookings to see',
      icon: Clock,
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
