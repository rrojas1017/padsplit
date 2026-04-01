import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Lightbulb, Quote, CheckCircle2 } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';

interface IssueCluster {
  cluster_name?: string;
  name?: string;
  description?: string;
  key_quotes?: string[];
  recommended_action?: string | string[];
  recommended_actions?: string[];
  supporting_quotes?: string[];
  representative_quotes?: string[];
  priority?: string;
}

interface IssueClustersProps {
  data: IssueCluster[];
  maxVisible?: number;
}

function extractPriority(name: string): string | null {
  const match = name.match(/^(P[0-3])\s*[:\-–—]/i);
  return match ? match[1].toUpperCase() : null;
}

function stripPriorityPrefix(name: string): string {
  return name.replace(/^P[0-3]\s*[:\-–—]\s*/i, '').trim();
}

export function IssueClustersPanel({ data, maxVisible }: IssueClustersProps) {
  const [showAll, setShowAll] = useState(false);

  if (!data?.length) return null;

  const sorted = [...data].sort((a, b) => {
    const pa = extractPriority(a.cluster_name || a.name || '') || 'P9';
    const pb = extractPriority(b.cluster_name || b.name || '') || 'P9';
    return pa.localeCompare(pb);
  });

  const capped = maxVisible && !showAll ? sorted.slice(0, maxVisible) : sorted;

  // Default open: first 2 items
  const defaultOpen = capped.slice(0, 2).map((_, i) => `cluster-${i}`);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Issue Clusters</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
          {capped.map((cluster, i) => (
            <ClusterAccordionItem key={i} cluster={cluster} index={i} />
          ))}
        </Accordion>
        {maxVisible && sorted.length > maxVisible && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="w-full text-xs mt-3">
            {showAll ? 'Show fewer' : `Show all ${sorted.length} clusters`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ClusterAccordionItem({ cluster, index }: { cluster: IssueCluster; index: number }) {
  const [showAllQuotes, setShowAllQuotes] = useState(false);

  const clusterName = cluster.cluster_name || cluster.name || '';
  const priority = extractPriority(clusterName) || cluster.priority || null;
  const displayName = stripPriorityPrefix(clusterName) || clusterName;
  const quotes = cluster.key_quotes || cluster.supporting_quotes || cluster.representative_quotes || [];
  const visibleQuotes = showAllQuotes ? quotes : quotes.slice(0, 3);

  const actions: string[] = [];
  if (cluster.recommended_actions?.length) {
    actions.push(...cluster.recommended_actions);
  } else if (Array.isArray(cluster.recommended_action)) {
    actions.push(...cluster.recommended_action);
  } else if (typeof cluster.recommended_action === 'string') {
    const parts = cluster.recommended_action.split(/(?:\d+\.\s)/);
    actions.push(...parts.filter(Boolean).map(s => s.trim()));
  }

  return (
    <AccordionItem value={`cluster-${index}`} className="border rounded-lg px-1">
      <AccordionTrigger className="hover:no-underline py-3 px-3">
        <div className="flex items-center gap-2 text-left">
          {priority && <PriorityBadge priority={priority} />}
          <span className="font-medium text-sm text-foreground">{displayName}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-4 space-y-4">
        {/* Description */}
        {cluster.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{cluster.description}</p>
        )}

        {/* Key Quotes */}
        {quotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-muted-foreground" />
              Key Member Quotes
            </p>
            {visibleQuotes.map((q, i) => (
              <div key={i} className="bg-red-50 border-l-[3px] border-red-300 rounded-r-lg p-3">
                <p className="text-sm italic text-muted-foreground leading-relaxed">&ldquo;{q}&rdquo;</p>
              </div>
            ))}
            {quotes.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllQuotes(!showAllQuotes)} className="text-xs text-primary h-7">
                {showAllQuotes ? 'Show fewer quotes' : `Show all ${quotes.length} quotes`}
              </Button>
            )}
          </div>
        )}

        {/* Recommended Action */}
        {actions.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
            <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-blue-500" />
              Recommended Action
            </p>
            <div className="space-y-1.5">
              {actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
