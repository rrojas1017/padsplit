import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HostFlag {
  flag?: string;
  severity?: string;
  [key: string]: any;
}

interface HostAccountabilityPanelProps {
  data: HostFlag[];
  maxVisible?: number;
}

function parseSeverity(sev: string): { label: string; level: number; color: string } {
  const lower = sev.toLowerCase();
  if (lower.includes('p0') || lower.includes('critical'))
    return { label: sev, level: 0, color: 'bg-destructive/15 text-destructive border-destructive/30' };
  if (lower.includes('p1') || lower.includes('high'))
    return { label: sev, level: 1, color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
  return { label: sev, level: 2, color: 'bg-muted text-muted-foreground border-border' };
}

function severityBorderColor(level: number): string {
  if (level === 0) return 'hsl(var(--destructive))';
  if (level === 1) return 'hsl(25, 95%, 53%)';
  return 'hsl(var(--border))';
}

export function HostAccountabilityPanel({ data, maxVisible }: HostAccountabilityPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    if (!data?.length) return [];
    return data.map(rawItem => {
      const item: HostFlag = typeof rawItem === 'string' ? { flag: rawItem, severity: '' } : rawItem;
      const sev = parseSeverity(item.severity || '');
      return { item, sev };
    }).sort((a, b) => a.sev.level - b.sev.level);
  }, [data]);

  if (!sorted.length) return null;

  const visible = maxVisible && !showAll ? sorted.slice(0, maxVisible) : sorted;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Home className="w-4 h-4 text-orange-500" />
          </div>
          Host Accountability Flags
          <Badge variant="secondary" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map(({ item, sev }, i) => (
          <FlagRow key={i} item={item} sev={sev} />
        ))}
        {maxVisible && sorted.length > maxVisible && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full text-primary">
            Show all {sorted.length} flags
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function FlagRow({ item, sev }: { item: HostFlag; sev: { label: string; level: number; color: string } }) {
  const [open, setOpen] = useState(false);
  const flagText = item.flag || '';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="border border-border rounded-lg overflow-hidden"
        style={{ borderLeftWidth: '4px', borderLeftColor: severityBorderColor(sev.level) }}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <p className="text-sm text-foreground flex-1">{flagText}</p>
            {sev.label && <Badge variant="outline" className={`text-xs flex-shrink-0 ${sev.color}`}>{sev.label}</Badge>}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">This flag has been identified from member transcriptions and requires attention based on the severity level indicated.</p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
