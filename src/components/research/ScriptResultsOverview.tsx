import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import type { ScriptQuestion } from "@/hooks/useResearchScripts";
import type { ScriptResponse } from "@/components/research-insights/ScriptInsightsPanel";

interface Props {
  script: any;
  questions: ScriptQuestion[];
  responses: ScriptResponse[];
  uniqueSessions: number;
}

export function ScriptResultsOverview({ script, questions, responses, uniqueSessions }: Props) {
  const metrics = useMemo(() => {
    // Completion rate
    const sessionsMap = new Map<string, Set<number>>();
    responses.forEach(r => {
      if (!sessionsMap.has(r.session_id)) sessionsMap.set(r.session_id, new Set());
      sessionsMap.get(r.session_id)!.add(r.question_order);
    });
    const totalQ = questions.filter(q => !q.is_internal).length;
    let completedSessions = 0;
    sessionsMap.forEach(answered => {
      if (answered.size >= totalQ * 0.8) completedSessions++;
    });
    const completionRate = uniqueSessions > 0 ? Math.round((completedSessions / uniqueSessions) * 100) : 0;

    // Avg rating
    const ratingQs = questions.filter(q => q.type === "scale");
    let avgRating: string | null = null;
    if (ratingQs.length > 0) {
      const ratingResponses = responses.filter(r =>
        ratingQs.some(q => q.order === r.question_order) && (r.response_numeric ?? 0) > 0
      );
      if (ratingResponses.length > 0) {
        avgRating = (ratingResponses.reduce((s, r) => s + (r.response_numeric ?? 0), 0) / ratingResponses.length).toFixed(1);
      }
    }

    // Response trend
    const dayMap: Record<string, number> = {};
    responses.forEach(r => {
      const day = r.created_at?.slice(0, 10);
      if (day) dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const trendData = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      }));

    // Section completion
    const sectionData: Record<string, { total: number; answered: number }> = {};
    questions.filter(q => !q.is_internal).forEach(q => {
      const sec = q.section || "General";
      if (!sectionData[sec]) sectionData[sec] = { total: 0, answered: 0 };
      sectionData[sec].total += uniqueSessions;
      sectionData[sec].answered += responses.filter(r => r.question_order === q.order).length;
    });
    const sectionCompletion = Object.entries(sectionData).map(([name, d]) => ({
      name: name.length > 20 ? name.slice(0, 20) + "…" : name,
      rate: d.total > 0 ? Math.round((d.answered / d.total) * 100) : 0,
    }));

    return { completionRate, avgRating, trendData, sectionCompletion, completedSessions };
  }, [questions, responses, uniqueSessions]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Total Responses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{uniqueSessions}</div>
            <p className="text-xs text-muted-foreground">{questions.filter(q => !q.is_internal).length} questions per survey</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" /> Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.completionRate}%</div>
            <p className="text-xs text-muted-foreground">{metrics.completedSessions} of {uniqueSessions} completed 80%+</p>
          </CardContent>
        </Card>

        {metrics.avgRating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Avg Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.avgRating}/10</div>
              <p className="text-xs text-muted-foreground">Across all rating questions</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{questions.filter(q => !q.is_internal).length}</div>
            <p className="text-xs text-muted-foreground">{questions.filter(q => q.type === "open_ended").length} open-ended</p>
          </CardContent>
        </Card>
      </div>

      {/* Response Trend */}
      {metrics.trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Response Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.trendData}>
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(val: number) => [`${val}`, "Responses"]} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Completion */}
      {metrics.sectionCompletion.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Section Completion Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.sectionCompletion} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={12} />
                  <YAxis dataKey="name" type="category" width={150} fontSize={11} />
                  <Tooltip formatter={(val: number) => [`${val}%`, "Completion"]} />
                  <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
