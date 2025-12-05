import { PatternItem } from '@/utils/coachingCalculations';
import { ThumbsUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CommonPatternsSectionProps {
  strengths: PatternItem[];
  improvements: PatternItem[];
}

export function CommonPatternsSection({ strengths, improvements }: CommonPatternsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Strengths */}
      <div className="bg-card rounded-xl p-5 border border-border shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-success/10">
            <ThumbsUp className="w-4 h-4 text-success" />
          </div>
          <h3 className="font-semibold text-foreground">Top Team Strengths</h3>
        </div>
        {strengths.length === 0 ? (
          <p className="text-sm text-muted-foreground">No strength patterns identified yet</p>
        ) : (
          <ul className="space-y-2">
            {strengths.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-foreground">{item.text}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {item.count}x
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Areas for Improvement */}
      <div className="bg-card rounded-xl p-5 border border-border shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-warning/10">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground">Common Areas for Improvement</h3>
        </div>
        {improvements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No improvement patterns identified yet</p>
        ) : (
          <ul className="space-y-2">
            {improvements.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-foreground">{item.text}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {item.count}x
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
