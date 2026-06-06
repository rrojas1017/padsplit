// Accordion-style clustered open-ended response display for the Payment
// Experience Script Responses tab. Visually mirrors the Move-Out Issue
// Clusters pattern but uses neutral/amber styling rather than red.

import { useMemo } from 'react';
import { Quote } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { clusterOpenEndedResponses } from '@/utils/openEndedResponseClusters';

interface OpenEndedClustersProps {
  responses: string[];
  totalSamples?: number;
}

function SimpleVerbatimList({ responses }: { responses: string[] }) {
  const cleaned = responses.map((r) => String(r ?? '').trim()).filter(Boolean);
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
          <p className="text-sm italic text-muted-foreground leading-relaxed break-words">
            &ldquo;{s}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}

export function OpenEndedClusters({
  responses,
  totalSamples,
}: OpenEndedClustersProps) {
  const validResponses = useMemo(
    () => (responses || []).map((r) => String(r ?? '').trim()).filter(Boolean),
    [responses],
  );

  const clusters = useMemo(
    () => clusterOpenEndedResponses(validResponses),
    [validResponses],
  );

  if (validResponses.length < 3 || clusters.length === 0) {
    return <SimpleVerbatimList responses={validResponses} />;
  }

  const sampleCount = validResponses.length;
  const showSampleContext =
    typeof totalSamples === 'number' && totalSamples > sampleCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Representative Response Clusters
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {showSampleContext
            ? `sample of ${sampleCount} of ${totalSamples}`
            : `${sampleCount} responses`}
        </span>
      </div>

      <Accordion
        type="multiple"
        defaultValue={['cluster-0']}
        className="space-y-2"
      >
        {clusters.map((cluster, index) => (
          <AccordionItem
            key={cluster.id}
            value={`cluster-${index}`}
            className="border rounded-lg px-1 border-b"
          >
            <AccordionTrigger className="hover:no-underline py-3 px-3">
              <div className="flex items-center justify-between gap-3 w-full pr-2">
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
                      <p className="text-sm italic text-muted-foreground leading-relaxed break-words">
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
    </div>
  );
}
