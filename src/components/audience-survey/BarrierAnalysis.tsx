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

const BARRIER_BENEFIT_MAP: Record<string, { interest: string; recommendation: string }> = {
  'Safety & Security': {
    interest: 'Community of Roommates',
    recommendation: 'Lead with verified hosts, background checks, and secure properties in ads',
  },
  'Quality of Rooms/Houses': {
    interest: 'Location Options',
    recommendation: 'Show real HD room photos + video walkthroughs to prove quality',
  },
  'Roommate Concerns': {
    interest: 'Community of Roommates',
    recommendation: 'Reframe "strangers as roommates" → "joining a vetted community"',
  },
  'Price & Fees': {
    interest: 'Affordable Rent',
    recommendation: 'Price comparison vs average 1BR apartment in same area',
  },
  'How It Works': {
    interest: 'Quick Move-In',
    recommendation: 'Simplify: show 3-step process (Apply → Approve → Move In) in ads',
  },
  'Lease Flexibility': {
    interest: 'Flexibility',
    recommendation: 'Highlight no long-term lease, weekly payments, flexibility to move',
  },
  'How Payments Work': {
    interest: 'Utilities Included',
    recommendation: 'Explain: one weekly payment covers rent + utilities, auto-deducted',
  },
  "What's Included in Rent": {
    interest: 'Utilities Included',
    recommendation: "List what's included: WiFi, utilities, furnished room, cleaning",
  },
  'Roommate Matching': {
    interest: 'Community of Roommates',
    recommendation: 'Explain the roommate vetting process and house rules',
  },
  'Location Options': {
    interest: 'Location Options',
    recommendation: "Showcase interactive map of available rooms in member's area",
  },
};

export function BarrierAnalysis({ concerns, interests, confusion }: Props) {
  const insight = generateBarrierInsight(concerns, interests, confusion);

  // Butterfly chart data — labels are already normalized from aggregation
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
  const confusionFiltered = confusion.filter(c => c.label !== 'Nothing Was Confusing');
  const nothingConfusing = confusion.find(c => c.label === 'Nothing Was Confusing');

  // Barrier-to-benefit mapping using exact-match map, filtered to significant concerns
  const significantConcerns = concerns.filter(c => c.count >= 2);
  const mappings = significantConcerns.slice(0, 8).map(concern => {
    const map = BARRIER_BENEFIT_MAP[concern.label];
    const matchedInterest = map ? interests.find(i => i.label === map.interest) : null;
    return {
      concern: concern.label,
      concernCount: concern.count,
      interest: matchedInterest?.label || map?.interest || '—',
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
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded bg-red-500" />
                <span className="text-sm text-muted-foreground">Concerns (barriers)</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded bg-green-500" />
                <span className="text-sm text-muted-foreground">Interest Drivers (pull factors)</span>
              </div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={butterflyData} layout="vertical" margin={{ left: 10, right: 20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => Math.abs(v).toString()}
                    label={{ value: '← Concerns          Interest Drivers →', position: 'bottom', offset: 10, style: { fontSize: 12, fill: '#6b7280' } }}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={180}
                    tickFormatter={(val: string) => val.length > 22 ? val.substring(0, 22) + '…' : val}
                  />
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
                <span className="text-sm text-foreground">found nothing confusing about PadSplit</span>
              </div>
            )}
            <div className="space-y-2">
              {confusionFiltered.slice(0, 6).map((c) => (
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
