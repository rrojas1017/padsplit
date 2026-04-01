interface RankedItem {
  label: string;
  count: number;
  pct?: number;
}

interface Props {
  items: RankedItem[];
  maxItems?: number;
}

export function RankedItemsTable({ items, maxItems = 10 }: Props) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">No data</p>;

  const sorted = [...items].sort((a, b) => b.count - a.count).slice(0, maxItems);
  const maxCount = sorted[0]?.count || 1;

  return (
    <div className="space-y-2">
      {sorted.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm text-foreground truncate">{item.label}</span>
              <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                {item.count}{item.pct != null ? ` (${Math.round(item.pct)}%)` : ''}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
