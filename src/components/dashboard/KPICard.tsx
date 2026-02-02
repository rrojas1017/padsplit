import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KPIData } from '@/types';

interface KPICardProps {
  data: KPIData;
  icon?: React.ReactNode;
  delay?: number;
}

export function KPICard({ data, icon, delay = 0 }: KPICardProps) {
  const { label, value, previousValue, change, changeType, comparisonLabel } = data;

  const changeIcon = {
    increase: <TrendingUp className="w-4 h-4" />,
    decrease: <TrendingDown className="w-4 h-4" />,
    neutral: <Minus className="w-4 h-4" />,
  };

  const changeColor = {
    increase: 'text-success bg-success/10',
    decrease: 'text-destructive bg-destructive/10',
    neutral: 'text-muted-foreground bg-muted',
  };

  return (
    <div 
      className="bg-card rounded-xl p-6 border border-border shadow-card animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">
            vs {previousValue} {comparisonLabel || 'yesterday'}
          </p>
        </div>
        
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
          changeColor[changeType]
        )}>
          {changeIcon[changeType]}
          <span>{change > 0 ? '+' : ''}{change}%</span>
        </div>
      </div>
    </div>
  );
}
