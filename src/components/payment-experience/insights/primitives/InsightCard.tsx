import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function InsightCard({ title, icon, rightSlot, className, children }: InsightCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      {(title || icon || rightSlot) && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2 min-w-0">
              {icon}
              <span className="truncate">{title}</span>
            </CardTitle>
            {rightSlot}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(title ? 'pt-0' : 'pt-6')}>{children}</CardContent>
    </Card>
  );
}
