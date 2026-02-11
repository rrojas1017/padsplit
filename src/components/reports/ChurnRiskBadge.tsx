import { cn } from '@/lib/utils';
import { ChurnRiskResult } from '@/utils/churnPrediction';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChurnRiskBadgeProps {
  risk: ChurnRiskResult;
}

export function ChurnRiskBadge({ risk }: ChurnRiskBadgeProps) {
  const colorMap = {
    low: 'bg-success/20 text-success',
    medium: 'bg-warning/20 text-warning',
    high: 'bg-destructive/20 text-destructive',
  };

  const labelMap = {
    low: 'Low Risk',
    medium: 'Med Risk',
    high: 'High Risk',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold cursor-help whitespace-nowrap", colorMap[risk.level])}>
          {labelMap[risk.level]} ({risk.score})
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <p className="font-semibold mb-1">Risk Score: {risk.score}/100</p>
        {risk.topFactors.length > 0 && (
          <ul className="text-xs space-y-0.5">
            {risk.topFactors.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        )}
        {risk.topFactors.length === 0 && (
          <p className="text-xs text-muted-foreground">No risk signals detected</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
