import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { ReasonCodeDrillDown } from './ReasonCodeDrillDown';

const DEFAULT_VISIBLE = 8;

interface ReasonCodeChartProps {
  data: any;
  onCodeClick?: (code: string) => void;
}

export function ReasonCodeChart({ data, onCodeClick }: ReasonCodeChartProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[] | undefined>();
  const [selectedIncludedCodes, setSelectedIncludedCodes] = useState<string[] | undefined>();
  const [selectedDescription, setSelectedDescription] = useState<string | undefined>();
  const [showAll, setShowAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!data) return null;

  let chartData: Array<{ name: string; count: number; pct: number; details?: string; bookingIds?: string[]; includedCodes?: string[] }> = [];
  let totalCases: number | undefined;
  let preventable: number | undefined;
  let unpreventable: number | undefined;
  let methodology: string | undefined;

  // Handle plain object map format: { "Payment": 5, "Host": 3 }
  if (data && typeof data === 'object' && !Array.isArray(data) && !('by_category' in data) && !('distribution' in data) && !('total_cases' in data)) {
    const map = data as Record<string, number>;
    const total = Object.values(map).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0);
    chartData = Object.entries(map).map(([key, val]) => ({
      name: key,
      count: typeof val === 'number' ? val : 0,
      pct: total > 0 ? ((typeof val === 'number' ? val : 0) / total * 100) : 0,
    }));
  } else if (Array.isArray(data)) {
    chartData = data.map((d: any) => ({
      name: d.code || d.reason_group || d.category || 'Unknown',
      count: d.count,
      pct: d.pct ?? d.percentage ?? 0,
      details: d.details || d.description,
      bookingIds: d.booking_ids,
      includedCodes: d.reason_codes_included,
    }));
  } else {
    totalCases = data.total_cases;
    preventable = data.preventable_churn;
    unpreventable = data.unpreventable_churn;
    methodology = data.methodology;
    if (data.by_category?.length) {
      chartData = data.by_category.map((d: any) => ({
        name: d.category,
        count: d.count,
        pct: d.percentage,
        details: d.description,
        bookingIds: d.booking_ids,
        includedCodes: d.reason_codes_included,
      }));
    } else if (data.distribution?.length) {
      chartData = data.distribution.map((d: any) => ({
        name: d.reason_group,
        count: d.count,
        pct: d.percentage,
        details: d.details,
        bookingIds: d.booking_ids,
        includedCodes: d.reason_codes_included,
      }));
    }
  }

  if (!chartData.length) return null;

  const sorted = [...chartData].sort((a, b) => b.count - a.count);
  const totalItems = sorted.length;

  // Cap visible items
  const visibleCount = showAll ? totalItems : Math.min(DEFAULT_VISIBLE, totalItems);
  let displayData = sorted.slice(0, visibleCount);

  // If capped and there are more, add "Other" row
  if (!showAll && totalItems > DEFAULT_VISIBLE) {
    const rest = sorted.slice(DEFAULT_VISIBLE);
    const otherCount = rest.reduce((s, r) => s + r.count, 0);
    const otherPct = rest.reduce((s, r) => s + r.pct, 0);
    displayData.push({
      name: `Other (${rest.length})`,
      count: otherCount,
      pct: otherPct,
      details: `Aggregated from ${rest.length} smaller categories`,
    });
  }

  const COLORS = [
    'hsl(var(--destructive))',
    'hsl(142, 71%, 45%)',
    'hsl(45, 93%, 47%)',
    'hsl(var(--primary))',
    'hsl(var(--muted-foreground))',
    'hsl(262, 83%, 58%)',
  ];

  const handleReasonClick = (item: typeof displayData[0], colorIndex: number) => {
    if (onCodeClick) {
      onCodeClick(item.name);
      return;
    }
    setSelectedReason(item.name);
    setSelectedColor(COLORS[colorIndex % COLORS.length]);
    setSelectedBookingIds(item.bookingIds);
    setSelectedIncludedCodes(item.includedCodes);
    setSelectedDescription(item.details);
  };

  return (
    <>
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Reason Code Distribution</CardTitle>
          {totalItems > DEFAULT_VISIBLE && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs gap-1">
              {showAll ? <><ChevronUp className="w-3 h-3" />Show top {DEFAULT_VISIBLE}</> : <><ChevronDown className="w-3 h-3" />Show all {totalItems}</>}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {totalCases != null && (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
                <p className="text-lg font-bold text-foreground">{totalCases}</p>
                <p className="text-xs text-muted-foreground">Total Cases</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-destructive/5 to-destructive/15 border border-destructive/20">
                <p className="text-lg font-bold text-destructive">{preventable}</p>
                <p className="text-xs text-muted-foreground">Preventable</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
                <p className="text-lg font-bold text-foreground">{unpreventable}</p>
                <p className="text-xs text-muted-foreground">Unpreventable</p>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={Math.max(250, displayData.length * 50)}>
            <BarChart data={displayData} layout="vertical" margin={{ left: 180, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs fill-muted-foreground" />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ fontSize: 11, cursor: 'pointer' }}
                className="fill-muted-foreground"
                onClick={(_data: any, index: number) => {
                  if (index >= 0 && index < displayData.length) {
                    handleReasonClick(displayData[index], index);
                  }
                }}
              />
              <Tooltip
                formatter={(value: number, _name: string, props: any) => {
                  const pct = typeof props.payload.pct === 'number' ? props.payload.pct : parseFloat(String(props.payload.pct || 0));
                  return [`${value} cases (${isNaN(pct) ? '—' : pct.toFixed(1)}%)`, 'Count'];
                }}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(_data: any, index: number) => handleReasonClick(displayData[index], index)}>
                {displayData.map((_entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Toggle for detail cards */}
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="text-xs gap-1 w-full">
            {showDetails ? <><ChevronUp className="w-3 h-3" />Hide category details</> : <><ChevronDown className="w-3 h-3" />Show category details</>}
          </Button>

          {showDetails && (
            <div className="space-y-2">
              {displayData.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-all duration-200 group border border-border overflow-hidden"
                  style={{ borderLeftWidth: '4px', borderLeftColor: COLORS[i % COLORS.length] }}
                  onClick={() => handleReasonClick(item, i)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">{item.name}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="secondary">{item.count} ({typeof item.pct === 'number' ? item.pct.toFixed(1) : parseFloat(String(item.pct || 0)).toFixed(1)}%)</Badge>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {item.details && (
                      <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {methodology && (
            <p className="text-xs text-muted-foreground italic border-t border-border pt-3">{methodology}</p>
          )}
        </CardContent>
      </Card>

      {!onCodeClick && (
        <ReasonCodeDrillDown
          open={!!selectedReason}
          onOpenChange={(open) => { if (!open) setSelectedReason(null); }}
          reasonCode={selectedReason || ''}
          reasonColor={selectedColor}
          bookingIds={selectedBookingIds}
          includedReasonCodes={selectedIncludedCodes}
          categoryDescription={selectedDescription}
        />
      )}
    </>
  );
}
