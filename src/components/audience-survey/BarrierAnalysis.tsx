import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Lightbulb } from 'lucide-react';
import type { AggResult } from '@/hooks/useAudienceSurveyResponses';
import { generateBarrierInsight } from '@/utils/audienceSurveyInsights';

interface Props {
  concerns: AggResult[];
  interests: AggResult[];
  confusion: AggResult[];
}

const BARRIER_MAP: Record<string, { interest: string; recommendation: string }> = {
  'safety': { interest: 'affordable rent', recommendation: 'Lead with safety messaging alongside pricing' },
  'security': { interest: 'affordable rent', recommendation: 'Lead with safety messaging alongside pricing' },
  'quality': { interest: 'affordable rent', recommendation: 'Show quality rooms + competitive price together' },
  'roommate': { interest: 'community', recommendation: 'Reframe roommates as a positive community' },
  'price': { interest: 'affordable rent', recommendation: 'Price comparison vs apartment rentals' },
  'how it': { interest: 'move in quickly', recommendation: 'Simplify the process explanation in ads' },
  'fees': { interest: 'affordable rent', recommendation: 'Transparent pricing breakdown upfront' },
};

export function BarrierAnalysis({ concerns, interests, confusion }: Props) {
  const insight = generateBarrierInsight(concerns, interests, confusion);

  // Butterfly chart data — labels are already formatted from parent
  const allLabels = [...new Set([...concerns.map(c => c.label), ...interests.map(i => i.label)])];
  const butterflyData = allLabels.slice(0, 8).map(label => {
    const concern = concerns.find(c => c.label === label);
    const interest = interests.find(i => i.label === label);
    return {
      label,
      concern: concern ? -concern.count : 0,
      interest: interest ? interest.count : 0,
    };
  }).sort((a, b) => Math.abs(b.concern) + b.interest - Math.abs(a.concern) - a.interest);

  // Confusion points (excluding "nothing")
  const confusionFiltered = confusion.filter(c => !c.label.toLowerCase().includes('nothing'));
  const nothingConfusing = confusion.find(c => c.label.toLowerCase().includes('nothing'));

  // Barrier-to-benefit mapping
  const mappings = concerns.slice(0, 6).map(concern => {
    const key = Object.keys(BARRIER_MAP).find(k => concern.label.toLowerCase().includes(k));
    const map = key ? BARRIER_MAP[key] : null;
    const matchedInterest = map ? interests.find(i => i.label.toLowerCase().includes(map.interest)) : null;
    return {
      concern: concern.label,
      concernCount: concern.count,
      interest: matchedInterest?.label || '—',
      interestCount: matchedInterest?.count || 0,
      recommendation: map?.recommendation || 'Address this concern directly in ad copy',
    };
  });

  return (
    <div className="space-y-6">
      {/* Butterfly Chart */}
      {butterflyData.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Concerns vs Interest Drivers
            </CardTitle>
            <p className="text-xs text-muted-foreground">Push factors (left) vs pull factors (right)</p>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={butterflyData} layout="vertical" margin={{ left: 120, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={115} />
                  <Tooltip formatter={(v: number) => Math.abs(v)} />
                  <ReferenceLine x={0} className="stroke-border" />
                  <Bar dataKey="concern" name="Concerns" fill="#dc2626" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="interest" name="Interest" fill="#65a30d" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confusion Points */}
      {(confusionFiltered.length > 0 || nothingConfusing) && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Confusion Points</CardTitle>
          </CardHeader>
          <CardContent>
            {nothingConfusing && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
                <Badge className="bg-green-500/20 text-green-700 border-0">{nothingConfusing.pct}%</Badge>
                <span className="text-sm text-foreground">found nothing confusing</span>
              </div>
            )}
            <div className="space-y-2">
              {confusionFiltered.slice(0, 6).map((c, i) => (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.count} ({c.pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(c.count / (confusionFiltered[0]?.count || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barrier-to-Benefit Mapping */}
      {mappings.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              Barrier-to-Benefit Mapping
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Concern</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">#</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Counteracting Interest</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">#</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Messaging Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m.concern} className="border-b border-border/50">
                    <td className="p-2 text-foreground">{m.concern}</td>
                    <td className="p-2 text-center text-muted-foreground">{m.concernCount}</td>
                    <td className="p-2 text-foreground">{m.interest}</td>
                    <td className="p-2 text-center text-muted-foreground">{m.interestCount || '—'}</td>
                    <td className="p-2 text-xs text-muted-foreground">{m.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground italic px-1">{insight}</p>
    </div>
  );
}
