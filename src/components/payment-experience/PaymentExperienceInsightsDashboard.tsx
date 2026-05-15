import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { Users, BookOpen, Repeat, FileQuestion, ShieldAlert, CalendarClock } from 'lucide-react';
import { usePaymentExperienceResponses } from '@/hooks/usePaymentExperienceResponses';

interface KPIProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
}

function KPI({ label, value, sublabel, icon }: KPIProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v)}%`;
}

function fmtNum(v: number | null, max: number): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}/${max}`;
}

export function PaymentExperienceInsightsDashboard() {
  const { records, kpis, isLoading } = usePaymentExperienceResponses();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const allValidationSample =
    records.length > 0 && records.every((r) => r.retag_source === 'payment_keyword_validation');

  return (
    <div className="space-y-4">
      {allValidationSample && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            Validation sample — keyword-detected records only. Permanent linkage pending.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI
          label="Members Surveyed"
          value={kpis.totalSurveyed.toString()}
          icon={<Users className="w-4 h-4" />}
        />
        <KPI
          label="Avg Payment Literacy"
          value={fmtNum(kpis.avgLiteracyScore, 100)}
          sublabel="Composite of Q1-Q4"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <KPI
          label="Auto-pay Enrolled"
          value={fmtPct(kpis.autopayEnrolledPct)}
          icon={<Repeat className="w-4 h-4" />}
        />
        <KPI
          label="Move-in Cost Clarity"
          value={fmtNum(kpis.avgMoveInClarity, 5)}
          sublabel="Q10 (1-5 scale)"
          icon={<FileQuestion className="w-4 h-4" />}
        />
        <KPI
          label="Hardship-Aware"
          value={fmtPct(kpis.hardshipAwarePct)}
          sublabel="Knew at least one option"
          icon={<ShieldAlert className="w-4 h-4" />}
        />
        <KPI
          label="Pay-cycle Misalignment"
          value={fmtPct(kpis.payCycleMisalignmentPct)}
          sublabel="Not on weekly cadence"
          icon={<CalendarClock className="w-4 h-4" />}
        />
      </div>

      {records.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No Payment Experience survey calls processed yet. When calls are tagged to the
            "Payments Research Campaign" and processed, the KPIs above will populate.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
