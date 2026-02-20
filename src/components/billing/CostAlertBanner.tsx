import { AlertTriangle, CheckCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCostAlertMonitor, CostAlertLevel } from '@/hooks/useCostAlertMonitor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function getBannerStyles(level: CostAlertLevel) {
  switch (level) {
    case 'critical':
      return {
        wrapper: 'bg-destructive/10 border-destructive/30 text-destructive',
        badge: 'bg-destructive text-destructive-foreground',
        icon: <AlertTriangle className="h-5 w-5 flex-shrink-0" />,
        label: 'CRITICAL',
      };
    case 'warning':
      return {
        wrapper: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400',
        badge: 'bg-yellow-500 text-white',
        icon: <TrendingUp className="h-5 w-5 flex-shrink-0" />,
        label: 'WARNING',
      };
    default:
      return {
        wrapper: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
        badge: 'bg-green-500 text-white',
        icon: <CheckCircle className="h-5 w-5 flex-shrink-0" />,
        label: 'HEALTHY',
      };
  }
}

export function CostAlertBanner() {
  const { alertLevel, rollingAvg, recordCount, recentRecords, padSplitCharge, threshold, warningThreshold, isLoading, lastUpdated, refetch } = useCostAlertMonitor();

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-lg" />;
  }

  const styles = getBannerStyles(alertLevel);
  const margin = padSplitCharge - rollingAvg;
  const marginPct = padSplitCharge > 0 ? (margin / padSplitCharge) * 100 : 0;

  return (
    <div className={cn('border rounded-lg p-4', styles.wrapper)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {styles.icon}
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded', styles.badge)}>
                {styles.label}
              </span>
              <span className="font-semibold text-sm">
                Rolling Avg Cost Per Record (last {recordCount} records, excl. TTS)
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <span>
                <span className="font-mono font-bold text-base">${rollingAvg.toFixed(4)}</span>
                <span className="opacity-70"> avg cost</span>
              </span>
              <span className="opacity-60">vs</span>
              <span>
                <span className="font-mono font-bold text-base">${threshold.toFixed(2)}</span>
                <span className="opacity-70"> threshold</span>
              </span>
              <span className="opacity-60">·</span>
              <span>
                <span className="font-mono font-bold text-base">${padSplitCharge.toFixed(2)}</span>
                <span className="opacity-70"> PadSplit charge</span>
              </span>
              <span className="opacity-60">·</span>
              <span>
                <span className={cn('font-mono font-bold text-base', marginPct < 30 ? 'text-destructive' : '')}>
                  {marginPct.toFixed(0)}%
                </span>
                <span className="opacity-70"> margin remaining</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs opacity-50">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={refetch} className="h-7 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Recent expensive records */}
      {recentRecords.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="opacity-60 border-b border-current/20">
                <th className="text-left pb-1 font-medium">Booking ID</th>
                <th className="text-right pb-1 font-medium">Core Cost</th>
                <th className="text-right pb-1 font-medium">vs Threshold</th>
                <th className="text-left pb-1 pl-4 font-medium">Processed</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.slice(0, 8).map((r) => {
                const overThreshold = r.total_cost > threshold;
                const overWarning = r.total_cost > warningThreshold;
                return (
                  <tr key={r.booking_id} className="border-b border-current/10 last:border-0">
                    <td className="py-0.5 font-mono">{r.booking_id.substring(0, 8)}…</td>
                    <td className={cn('py-0.5 text-right font-mono font-semibold', overThreshold ? 'text-destructive' : overWarning ? 'text-warning' : '')}>
                      ${r.total_cost.toFixed(4)}
                    </td>
                    <td className="py-0.5 text-right font-mono opacity-70">
                      {r.total_cost > threshold ? `+$${(r.total_cost - threshold).toFixed(4)}` : `-$${(threshold - r.total_cost).toFixed(4)}`}
                    </td>
                    <td className="py-0.5 pl-4 opacity-60">
                      {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alert message */}
      {alertLevel === 'critical' && (
        <p className="mt-2 text-xs font-medium opacity-80">
          ⚠️ Avg cost exceeds ${threshold.toFixed(2)}/record — PadSplit margin is below {((threshold / padSplitCharge) * 100).toFixed(0)}%. Investigate high-cost records immediately.
        </p>
      )}
      {alertLevel === 'warning' && (
        <p className="mt-2 text-xs font-medium opacity-80">
          Avg cost is approaching the ${threshold.toFixed(2)} limit. Monitor closely — above ${warningThreshold.toFixed(2)} for the last {recordCount} records.
        </p>
      )}
    </div>
  );
}
