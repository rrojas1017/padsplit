import { getScoreColor, getScoreTextColor } from '@/utils/coachingCalculations';
import { cn } from '@/lib/utils';

interface TeamScoreCardProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  delay?: number;
}

export function TeamScoreCard({ label, score, icon, delay = 0 }: TeamScoreCardProps) {
  const percentage = (score / 10) * 100;
  
  return (
    <div 
      className="bg-card rounded-xl p-5 border border-border shadow-card animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-muted/50">
          {icon}
        </div>
        <span className={cn("text-3xl font-bold", getScoreTextColor(score))}>
          {score > 0 ? score.toFixed(1) : '—'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{label}</p>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-700", getScoreColor(score))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
