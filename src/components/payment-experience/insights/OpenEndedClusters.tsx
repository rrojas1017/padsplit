// Accordion-style clustered open-ended response display for the Payment
// Experience Script Responses tab. Uses Gemini AI clusters (server-side, cached)
// with deterministic clustering as the instant render + fallback.

import { useMemo, useState } from 'react';
import { Quote } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  clusterOpenEndedResponses,
  type OpenEndedCluster,
} from '@/utils/openEndedResponseClusters';
import { usePEOpenEndedClusters } from '@/hooks/usePEOpenEndedClusters';

interface OpenEndedClustersProps {
  questionId: string;
  questionText: string;
  responses: string[];
  sampleResponses?: string[];
  totalResponses?: number;
}

const DEFAULT_VISIBLE_NAMED_CLUSTERS = 5;
const DEFAULT_VISIBLE_RESPONSES_PER_CLUSTER = 10;
const OTHER_ID = 'other';

function cleanResponses(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input || []) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (!s) continue;
    out.push(s);
  }
  return out;
}

function SimpleVerbatimList({ responses }: { responses: string[] }) {
  const cleaned = cleanResponses(responses);
  if (cleaned.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses.</p>;
  }
  return (
    <div className="space-y-2">
      {cleaned.map((s, i) => (
        <div
          key={i}
          className="bg-muted/40 border-l-[3px] border-amber-300/60 rounded-r-md p-3"
        >
          <p className="text-sm italic text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
            &ldquo;{s}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}

function buildAiClusters(
  aiClusters: { id: string; label: string; summary?: string; responseIndices: number[] }[],
  validResponses: string[],
): OpenEndedCluster[] {
  const total = validResponses.length;
  if (total === 0 || !aiClusters?.length) return [];

  const built: OpenEndedCluster[] = aiClusters.map((c) => {
    const resps: string[] = [];
    for (const idx of c.responseIndices) {
      if (Number.isInteger(idx) && idx >= 0 && idx < total) {
        resps.push(validResponses[idx]);
      }
    }
    const examples: string[] = [];
    const seen = new Set<string>();
    for (const r of resps) {
      const k = r.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      examples.push(r);
      if (examples.length >= 5) break;
    }
    const pct = (resps.length / total) * 100;
    return {
      id: c.id,
      label: c.label,
      summary: c.summary,
      examples,
      responses: resps,
      count: resps.length,
      percentage: resps.length === 0 ? 0 : pct < 1 ? 1 : Math.round(pct),
    };
  });

  built.sort((a, b) => {
    const aOther = a.id === OTHER_ID;
    const bOther = b.id === OTHER_ID;
    if (aOther && !bOther) return 1;
    if (!aOther && bOther) return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  });
  return built.filter((c) => c.count > 0);
}

export function OpenEndedClusters({
  questionId,
  questionText,
  responses,
  sampleResponses,
  totalResponses,
}: OpenEndedClustersProps) {
  const validResponses = useMemo(
    () => cleanResponses(responses || []),
    [responses],
  );

  const deterministic = useMemo(
    () => clusterOpenEndedResponses(validResponses),
    [validResponses],
  );

  const aiQuery = usePEOpenEndedClusters({
    questionId,
    questionText,
    responses: validResponses,
  });

  const aiClusters = useMemo(() => {
    if (aiQuery.data?.ok && aiQuery.data.clusters?.length) {
      return buildAiClusters(aiQuery.data.clusters, validResponses);
    }
    return null;
  }, [aiQuery.data, validResponses]);

  const clusters = aiClusters && aiClusters.length > 0 ? aiClusters : deterministic;

  const [showAllClusters, setShowAllClusters] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  if (validResponses.length < 3 || clusters.length === 0) {
    const fallback =
      validResponses.length > 0 ? validResponses : cleanResponses(sampleResponses || []);
    return <SimpleVerbatimList responses={fallback} />;
  }

  const validTotal = validResponses.length;
  const isSampleOnly =
    typeof totalResponses === 'number' && totalResponses > validTotal;

  const headerTitle = isSampleOnly
    ? 'Representative Response Clusters'
    : 'Response Clusters';

  const namedClusters = clusters.filter((c) => c.id !== OTHER_ID);
  const otherCluster = clusters.find((c) => c.id === OTHER_ID);

  const visibleNamed = showAllClusters
    ? namedClusters
    : namedClusters.slice(0, DEFAULT_VISIBLE_NAMED_CLUSTERS);

  const visibleClusters = otherCluster
    ? [...visibleNamed, otherCluster]
    : visibleNamed;

  const hasMoreNamed = namedClusters.length > DEFAULT_VISIBLE_NAMED_CLUSTERS;

  const defaultOpenIndex = visibleClusters.findIndex((c) => c.id !== OTHER_ID);
  const defaultOpenValue = `cluster-${defaultOpenIndex >= 0 ? defaultOpenIndex : 0}`;

  const isRefining = aiQuery.isLoading && !aiClusters;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {headerTitle}
          </p>
          {isRefining && (
            <span className="text-[10px] text-muted-foreground italic">
              Refining clusters…
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {isSampleOnly
            ? `Based on ${validTotal} available sample responses`
            : `Based on ${validTotal} written responses`}
        </span>
      </div>

      <Accordion
        type="multiple"
        defaultValue={[defaultOpenValue]}
        className="space-y-2"
      >
        {visibleClusters.map((cluster, index) => {
          const all = cluster.responses ?? [];
          const isExpanded = !!expandedClusters[cluster.id];
          const overLimit = all.length > DEFAULT_VISIBLE_RESPONSES_PER_CLUSTER;
          const shown = overLimit && !isExpanded
            ? all.slice(0, DEFAULT_VISIBLE_RESPONSES_PER_CLUSTER)
            : all;

          return (
            <AccordionItem
              key={cluster.id}
              value={`cluster-${index}`}
              className="border rounded-lg px-1 border-b"
            >
              <AccordionTrigger className="hover:no-underline py-3 px-3">
                <div className="flex items-center justify-between gap-3 w-full pr-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground text-left break-words">
                    {cluster.label}
                  </span>
                  <Badge
                    variant="outline"
                    className="shrink-0 tabular-nums text-[11px] font-medium"
                  >
                    {cluster.count} · {cluster.percentage}%
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4 space-y-3">
                {cluster.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {cluster.summary}
                  </p>
                )}
                {all.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Quote className="w-3 h-3" />
                      All responses in this cluster
                    </p>
                    <div className="max-h-96 overflow-y-auto pr-1 space-y-2">
                      {shown.map((q, i) => (
                        <div
                          key={i}
                          className="bg-muted/30 border-l-[3px] border-amber-300/60 rounded-r-md p-3"
                        >
                          <p className="text-sm italic text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
                            <span className="not-italic font-medium text-foreground/70 mr-2 tabular-nums">
                              {i + 1}.
                            </span>
                            &ldquo;{q}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                    {overLimit && (
                      <div className="flex justify-center pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedClusters((prev) => ({
                              ...prev,
                              [cluster.id]: !prev[cluster.id],
                            }))
                          }
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded
                            ? 'Show fewer'
                            : `Show all ${all.length} responses`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {hasMoreNamed && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllClusters((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAllClusters
              ? 'Show fewer clusters'
              : `Show all ${namedClusters.length} clusters`}
          </Button>
        </div>
      )}
    </div>
  );
}
