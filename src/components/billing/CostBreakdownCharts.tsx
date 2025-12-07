import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { CostSummary } from '@/hooks/useBillingData';
import { formatCurrency, SERVICE_TYPE_LABELS } from '@/utils/billingCalculations';

interface CostBreakdownChartsProps {
  summary: CostSummary;
}

const PROVIDER_COLORS = {
  elevenlabs: 'hsl(45, 93%, 47%)',
  lovable_ai: 'hsl(270, 70%, 60%)',
};

const SERVICE_COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(45, 93%, 47%)',
  'hsl(270, 70%, 60%)',
  'hsl(160, 60%, 45%)',
  'hsl(350, 70%, 55%)',
  'hsl(200, 70%, 50%)',
];

const CostBreakdownCharts = ({ summary }: CostBreakdownChartsProps) => {
  // Provider pie chart data
  const providerData = Object.entries(summary.byProvider).map(([provider, cost]) => ({
    name: provider === 'elevenlabs' ? 'ElevenLabs' : 'Lovable AI',
    value: cost,
    color: PROVIDER_COLORS[provider as keyof typeof PROVIDER_COLORS] || 'hsl(var(--muted))',
  }));

  // Service type bar chart data
  const serviceData = Object.entries(summary.byServiceType)
    .map(([type, cost]) => ({
      name: SERVICE_TYPE_LABELS[type] || type,
      shortName: type.replace('ai_', '').replace('tts_', '').replace('stt_', ''),
      cost,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 6);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cost Breakdown by Provider</CardTitle>
      </CardHeader>
      <CardContent>
        {providerData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={providerData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {providerData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No cost data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CostBreakdownCharts;
