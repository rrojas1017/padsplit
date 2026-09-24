import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, BarChart3, LayoutDashboard, ListChecks } from "lucide-react";
import { DynamicQuestionCard } from "@/components/research/DynamicQuestionCard";
import { ScriptResultsOverview } from "@/components/research/ScriptResultsOverview";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { ScriptQuestion } from "@/hooks/useResearchScripts";

export interface ScriptResponse {
  id: string;
  script_id: string;
  session_id: string;
  question_order: number;
  response_value: string | null;
  response_options: string[] | null;
  response_numeric: number | null;
  respondent_id: string | null;
  metadata: any;
  created_at: string;
}

interface ScriptInsightsPanelProps {
  scriptId: string;
}

export function ScriptInsightsPanel({ scriptId }: ScriptInsightsPanelProps) {
  const { user } = useAuth();
  const canSeeSubmissions = user?.role === "super_admin" || user?.role === "admin";
  const { data: script, isLoading: scriptLoading } = useQuery({
    queryKey: ["script-detail", scriptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_scripts")
        .select("*")
        .eq("id", scriptId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!scriptId,
  });

  const questions: ScriptQuestion[] = useMemo(() => {
    if (!script?.questions) return [];
    return (script.questions as any[]).map((q: any) => ({
      order: q.order ?? 0,
      question: q.question ?? "",
      type: q.type ?? "open_ended",
      options: q.options ?? [],
      required: q.required ?? false,
      section: q.section ?? undefined,
      probes: q.probes ?? [],
      branch: q.branch ?? undefined,
      ai_extraction_hint: q.ai_extraction_hint ?? undefined,
      is_internal: q.is_internal ?? false,
    }));
  }, [script]);

  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ["script-responses", scriptId],
    queryFn: async () => {
      const all: ScriptResponse[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("script_responses")
          .select("*")
          .eq("script_id", scriptId)
          .order("question_order", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...(data as ScriptResponse[]));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    enabled: !!scriptId,
  });

  const uniqueSessions = useMemo(() => new Set(responses.map(r => r.session_id)).size, [responses]);

  const responsesByOrder = useMemo(() => {
    const map: Record<number, ScriptResponse[]> = {};
    responses.forEach(r => {
      if (!map[r.question_order]) map[r.question_order] = [];
      map[r.question_order].push(r);
    });
    return map;
  }, [responses]);

  const sections = useMemo(() => {
    const map: Record<string, ScriptQuestion[]> = {};
    questions.filter(q => !q.is_internal).forEach(q => {
      const sec = q.section || "General";
      if (!map[sec]) map[sec] = [];
      map[sec].push(q);
    });
    return map;
  }, [questions]);

  const handleDownloadReport = async () => {
    if (!script || questions.length === 0) return;
    const { generateDynamicReport: gen } = await import("@/utils/generateDynamicReport");
    await gen(
      { name: script.name, script_type: (script as any).script_type || "mixed", description: script.description },
      questions,
      responses,
      uniqueSessions,
    );
  };

  const isLoading = scriptLoading || responsesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (responses.length === 0 && !canSeeSubmissions) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-1">No responses yet</h3>
        <p className="text-sm text-muted-foreground">Responses will appear here once survey calls are logged against this script.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {uniqueSessions} responses · {questions.length} questions
        </p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleDownloadReport} disabled={responses.length === 0}>
          <Download className="w-3.5 h-3.5" /> Executive Report (.docx)
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Script Responses
          </TabsTrigger>
          {canSeeSubmissions && (
            <TabsTrigger value="submissions" className="gap-2">
              <ListChecks className="w-4 h-4" /> Submissions
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <ScriptResultsOverview
            script={script}
            questions={questions}
            responses={responses}
            uniqueSessions={uniqueSessions}
          />
        </TabsContent>

        <TabsContent value="responses" className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
              onChange={e => {
                const el = document.getElementById(`question-${e.target.value}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              defaultValue=""
            >
              <option value="" disabled>Jump to question…</option>
              {questions.filter(q => !q.is_internal).map(q => (
                <option key={q.order} value={q.order}>
                  Q{q.order}: {q.question.slice(0, 60)}…
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">{uniqueSessions} total responses</span>
          </div>

          {Object.entries(sections).map(([sectionName, sectionQuestions]) => (
            <div key={sectionName} className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">{sectionName}</h3>
              {sectionQuestions.map(q => (
                <div key={q.order} id={`question-${q.order}`}>
                  <DynamicQuestionCard
                    question={q}
                    responses={responsesByOrder[q.order] || []}
                    totalRespondents={uniqueSessions}
                  />
                </div>
              ))}
            </div>
          ))}
        </TabsContent>

        {canSeeSubmissions && (
          <TabsContent value="submissions">
            <ScriptSubmissionsTab scriptId={scriptId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

interface SubmissionRow {
  id: string;
  created_at: string;
  caller_type: string | null;
  call_outcome: string | null;
  language: string | null;
  call_duration_seconds: number | null;
  responses: unknown;
  researcher_id: string | null;
}

const PAGE = 1000;

function answeredCount(responses: unknown): number {
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) return 0;
  return Object.keys(responses as Record<string, unknown>).filter(k => !k.startsWith("_")).length;
}

function earlyDisposition(responses: unknown): string | null {
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) return null;
  const v = (responses as Record<string, unknown>)._early_disposition;
  return typeof v === "string" ? v : null;
}

function formatDuration(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
  timeStyle: "short",
});

function ScriptSubmissionsTab({ scriptId }: { scriptId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["script-submissions", scriptId],
    queryFn: async () => {
      const { data: campaigns, error: cErr } = await supabase
        .from("research_campaigns")
        .select("id")
        .eq("script_id", scriptId);
      if (cErr) throw cErr;
      const ids = (campaigns || []).map(c => c.id);
      if (ids.length === 0) return [] as SubmissionRow[];
      const all: SubmissionRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("research_calls")
          .select("id, created_at, caller_type, call_outcome, language, call_duration_seconds, responses, researcher_id")
          .in("campaign_id", ids)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...((data || []) as SubmissionRow[]));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    enabled: !!scriptId,
  });

  const kpis = useMemo(() => ({
    total: rows.length,
    completed: rows.filter(r => r.call_outcome === "completed").length,
    endedEarly: rows.filter(r => r.call_outcome === "ended_early").length,
    refused: rows.filter(r => r.call_outcome === "refused" || r.call_outcome === "declined").length,
  }), [rows]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const cards: { label: string; value: number }[] = [
    { label: "Total submissions", value: kpis.total },
    { label: "Completed", value: kpis.completed },
    { label: "Ended early", value: kpis.endedEarly },
    { label: "Refused/declined", value: kpis.refused },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold text-foreground">{c.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No submissions yet.</p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Date/time (ET)</th>
                <th className="text-left py-2 px-3 font-medium">Source</th>
                <th className="text-left py-2 px-3 font-medium">Outcome</th>
                <th className="text-left py-2 px-3 font-medium">Early-end reason</th>
                <th className="text-right py-2 px-3 font-medium">Answered</th>
                <th className="text-left py-2 px-3 font-medium">Language</th>
                <th className="text-right py-2 px-3 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map(r => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 px-3 whitespace-nowrap">{dateFmt.format(new Date(r.created_at))}</td>
                  <td className="py-2 px-3">{r.caller_type === "public" ? "Public link" : "Researcher runtime"}</td>
                  <td className="py-2 px-3">
                    <Badge variant={r.call_outcome === "completed" ? "default" : "outline"} className="text-xs">
                      {r.call_outcome ?? "—"}
                    </Badge>
                  </td>
                  <td className="py-2 px-3">{r.call_outcome === "ended_early" ? (earlyDisposition(r.responses) ?? "—") : "—"}</td>
                  <td className="py-2 px-3 text-right">{answeredCount(r.responses)}</td>
                  <td className="py-2 px-3 uppercase">{r.language ?? "—"}</td>
                  <td className="py-2 px-3 text-right">{formatDuration(r.call_duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p className="text-xs text-muted-foreground p-2">Showing latest 200 of {rows.length.toLocaleString()}.</p>
          )}
        </div>
      )}
    </div>
  );
}
