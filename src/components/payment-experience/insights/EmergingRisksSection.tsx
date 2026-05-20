import { AlertTriangle } from 'lucide-react';
import { InsightCard } from './primitives/InsightCard';
import { cn } from '@/lib/utils';
import type { EmergingRisk, RiskSeverity } from '@/utils/paymentExperienceAnalytics';

interface EmergingRisksSectionProps {
  risks: EmergingRisk[];
}

const SEVERITY_DOT: Record<RiskSeverity, string> = {
  high: 'bg-amber-500',
  medium: 'bg-amber-400/70',
  low: 'bg-muted-foreground/40',
};

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  high: 'High priority',
  medium: 'Moderate',
  low: 'Low',
};

export function EmergingRisksSection({ risks }: EmergingRisksSectionProps) {
  if (!risks.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {risks.map((r) => (
        <InsightCard
          key={r.id}
          icon={<AlertTriangle className="w-4 h-4 text-muted-foreground" />}
          title={r.title}
          rightSlot={
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn('w-1.5 h-1.5 rounded-full', SEVERITY_DOT[r.severity])} />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {SEVERITY_LABEL[r.severity]}
              </span>
            </div>
          }
        >
          <p className="text-xs text-muted-foreground leading-relaxed">{r.detail}</p>
        </InsightCard>
      ))}
    </div>
  );
}
