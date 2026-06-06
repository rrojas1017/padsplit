// Accordion-style clustered open-ended response display for the Payment
// Experience Script Responses tab. Visually mirrors the Move-Out Issue
// Clusters pattern but uses neutral/amber styling rather than red.

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
  const [showAllResponses, setShowAllResponses] = useState(false);

  if (validResponses.length < 3 || clusters.length === 0) {
    // Prefer sample list if we have no real responses but samples exist.
    const fallback =
      validResponses.length > 0 ? validResponses : cleanResponses(sampleResponses || []);
    return <SimpleVerbatimList responses={fallback} />;
  }

  const validTotal = validResponses.length;
  // Sample-only when caller indicates total population is larger than what
  // was passed in for clustering.
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

  const allResponsesButtonLabel = isSampleOnly
    ? 'Show all available sample responses'
    : `Show all ${validTotal} responses`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {headerTitle}
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {isSampleOnly
            ? `sample of ${validTotal} of ${totalResponses}`
            : `${validTotal} responses`}
        </span>
      </div>

      <Accordion
        type="multiple"
        defaultValue={[defaultOpenValue]}
        className="space-y-2"
      >
        {visibleClusters.map((cluster, index) => (
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
              {cluster.examples.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Quote className="w-3 h-3" />
                    Example responses
                  </p>
                  {cluster.examples.map((q, i) => (
                    <div
                      key={i}
                      className="bg-muted/40 border-l-[3px] border-amber-300/60 rounded-r-md p-3"
                    >
                      <p className="text-sm italic text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
                        &ldquo;{q}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
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

      <div className="pt-2 border-t border-border/60 space-y-2">
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllResponses((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAllResponses ? 'Hide responses' : allResponsesButtonLabel}
          </Button>
        </div>

        {showAllResponses && (
          <div className="bg-muted/30 border rounded-lg p-3 max-h-80 overflow-y-auto overflow-x-hidden">
            <ol className="space-y-2 list-none">
              {validResponses.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-muted-foreground break-words whitespace-pre-wrap"
                >
                  <span className="tabular-nums shrink-0 text-muted-foreground/70">
                    {i + 1}.
                  </span>
                  <span className="italic break-words min-w-0">
                    &ldquo;{r}&rdquo;
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
