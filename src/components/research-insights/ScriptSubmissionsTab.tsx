import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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

export function ScriptSubmissionsTab({ scriptId }: { scriptId: string }) {
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
