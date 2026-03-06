import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { PriorityBadge } from './PriorityBadge';

interface IssueCluster {
  cluster_name: string;
  cluster_description?: string;
  description?: string;
  frequency?: number;
  case_count?: number;
  pct_of_total?: number;
  severity_distribution?: { critical: number; high: number; medium: number; low: number };
  representative_quotes?: string[];
  key_quotes?: string[];
  systemic_root_cause?: string;
  root_cause?: string;
  recommended_action?: {
    action: string;
    owner?: string;
    priority?: string;
    expected_impact?: string;
    effort?: string;
    quick_win?: string | null;
  };
}

interface IssueClustersProps {
  data: IssueCluster[];
}

export function IssueClustersPanel({ data }: IssueClustersProps) {
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issue Clusters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((cluster, i) => (
          <ClusterCard key={i} cluster={cluster} />
        ))}
      </CardContent>
    </Card>
  );
}

function ClusterCard({ cluster }: { cluster: IssueCluster }) {
  const [open, setOpen] = useState(false);

  const freq = cluster.frequency ?? cluster.case_count;
  const desc = cluster.cluster_description ?? cluster.description;
  const quotes = cluster.representative_quotes ?? cluster.key_quotes ?? [];
  const rootCause = cluster.systemic_root_cause ?? cluster.root_cause;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <p className="font-medium text-foreground text-sm">{cluster.cluster_name}</p>
              {freq != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {freq} cases{cluster.pct_of_total ? ` (${cluster.pct_of_total.toFixed(0)}%)` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PriorityBadge priority={cluster.recommended_action?.priority} />
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4 mt-2">
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}

          {/* Severity distribution (legacy) */}
          {cluster.severity_distribution && (
            <div className="flex gap-2 flex-wrap">
              {cluster.severity_distribution.critical > 0 && <Badge variant="destructive">Critical: {cluster.severity_distribution.critical}</Badge>}
              {cluster.severity_distribution.high > 0 && <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">High: {cluster.severity_distribution.high}</Badge>}
              {cluster.severity_distribution.medium > 0 && <Badge variant="secondary">Medium: {cluster.severity_distribution.medium}</Badge>}
              {cluster.severity_distribution.low > 0 && <Badge variant="outline">Low: {cluster.severity_distribution.low}</Badge>}
            </div>
          )}

          {/* Quotes */}
          {quotes.length > 0 && (
            <div className="space-y-2">
              {quotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-primary/40 pl-3 italic text-sm text-muted-foreground">
                  "{q}"
                </blockquote>
              ))}
            </div>
          )}

          {/* Root cause */}
          {rootCause && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-1">Systemic Root Cause</p>
              <p className="text-sm text-muted-foreground">{rootCause}</p>
            </div>
          )}

          {/* Recommended action */}
          {cluster.recommended_action && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">{cluster.recommended_action.action}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <PriorityBadge priority={cluster.recommended_action.priority} />
                {cluster.recommended_action.owner && <Badge variant="outline">{cluster.recommended_action.owner}</Badge>}
                {cluster.recommended_action.effort && <Badge variant="outline" className="capitalize">{cluster.recommended_action.effort} effort</Badge>}
              </div>
              {cluster.recommended_action.expected_impact && (
                <p className="text-xs text-muted-foreground">{cluster.recommended_action.expected_impact}</p>
              )}
              {cluster.recommended_action.quick_win && (
                <div className="flex items-start gap-1.5 mt-1">
                  <p className="text-xs text-foreground"><span className="font-medium">Quick win:</span> {cluster.recommended_action.quick_win}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
