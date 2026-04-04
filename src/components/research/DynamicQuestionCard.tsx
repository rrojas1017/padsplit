import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScriptQuestion } from "@/hooks/useResearchScripts";
import type { ScriptResponse } from "@/components/research-insights/ScriptInsightsPanel";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#A23B72", "#F18F01", "#C73E1D", "#44BBA4", "#E94F37", "#393E41", "#8D6A9F", "#2E86AB"];

interface Props {
  question: ScriptQuestion;
  responses: ScriptResponse[];
  totalRespondents: number;
}

const TYPE_LABELS: Record<string, string> = {
  open_ended: "Open-Ended",
  multiple_choice: "Multiple Choice",
  yes_no: "Yes / No",
  scale: "Rating Scale",
};

export function DynamicQuestionCard({ question, responses, totalRespondents }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const responseCount = responses.length;
  const responseRate = totalRespondents > 0 ? Math.round((responseCount / totalRespondents) * 100) : 0;

  const chartData = useMemo(() => {
    if (responseCount === 0) return [];

    if (question.type === "open_ended") {
      const freq: Record<string, number> = {};
      responses.forEach(r => {
        const val = r.response_value || "No response";
        freq[val] = (freq[val] || 0) + 1;
      });
      return Object.entries(freq)
        .map(([label, count]) => ({ label, count, pct: Math.round((count / responseCount) * 100) }))
        .sort((a, b) => b.count - a.count);
    }

    if (question.type === "scale") {
      const freq: Record<number, number> = {};
      responses.forEach(r => {
        const val = r.response_numeric ?? parseInt(r.response_value || "0");
        if (val > 0) freq[val] = (freq[val] || 0) + 1;
      });
      return Array.from({ length: 10 }, (_, i) => ({
        label: String(i + 1),
        count: freq[i + 1] || 0,
        pct: Math.round(((freq[i + 1] || 0) / responseCount) * 100),
      }));
    }

    if (question.type === "yes_no") {
      const yesCount = responses.filter(r => r.response_value?.toLowerCase()?.startsWith("yes")).length;
      const noCount = responseCount - yesCount;
      return [
        { label: "Yes", count: yesCount, pct: Math.round((yesCount / responseCount) * 100) },
        { label: "No", count: noCount, pct: Math.round((noCount / responseCount) * 100) },
      ];
    }

    // multiple_choice
    const freq: Record<string, number> = {};
    (question.options || []).forEach(opt => { freq[opt] = 0; });
    responses.forEach(r => {
      const values = r.response_options?.length ? r.response_options : r.response_value ? [r.response_value] : [];
      values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    });
    return Object.entries(freq)
      .map(([label, count]) => ({ label, count, pct: Math.round((count / responseCount) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [question, responses, responseCount]);

  const keyFinding = useMemo(() => {
    if (chartData.length === 0) return "No responses yet.";
    if (question.type === "open_ended") {
      return `${responseCount} responses collected. Most common: "${chartData[0]?.label?.slice(0, 60)}".`;
    }
    if (question.type === "scale") {
      const nums = responses.map(r => r.response_numeric ?? parseInt(r.response_value || "0")).filter(n => n > 0);
      const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—";
      return `Average score: ${avg}/10 across ${nums.length} responses.`;
    }
    const top = chartData[0];
    return top ? `"${top.label}" leads with ${top.count} responses (${top.pct}%).` : `${responseCount} responses recorded.`;
  }, [chartData, question, responses, responseCount]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium">
            Q{question.order}: {question.question}
          </CardTitle>
          <div className="flex gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">{TYPE_LABELS[question.type] || question.type}</Badge>
            <Badge variant="secondary" className="text-xs">
              {responseCount}/{totalRespondents} ({responseRate}%)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
          <span className="font-medium">Key Finding:</span> {keyFinding}
        </p>

        {responseCount > 0 && (
          <>
            {/* YES/NO pills */}
            {question.type === "yes_no" && (
              <div className="flex gap-3">
                {chartData.map(d => (
                  <div key={d.label} className={`flex-1 text-center p-3 rounded-lg ${d.label === "Yes" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                    <div className="text-xl font-bold">{d.pct}%</div>
                    <div className="text-sm text-muted-foreground">{d.label} ({d.count})</div>
                  </div>
                ))}
              </div>
            )}

            {/* SCALE histogram */}
            {question.type === "scale" && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(val: number) => [`${val} responses`, "Count"]} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* MULTIPLE CHOICE bar */}
            {question.type === "multiple_choice" && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" fontSize={12} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={180}
                      fontSize={11}
                      tickFormatter={v => v.length > 35 ? v.slice(0, 35) + "…" : v}
                    />
                    <Tooltip formatter={(val: number, _n: any, props: any) => [`${val} (${props.payload.pct}%)`, "Responses"]} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* OPEN-ENDED theme tags */}
            {question.type === "open_ended" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {chartData.slice(0, 10).map(d => (
                    <Badge key={d.label} variant="secondary" className="text-xs gap-1">
                      {d.label.length > 50 ? d.label.slice(0, 50) + "…" : d.label}
                      <span className="font-bold ml-1">{d.count}</span>
                    </Badge>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)}>
                  {showRaw ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {showRaw ? "Hide" : "Show"} all {responseCount} responses
                </Button>
                {showRaw && (
                  <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md p-2 bg-muted/30">
                    {responses.map((r, i) => (
                      <div key={r.id} className="text-xs flex gap-2">
                        <span className="text-muted-foreground shrink-0">#{i + 1}</span>
                        <span>{r.response_value || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {responseCount === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No responses yet for this question.</p>
        )}
      </CardContent>
    </Card>
  );
}
