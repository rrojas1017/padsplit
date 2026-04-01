import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb, Quote, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
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

/** Extract priority prefix from cluster_name like "P0: Host Misconduct..." */
function extractPriority(name: string): string | null {
  const match = name.match(/^(P[0-3])\s*[:\-–—]/i);
  return match ? match[1].toUpperCase() : null;
}

function getPriorityBorderColor(priority: string | null): string {
  if (!priority) return 'hsl(var(--muted-foreground) / 0.3)';
  if (priority === 'P0') return 'hsl(var(--destructive))';
  if (priority === 'P1') return 'hsl(25, 95%, 53%)';
  if (priority === 'P2') return 'hsl(45, 93%, 47%)';
  return 'hsl(var(--muted-foreground) / 0.3)';
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

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Issue Clusters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {capped.map((cluster, i) => (
          <ClusterCard key={i} cluster={cluster} defaultOpen={i < 2} />
        ))}
        {maxVisible && sorted.length > maxVisible && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="w-full text-xs">
            {showAll ? 'Show fewer' : `Show all ${sorted.length} clusters`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ClusterCard({ cluster, defaultOpen }: { cluster: IssueCluster; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const clusterName = cluster.cluster_name || cluster.name || '';
  const priority = extractPriority(clusterName) || cluster.priority || null;
  const borderColor = getPriorityBorderColor(priority);
  const quotes = (cluster.key_quotes || cluster.supporting_quotes || cluster.representative_quotes || []).slice(0, 3);

  // Parse recommended_action — can be string or string[]
  const actions: string[] = [];
  if (cluster.recommended_actions?.length) {
    actions.push(...cluster.recommended_actions);
  } else if (Array.isArray(cluster.recommended_action)) {
    actions.push(...cluster.recommended_action);
  } else if (typeof cluster.recommended_action === 'string') {
    // Split on numbered list patterns
    const parts = cluster.recommended_action.split(/(?:\d+\.\s)/);
    actions.push(...parts.filter(Boolean).map(s => s.trim()));
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
          style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{clusterName}</p>
            {priority && <PriorityBadge priority={priority} />}
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-1 mt-2 mb-1 p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4" style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}>
          {/* Description */}
          {cluster.description && (
            <div className="bg-card rounded-xl p-3 border border-border">
              <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Description</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{cluster.description}</p>
            </div>
          )}

          {/* Key quotes */}
          {quotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Key Quotes</p>
              {quotes.map((q, i) => (
                <div key={i} className="bg-accent/40 border border-accent rounded-lg p-3 flex items-start gap-2">
                  <Quote className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm italic text-muted-foreground leading-relaxed">&ldquo;{q}&rdquo;</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommended action */}
          {actions.length > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
