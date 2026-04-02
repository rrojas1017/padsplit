import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Palette, FileText } from 'lucide-react';
import type { AggResult } from '@/hooks/useAudienceSurveyResponses';
import { generateCreativeBrief, DISTINCT_COLORS } from '@/utils/audienceSurveyInsights';

interface Props {
  detailPref: AggResult[];
  desiredContent: AggResult[];
  topMotivator: string;
  topInterest: string;
  topConcern: string;
}

export function CreativeStrategy({ detailPref, desiredContent, topMotivator, topInterest, topConcern }: Props) {
  const brief = generateCreativeBrief(topMotivator, topInterest, topConcern, desiredContent[0]?.label || 'member stories', detailPref);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Detail Preference Pie */}
        {detailPref.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Ad Detail Preference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={detailPref} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                      {detailPref.map((_, i) => (
                        <Cell key={i} fill={DISTINCT_COLORS[i % DISTINCT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Desired Content Ranking */}
        {desiredContent.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Desired Ad Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {desiredContent.slice(0, 8).map((c, i) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground truncate flex items-center gap-1.5">
                          {c.label}
                          {i < 3 && <Badge variant="secondary" className="text-[10px] px-1 py-0">Top</Badge>}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.count} ({c.pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(c.count / (desiredContent[0]?.count || 1)) * 100}%`,
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
      </div>

      {/* Auto-Generated Creative Brief */}
      <Card className="shadow-sm border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Auto-Generated Creative Brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed">{brief}</p>
        </CardContent>
      </Card>
    </div>
  );
}
