import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AggResult } from '@/hooks/useAudienceSurveyResponses';

interface QuestionResponseCardProps {
  questionNumber: number;
  label: string;
  type: 'multi' | 'yesno';
  data: AggResult[];
  boolData?: { yes: number; no: number; total: number; pct: number };
  totalRecords: number;
  id?: string;
}

export function QuestionResponseCard({ questionNumber, label, type, data, boolData, totalRecords, id }: QuestionResponseCardProps) {
  const maxCount = data.length > 0 ? data[0].count : 1;
  const respondedCount = type === 'yesno' ? (boolData?.total || 0) : data.reduce((sum, d) => sum + d.count, 0);
  const responseRate = totalRecords > 0 ? Math.round((type === 'yesno' ? (boolData?.total || 0) : Math.min(respondedCount, totalRecords)) / totalRecords * 100) : 0;

  const typeLabel = type === 'multi' ? 'Multiple Select' : 'Yes / No';

  return (
    <Card id={id} className="shadow-sm">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">Q{questionNumber}</span>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground leading-snug">{label}</p>
              <Badge variant="outline" className="mt-1 text-[10px]">{typeLabel}</Badge>
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {type === 'yesno' ? (boolData?.total || 0) : totalRecords} responses
          </span>
        </div>

        {/* Content by type */}
        {type === 'multi' && (
          <div className="space-y-2">
            {data.map((item) => {
              const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="relative h-8 rounded bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/20 rounded transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="relative h-full flex items-center px-3">
                        <span className="text-sm text-foreground truncate">{item.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right w-20">
                    <span className="text-sm font-medium text-foreground">{item.count}</span>
                    <span className="text-xs text-muted-foreground ml-1">({item.pct}%)</span>
                  </div>
                </div>
              );
            })}
            {/* Stats footer */}
            <div className="border-t pt-3 mt-3 text-xs text-muted-foreground flex items-center gap-3">
              <span>📊 {data.length} unique answers</span>
              {data[0] && <span>· Most common: {data[0].label} ({data[0].pct}%)</span>}
            </div>
          </div>
        )}

        {type === 'yesno' && boolData && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2.5">
                <span className="text-sm font-medium text-green-700">Yes</span>
                <span className="ml-auto text-sm font-bold text-green-700">{boolData.yes}</span>
                <span className="text-xs text-green-600">({boolData.pct}%)</span>
              </div>
              <div className="flex-1 flex items-center gap-2 rounded-full bg-muted border px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground">No</span>
                <span className="ml-auto text-sm font-bold text-foreground">{boolData.no}</span>
                <span className="text-xs text-muted-foreground">({boolData.total > 0 ? 100 - boolData.pct : 0}%)</span>
              </div>
            </div>
            <div className="border-t pt-3 text-xs text-muted-foreground">
              {boolData.total} of {totalRecords} responded ({responseRate}%)
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
