import { Card, CardContent } from '@/components/ui/card';
import { PriorityBadge } from './PriorityBadge';
import { Info } from 'lucide-react';

const levels = [
  { priority: 'P0', description: 'Critical — Requires immediate action, significant impact on retention or operations' },
  { priority: 'P1', description: 'High Priority — Should be addressed soon, measurable impact expected' },
  { priority: 'P2', description: 'Medium Priority — Worth monitoring and planning for, lower urgency' },
];

export function PriorityGlossary() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Priority Levels</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {levels.map(({ priority, description }) => (
            <div key={priority} className="flex items-center gap-2">
              <PriorityBadge priority={priority} />
              <span className="text-xs text-muted-foreground">{description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
