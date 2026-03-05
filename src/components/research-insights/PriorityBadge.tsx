import { Badge } from '@/components/ui/badge';

interface PriorityBadgeProps {
  priority?: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (!priority) return null;
  
  const p = priority.toUpperCase();
  
  if (p.includes('P0')) {
    return <Badge variant="destructive">P0</Badge>;
  }
  if (p.includes('P1')) {
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">P1</Badge>;
  }
  if (p.includes('P2')) {
    return <Badge variant="outline" className="text-blue-500 border-blue-500/30">P2</Badge>;
  }
  return <Badge variant="outline">{priority}</Badge>;
}
