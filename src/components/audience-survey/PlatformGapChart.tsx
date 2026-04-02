import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AggResult } from '@/hooks/useAudienceSurveyResponses';
import { generatePlatformInsight } from '@/utils/audienceSurveyInsights';
import { Monitor } from 'lucide-react';

interface Props {
  platformUsage: AggResult[];
  adPreference: AggResult[];
}

export function PlatformGapChart({ platformUsage, adPreference }: Props) {
  const allLabels = new Set([...platformUsage.map(p => p.label), ...adPreference.map(p => p.label)]);
  const chartData = Array.from(allLabels).map(label => ({
    platform: label,
    'Currently Uses': platformUsage.find(p => p.label === label)?.count || 0,
    'Wants Ads Here': adPreference.find(p => p.label === label)?.count || 0,
  })).sort((a, b) => b['Currently Uses'] - a['Currently Uses']);

  const insight = generatePlatformInsight(platformUsage, adPreference);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          Platform Gap Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground">Where members are vs where they want PadSplit ads</p>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis dataKey="platform" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={95} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Bar dataKey="Currently Uses" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Wants Ads Here" fill="#d97706" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-muted-foreground italic">{insight}</p>
      </CardContent>
    </Card>
  );
}
