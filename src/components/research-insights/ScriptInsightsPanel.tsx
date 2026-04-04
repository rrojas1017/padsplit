import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, BarChart3, LayoutDashboard } from "lucide-react";
import { DynamicQuestionCard } from "@/components/research/DynamicQuestionCard";
import { ScriptResultsOverview } from "@/components/research/ScriptResultsOverview";
import { Skeleton } from "@/components/ui/skeleton";
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

  if (responses.length === 0) {
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
      </Tabs>
    </div>
  );
}
