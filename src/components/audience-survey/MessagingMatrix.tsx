import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Star } from 'lucide-react';
import type { AggResult, AudienceSurveyRecord } from '@/hooks/useAudienceSurveyResponses';
import { generateMessagingInsight, DISTINCT_COLORS } from '@/utils/audienceSurveyInsights';

interface Props {
  triggers: AggResult[];
  motivators: AggResult[];
  topPlatform: string;
  records: AudienceSurveyRecord[];
  crossTabData: Record<string, Record<string, number>>;
}

export function MessagingMatrix({ triggers, motivators, topPlatform, records, crossTabData }: Props) {
  const insight = generateMessagingInsight(triggers, motivators, topPlatform);

  const motivatorChartData = motivators.slice(0, 10).map((m, i) => ({
    ...m,
    fill: DISTINCT_COLORS[i % DISTINCT_COLORS.length],
  }));

  // Get top platforms for heatmap
  const platforms = [...new Set(records.flatMap(r => r.extraction.social_media_platforms?.platforms_used || []))].slice(0, 6);
  const topMotivators = motivators.slice(0, 6).map(m => m.label);

  return (
    <div className="space-y-6">
      {/* Attention Triggers */}
      {triggers.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              What Stops the Scroll
            </CardTitle>
            <p className="text-xs text-muted-foreground">Ad attention triggers ranked by frequency</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {triggers.slice(0, 8).map((t, i) => (
                <div key={t.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.count} ({t.pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(t.count / (triggers[0]?.count || 1)) * 100}%`,
                          backgroundColor: DISTINCT_COLORS[i % DISTINCT_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Click Motivators */}
      {motivators.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Click Motivation Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={motivatorChartData} layout="vertical" margin={{ left: 140, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={135} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {motivatorChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cross-Tab Heatmap */}
      {platforms.length > 0 && topMotivators.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Motivation × Platform Heatmap</CardTitle>
            <p className="text-xs text-muted-foreground">Which motivators resonate on which platforms</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 text-muted-foreground">Motivator</th>
                  {platforms.map(p => (
                    <th key={p} className="text-center p-2 text-muted-foreground">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topMotivators.map(mot => (
                  <tr key={mot} className="border-t border-border">
                    <td className="p-2 text-foreground font-medium">{mot}</td>
                    {platforms.map(plat => {
                      const val = crossTabData[mot]?.[plat] || 0;
                      const maxVal = Math.max(...topMotivators.flatMap(m => platforms.map(p => crossTabData[m]?.[p] || 0)), 1);
                      const intensity = val / maxVal;
                      return (
                        <td key={plat} className="text-center p-2">
                          <div
                            className="inline-flex items-center justify-center w-8 h-8 rounded text-xs font-medium"
                            style={{
                              backgroundColor: val > 0 ? `rgba(37, 99, 235, ${0.1 + intensity * 0.6})` : 'transparent',
                              color: intensity > 0.4 ? 'white' : 'hsl(var(--foreground))',
                            }}
                          >
                            {val || '—'}
                          </div>
                        </td>
                      );
                    })}
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

// Need Cell import
import { Cell } from 'recharts';
