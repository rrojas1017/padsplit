import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Download } from 'lucide-react';
import type { ExportFilter } from '@/hooks/useExportMembers';

interface FrictionPoint {
  point: string;
  description?: string;
  quote?: string;
  impact?: string;
  count?: number;
  percentage?: number;
  cases?: number;
  frequency?: number;
}

interface PaymentFrictionProps {
  data: {
    summary?: string;
    key_friction_points?: FrictionPoint[];
    key_failures?: string[];
    recommendation?: string;
    payment_related_moveouts?: number;
    payment_related_pct?: number;
    saveable_with_extension?: number;
    saveable_pct?: number;
    friction_points?: any[];
    stats?: Record<string, any>;
  };
}

function parseFrictionFromText(summary: string): FrictionPoint[] {
  if (!summary) return [];
  const lines = summary.split(/\n/).filter(Boolean);
  const items: FrictionPoint[] = [];
  for (const line of lines) {
    const numbered = line.match(/^\s*\d+[\.\)]\s*\**(.+?)\**\s*[-–—:]\s*(.+)/i);
    if (numbered) {
      const countMatch = numbered[2].match(/(\d+)\s*(cases?|members?|respondents?)/i);
      items.push({
        point: numbered[1].trim().replace(/\*+/g, ''),
        description: numbered[2].trim().replace(/\*+/g, ''),
        count: countMatch ? parseInt(countMatch[1]) : undefined,
      });
      continue;
    }
    const bullet = line.match(/^\s*[-•*]\s*\**(.+?)\**\s*[-–—:]\s*(.+)/i);
    if (bullet) {
      const countMatch = bullet[2].match(/(\d+)\s*(cases?|members?|respondents?)/i);
      items.push({
        point: bullet[1].trim().replace(/\*+/g, ''),
        description: bullet[2].trim().replace(/\*+/g, ''),
        count: countMatch ? parseInt(countMatch[1]) : undefined,
      });
      continue;
    }
    const bold = line.match(/\*\*(.+?)\*\*[:\s]*(.+)/);
    if (bold) {
      const countMatch = bold[2].match(/(\d+)\s*(cases?|members?|respondents?)/i);
      items.push({
        point: bold[1].trim(),
        description: bold[2].trim(),
        count: countMatch ? parseInt(countMatch[1]) : undefined,
      });
    }
  }
  return items;
}

function getCount(fp: FrictionPoint): number {
  return fp.count ?? fp.cases ?? fp.frequency ?? 0;
}

function FrictionBar({ point, maxCount }: { point: FrictionPoint; maxCount: number }) {
  const count = getCount(point);
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground truncate mr-2">{point.point}</span>
        <span className="text-muted-foreground whitespace-nowrap text-xs">
          {count > 0 ? `${count} cases` : point.description || ''}
        </span>
      </div>
      {count > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PaymentFrictionCard({ data }: PaymentFrictionProps) {
  const [exporting, setExporting] = useState(false);
  if (!data) return null;

  let points: FrictionPoint[] = [];
  if (data.key_friction_points?.length) {
    points = data.key_friction_points;
  } else if ((data as any).friction_points?.length) {
    points = (data as any).friction_points.map((fp: any) =>
      typeof fp === 'string' ? { point: fp } : fp
    );
  } else if (data.key_failures?.length) {
    points = data.key_failures.map(f => ({ point: f }));
  } else if (data.summary) {
    points = parseFrictionFromText(data.summary);
  }

  points.sort((a, b) => getCount(b) - getCount(a));
  const maxCount = points.length > 0 ? Math.max(...points.map(getCount)) : 0;

  const affected = data.payment_related_moveouts ?? (data.stats as any)?.payment_related_moveouts;
  const affectedPct = data.payment_related_pct ?? (data.stats as any)?.payment_related_pct;

  const handleExport = async () => {
    setExporting(true);
    try {
      const keywords = ['payment', 'flexirent', 'flexipay', 'flex pay', 'late fee', 'balance', 'rent'];
      const count = await exportByKeywords(keywords, 'payment-friction-members.csv');
      toast.success(`Exported ${count} payment friction records`);
    } catch (e) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
            Payment Friction Analysis
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {affected != null && (
          <div className="flex items-center gap-4">
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border flex-1">
              <p className="text-2xl font-bold text-foreground">{affected}</p>
              <p className="text-xs text-muted-foreground">
                Members affected{affectedPct != null ? ` (${typeof affectedPct === 'number' ? affectedPct.toFixed(0) : affectedPct}%)` : ''}
              </p>
            </div>
            {data.saveable_with_extension != null && (
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/15 border border-emerald-500/20 flex-1">
                <p className="text-2xl font-bold text-emerald-600">{data.saveable_with_extension}</p>
                <p className="text-xs text-muted-foreground">
                  Saveable{data.saveable_pct != null ? ` (${data.saveable_pct.toFixed(0)}%)` : ''}
                </p>
              </div>
            )}
          </div>
        )}

        {points.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Friction Points</p>
            {points.map((fp, i) => (
              <FrictionBar key={i} point={fp} maxCount={maxCount} />
            ))}
          </div>
        )}

        {!points.length && data.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
        )}

        {data.recommendation && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Recommendation</p>
            <p className="text-sm text-foreground">{data.recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
