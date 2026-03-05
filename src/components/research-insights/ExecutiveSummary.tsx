import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, DollarSign, Home, Users, Heart } from 'lucide-react';

interface ExecutiveSummaryProps {
  data: {
    total_cases: number;
    date_range: string;
    addressable_pct: number;
    non_addressable_pct: number;
    partially_addressable_pct: number;
    avg_preventability_score: number;
    high_regret_count: number;
    high_regret_pct: number;
    payment_related_pct: number;
    host_related_pct: number;
    roommate_related_pct: number;
    life_event_pct: number;
    headline: string;
  };
}

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const stats = [
    { label: 'Total Cases', value: data.total_cases, icon: Users, color: 'text-primary' },
    { label: 'Addressable', value: `${data.addressable_pct?.toFixed(0)}%`, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Avg Preventability', value: `${data.avg_preventability_score?.toFixed(1)}/10`, icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'High Regret', value: `${data.high_regret_count} (${data.high_regret_pct?.toFixed(0)}%)`, icon: Heart, color: 'text-destructive' },
    { label: 'Payment Related', value: `${data.payment_related_pct?.toFixed(0)}%`, icon: DollarSign, color: 'text-blue-500' },
    { label: 'Host Related', value: `${data.host_related_pct?.toFixed(0)}%`, icon: Home, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <p className="text-lg font-semibold text-foreground leading-relaxed">{data.headline}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="outline">{data.date_range}</Badge>
          {data.life_event_pct > 0 && (
            <Badge variant="secondary">Life Events: {data.life_event_pct?.toFixed(0)}%</Badge>
          )}
          {data.roommate_related_pct > 0 && (
            <Badge variant="secondary">Roommate: {data.roommate_related_pct?.toFixed(0)}%</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="p-4 text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
