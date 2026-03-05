import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home } from 'lucide-react';

interface HostFlag {
  issue_pattern: string;
  frequency: number;
  impact_on_retention: string;
  impact_on_legal_risk: string;
  recommended_enforcement: string;
  systemic_fix: string;
}

interface HostAccountabilityPanelProps {
  data: HostFlag[];
}

const impactBadge = (impact: string) => {
  if (impact === 'high') return <Badge variant="destructive">High</Badge>;
  if (impact === 'medium') return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Medium</Badge>;
  return <Badge variant="outline">Low</Badge>;
};

export function HostAccountabilityPanel({ data }: HostAccountabilityPanelProps) {
  if (!data?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="w-4 h-4 text-orange-500" />
          Host Accountability Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((flag, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{flag.issue_pattern}</p>
              <Badge variant="secondary">{flag.frequency} cases</Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Retention:</span> {impactBadge(flag.impact_on_retention)}
              <span className="text-xs text-muted-foreground ml-2">Legal:</span> {impactBadge(flag.impact_on_legal_risk)}
            </div>
            <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Enforcement:</span> {flag.recommended_enforcement}</p>
            <div className="bg-muted/50 rounded p-2">
              <p className="text-xs"><span className="font-medium text-foreground">Systemic fix:</span> <span className="text-muted-foreground">{flag.systemic_fix}</span></p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
