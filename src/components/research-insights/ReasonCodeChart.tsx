import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ReasonCodeDrillDown } from './ReasonCodeDrillDown';

interface ReasonCodeChartProps {
  data: any;
  onCodeClick?: (code: string) => void;
}

/** Convert qualitative count strings to numeric values */
function qualitativeToNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return 0;
  const n = parseFloat(val);
  if (!isNaN(n)) return n;
  const lower = val.toLowerCase().trim();
  if (lower === 'high') return 4;
  if (lower === 'medium-high') return 3;
  if (lower === 'medium') return 2;
  if (lower === 'low-medium' || lower === 'medium-low') return 1.5;
  if (lower === 'low') return 1;
  return 0;
}

/** Parse percentage range strings like "25-35%" to midpoint */
function parsePct(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/%/g, '').trim();
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Get bar color by severity/count level */
function getBarColor(countVal: any): string {
  const lower = typeof countVal === 'string' ? countVal.toLowerCase().trim() : '';
  if (lower === 'high') return 'hsl(var(--destructive))';
  if (lower === 'medium-high') return 'hsl(25, 95%, 53%)';
  if (lower === 'medium') return 'hsl(45, 93%, 47%)';
  return 'hsl(var(--primary))';
}

export function ReasonCodeChart({ data, onCodeClick }: ReasonCodeChartProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const chartData = data.map((d: any) => {
    const name = d.reason_group || d.code || d.category || 'Unknown';
    const numericCount = qualitativeToNumber(d.count);
    const pctMidpoint = parsePct(d.percentage);
    return {
      name,
      numericValue: pctMidpoint > 0 ? pctMidpoint : numericCount,
      rawCount: d.count, // Keep original for display
      rawPct: d.percentage, // Keep original for display
      description: d.description || '',
      color: getBarColor(d.count),
    };
  }).sort((a: any, b: any) => b.numericValue - a.numericValue);

  const handleClick = (item: any) => {
    if (onCodeClick) {
      onCodeClick(item.name);
      return;
    }
    setSelectedReason(item.name);
    setSelectedColor(item.color);
  };

  return (
    <>
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Reason Code Distribution</CardTitle>
          <Badge variant="secondary">{chartData.length} codes</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 50)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 180, right: 80, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs fill-muted-foreground" />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.length > 28 ? v.slice(0, 28) + '…' : v}
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(_value: number, _name: string, props: any) => {
                  const p = props.payload;
                  return [`${p.rawPct || ''} (${p.rawCount || ''})`, 'Distribution'];
                }}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar
                dataKey="numericValue"
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
                onClick={(_data: any, index: number) => handleClick(chartData[index])}
                label={({ x, y, width: w, height: h, index }: any) => {
                  const item = chartData[index];
                  if (!item) return null;
                  return (
                    <text x={(x || 0) + (w || 0) + 4} y={(y || 0) + (h || 0) / 2 + 4} fontSize={10} fill="hsl(var(--muted-foreground))">
                      {item.rawPct || ''} ({item.rawCount || ''})
                    </text>
                  );
                }}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Toggle for detail cards */}
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="text-xs gap-1 w-full">
            {showDetails ? <><ChevronUp className="w-3 h-3" />Hide details</> : <><ChevronDown className="w-3 h-3" />Show details</>}
          </Button>

          {showDetails && (
            <div className="space-y-2">
              {chartData.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-all border border-border"
                  style={{ borderLeftWidth: '4px', borderLeftColor: item.color }}
                  onClick={() => handleClick(item)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs">{item.rawPct}</Badge>
                        <Badge variant="outline" className="text-xs">{item.rawCount}</Badge>
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!onCodeClick && (
        <ReasonCodeDrillDown
          open={!!selectedReason}
          onOpenChange={(open) => { if (!open) setSelectedReason(null); }}
          reasonCode={selectedReason || ''}
          reasonColor={selectedColor}
        />
      )}
    </>
  );
}
