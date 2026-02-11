import { useChurnPrediction } from '@/hooks/useChurnPrediction';
import { useAgents } from '@/contexts/AgentsContext';
import { getAgentName } from '@/utils/agentUtils';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function ChurnWarningPanel() {
  const { data, isLoading } = useChurnPrediction();
  const { agents } = useAgents();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-6 rounded-xl bg-card border border-border animate-slide-up" style={{ animationDelay: '550ms' }}>
        <Skeleton className="h-6 w-64 mb-4" />
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!data || data.summary.total === 0) return null;

  const topRisk = data.records.slice(0, 10);

  return (
    <div className="p-6 rounded-xl bg-card border border-border animate-slide-up" style={{ animationDelay: '550ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-warning" />
        <h3 className="text-lg font-semibold text-foreground">Churn Early Warning</h3>
        <span className="text-sm text-muted-foreground ml-auto">{data.summary.total} pending move-ins</span>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium text-muted-foreground uppercase">High Risk</span>
          </div>
          <p className="text-2xl font-bold text-destructive">{data.summary.high}</p>
        </div>
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-warning" />
            <span className="text-xs font-medium text-muted-foreground uppercase">Medium Risk</span>
          </div>
          <p className="text-2xl font-bold text-warning">{data.summary.medium}</p>
        </div>
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-muted-foreground uppercase">Low Risk</span>
          </div>
          <p className="text-2xl font-bold text-success">{data.summary.low}</p>
        </div>
      </div>

      {/* Top risk records */}
      {topRisk.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Highest Risk Bookings</p>
          {topRisk.map((r) => (
            <div key={r.bookingId} className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              r.risk.level === 'high' ? 'bg-destructive/5 border-destructive/20' :
              r.risk.level === 'medium' ? 'bg-warning/5 border-warning/20' :
              'bg-muted/30 border-border'
            )}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                r.risk.level === 'high' ? 'bg-destructive/20 text-destructive' :
                r.risk.level === 'medium' ? 'bg-warning/20 text-warning' :
                'bg-success/20 text-success'
              )}>
                {r.risk.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground truncate">{r.memberName}</span>
                  <span className="text-xs text-muted-foreground">• {getAgentName(agents, r.agentId)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Move-in: {format(new Date(r.moveInDate), 'MMM d')}</span>
                  {r.marketCity && <span>• {r.marketCity}, {r.marketState}</span>}
                </div>
                {r.risk.topFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.risk.topFactors.map((f, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={() => navigate(`/edit-booking/${r.bookingId}`)}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
