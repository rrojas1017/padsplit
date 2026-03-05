import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft } from 'lucide-react';

interface TransferFrictionProps {
  data: {
    considered_transfer: number;
    considered_transfer_pct: number;
    unaware_of_option: number;
    unaware_pct: number;
    blocked_by_balance: number;
    blocked_by_availability: number;
    transfer_would_have_retained: number;
    recommendation: string;
  };
}

export function TransferFrictionCard({ data }: TransferFrictionProps) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-violet-500" />
          Transfer Friction Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{data.considered_transfer}</p>
            <p className="text-xs text-muted-foreground">Considered ({data.considered_transfer_pct?.toFixed(0)}%)</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{data.unaware_of_option}</p>
            <p className="text-xs text-muted-foreground">Unaware ({data.unaware_pct?.toFixed(0)}%)</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{data.blocked_by_balance}</p>
            <p className="text-xs text-muted-foreground">Blocked by Balance</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-emerald-500/10">
            <p className="text-lg font-bold text-emerald-600">{data.transfer_would_have_retained}</p>
            <p className="text-xs text-muted-foreground">Would Have Retained</p>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-sm text-foreground">{data.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
