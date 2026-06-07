// Accordion-style clustered open-ended response display for the Payment
// Experience Script Responses tab. Each opened cluster shows every response
// assigned to it (no global "All responses" section).

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
import { clusterOpenEndedResponses } from '@/utils/openEndedResponseClusters';

interface OpenEndedClustersProps {
  /** Full set of responses used for clustering. */
  responses: string[];
  /** Optional capped/representative preview list. */
  sampleResponses?: string[];
  /** Full written-response count for this question. */
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

export function OpenEndedClusters({
  responses,
  sampleResponses,
  totalResponses,
}: OpenEndedClustersProps) {
  // Trim + drop blanks, but do NOT dedupe — repeated answers must count.
  const validResponses = useMemo(
    () => cleanResponses(responses || []),
    [responses],
  );

  const clusters = useMemo(
    () => clusterOpenEndedResponses(validResponses),
    [validResponses],
  );

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {headerTitle}
        </p>
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
