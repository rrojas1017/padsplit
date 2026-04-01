import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck, ThumbsUp, AlertTriangle, Lightbulb } from 'lucide-react';

interface AgentPerformanceProps {
  data: {
    strengths?: string | string[];
    areas_for_improvement?: string | string[];
    recommendations?: string | string[];
    // Legacy
    weaknesses?: string | string[];
    coaching_opportunities?: any[];
    opportunities_for_improvement?: any[];
  };
}

function toArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : JSON.stringify(v));
  if (typeof val === 'string') {
    // Try to split on numbered patterns or sentence boundaries
    const parts = val.split(/(?:\n\d+\.\s|\n[-•]\s)/).map(s => s.trim()).filter(s => s.length > 10);
    if (parts.length > 1) return parts;
    return val.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
  }
  return [];
}

function ListSection({ items, icon: Icon, title, accent }: { items: string[]; icon: any; title: string; accent: string }) {
  if (!items.length) return null;
  const borderColor = accent === 'emerald' ? 'border-l-emerald-500' : accent === 'amber' ? 'border-l-amber-500' : 'border-l-blue-500';
  const dotColor = accent === 'emerald' ? 'bg-emerald-500' : accent === 'amber' ? 'bg-amber-500' : 'bg-blue-500';
  const iconColor = accent === 'emerald' ? 'text-emerald-500' : accent === 'amber' ? 'text-amber-500' : 'text-blue-500';

  return (
    <div className={`border-l-4 ${borderColor} pl-4 space-y-2`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</p>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
          <p className="text-sm text-muted-foreground">{item}</p>
        </div>
      ))}
    </div>
  );
}

export function AgentPerformanceCard({ data }: AgentPerformanceProps) {
  if (!data) return null;

  const strengths = toArray(data.strengths);
  const improvements = toArray(data.areas_for_improvement || data.weaknesses);
  const recommendations = toArray(data.recommendations);

  if (!strengths.length && !improvements.length && !recommendations.length) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          Agent Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ListSection items={strengths} icon={ThumbsUp} title="Strengths" accent="emerald" />
        <ListSection items={improvements} icon={AlertTriangle} title="Areas for Improvement" accent="amber" />
        <ListSection items={recommendations} icon={Lightbulb} title="Recommendations" accent="blue" />
      </CardContent>
    </Card>
  );
}
