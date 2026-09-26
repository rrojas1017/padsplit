import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Moved verbatim from PaymentExperienceInsightsDashboard.tsx (CR-010 Phase 2).

export interface KPIProps {
  label: string;
  value: string;
  denominator?: string;
  meta?: string;
  caption?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  variant?: 'default' | 'primary';
  accent?: 'green' | 'orange';
}

export function KPI({
  label, value, denominator, meta, caption, icon, iconBg, iconColor,
  variant = 'default', accent,
}: KPIProps) {
  const isPrimary = variant === 'primary';
  const accentBar =
    accent === 'green' ? 'before:bg-green-500/60'
    : accent === 'orange' ? 'before:bg-orange-500/60'
    : '';

  return (
    <Card
      className={cn(
        'h-full',
        isPrimary && 'relative overflow-hidden border-slate-300/80 dark:border-slate-700 before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:rounded-t-xl',
        isPrimary && accentBar,
      )}
    >
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p
              className={cn(
                'text-[13px] font-medium tracking-wide',
                isPrimary ? 'text-foreground/80' : 'text-muted-foreground uppercase',
              )}
            >
              {label}
            </p>
            <p
              className={cn(
                'font-bold tracking-tight text-foreground leading-none',
                isPrimary ? 'text-4xl md:text-[3rem] md:leading-none' : 'text-4xl',
              )}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              iconBg ?? 'bg-muted',
              iconColor ?? 'text-muted-foreground',
            )}
          >
            {icon}
          </div>
        </div>
        <div className="mt-auto pt-3 min-h-[40px] space-y-0.5">
          {denominator && (
            <p className="text-[11px] text-muted-foreground leading-snug break-words">{denominator}</p>
          )}
          {meta && (
            <p className="text-[11px] text-muted-foreground/70 leading-snug break-words">{meta}</p>
          )}
          {caption && (
            <p
              className={cn(
                'leading-snug break-words italic',
                isPrimary ? 'text-[12px] text-muted-foreground/90' : 'text-[11px] text-muted-foreground/70',
              )}
            >
              {caption}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { KPI as KpiTile };
