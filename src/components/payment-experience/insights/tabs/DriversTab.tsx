import { AlertTriangle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader } from '../primitives/SectionHeader';
import { KeyDriversSection } from '../KeyDriversSection';
import { RankedBarList } from '../visuals/RankedBarList';
import type { DriverInsight } from '@/utils/paymentExperienceAnalytics';
import type {
  AutopayBarrierAgg,
  FrictionSummary,
  FrictionThemeAgg,
  PaymentKPIs,
} from '@/hooks/usePaymentExperienceResponses';

interface DriversTabProps {
  kpis: PaymentKPIs;
  topFrictionThemes: FrictionThemeAgg[];
  frictionSummary: FrictionSummary;
  autopayBarriers: AutopayBarrierAgg[];
  keyDrivers: DriverInsight[];
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground py-2">{children}</p>;
}

export function DriversTab({
  kpis,
  topFrictionThemes,
  frictionSummary,
  autopayBarriers,
  keyDrivers,
}: DriversTabProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Payment Friction Summary */}
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Payment Friction Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {frictionSummary.noFrictionCount > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                {Math.round(frictionSummary.noFrictionShare * 100)}% reported no major payment friction
              </p>
            )}
            {topFrictionThemes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {frictionSummary.noFrictionCount > 0
                  ? 'No additional friction themes reported.'
                  : 'Not enough qualitative friction data yet.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {topFrictionThemes.map((t) => (
                  <li key={t.key} className="border-b border-border last:border-0 pb-2 last:pb-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm font-medium text-foreground min-w-0 truncate">{t.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {t.count} · {Math.round(t.share * 100)}%
                      </span>
                    </div>
                    {t.sampleQuote && (
                      <p className="text-xs text-muted-foreground italic mt-1 line-clamp-4 break-words">
                        "{t.sampleQuote}"
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Auto-pay Barriers */}
        {autopayBarriers.length > 0 && (
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                Auto-pay Barriers
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                Among {kpis.autopayEnrolled.denominator - kpis.autopayEnrolled.numerator} not-enrolled members
              </p>
              <RankedBarList
                tone="blue"
                rows={autopayBarriers.map((b) => ({
                  label: b.label,
                  count: b.count,
                  share: b.share,
                  detail: b.topUnlock ? (
                    <>
                      <span className="text-foreground/70 font-medium">Unlock:</span> {b.topUnlock}
                    </>
                  ) : undefined,
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <SectionHeader title="Key Drivers" />
      {keyDrivers.length > 0 ? (
        <KeyDriversSection drivers={keyDrivers} />
      ) : (
        <EmptyHint>No driver comparisons available yet.</EmptyHint>
      )}
    </div>
  );
}
