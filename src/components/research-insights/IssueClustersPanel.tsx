import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { PriorityBadge } from './PriorityBadge';

interface IssueCluster {
  cluster_name: string;
  description?: string;
  priority?: string;
  recommended_action?: string | { action: string; owner?: string; priority?: string };
  supporting_quotes?: string[];
  // Legacy
  cluster_description?: string;
  frequency?: number;
  case_count?: number;
  representative_quotes?: string[];
  key_quotes?: string[];
  systemic_root_cause?: string;
  root_cause?: string;
}

interface IssueClustersProps {
  data: IssueCluster[];
}

export function IssueClustersPanel({ data }: IssueClustersProps) {
  if (!data?.length) return null;

  // Sort P0 first
  const sorted = [...data].sort((a, b) => {
    const pa = a.priority?.toUpperCase() || 'P9';
    const pb = b.priority?.toUpperCase() || 'P9';
    return pa.localeCompare(pb);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issue Clusters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((cluster, i) => (
          <ClusterCard key={i} cluster={cluster} />
        ))}
      </CardContent>
    </Card>
  );
}

function ClusterCard({ cluster }: { cluster: IssueCluster }) {
  const [open, setOpen] = useState(false);

  const desc = cluster.description || cluster.cluster_description;
  const quotes = cluster.supporting_quotes || cluster.representative_quotes || cluster.key_quotes || [];
  const rootCause = cluster.systemic_root_cause || cluster.root_cause;
  const actionText = typeof cluster.recommended_action === 'string'
    ? cluster.recommended_action
    : cluster.recommended_action?.action;
  const actionPriority = cluster.priority || (typeof cluster.recommended_action === 'object' ? cluster.recommended_action?.priority : undefined);
  const freq = cluster.frequency ?? cluster.case_count;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <p className="font-medium text-foreground text-sm">{cluster.cluster_name}</p>
              {freq != null && (
                <p className="text-xs text-muted-foreground mt-0.5">{freq} cases</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PriorityBadge priority={actionPriority} />
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4 mt-2">
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}

          {quotes.length > 0 && (
            <div className="space-y-2">
              {quotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-primary/40 pl-3 italic text-sm text-muted-foreground">
                  "{q}"
                </blockquote>
              ))}
            </div>
          )}

          {rootCause && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-1">Root Cause</p>
              <p className="text-sm text-muted-foreground">{rootCause}</p>
            </div>
          )}

          {actionText && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-foreground">{actionText}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
