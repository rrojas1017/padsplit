import { Check, X } from 'lucide-react';
import { PasswordStrengthResult } from '@/utils/passwordValidation';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  result: PasswordStrengthResult;
  show: boolean;
}

export function PasswordStrengthIndicator({ result, show }: PasswordStrengthIndicatorProps) {
  if (!show) return null;

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 0: return 'bg-destructive';
      case 1: return 'bg-destructive';
      case 2: return 'bg-warning';
      case 3: return 'bg-accent';
      case 4: return 'bg-accent';
      default: return 'bg-muted';
    }
  };

  const getTextColor = (score: number) => {
    switch (score) {
      case 0: return 'text-destructive';
      case 1: return 'text-destructive';
      case 2: return 'text-warning';
      case 3: return 'text-accent';
      case 4: return 'text-accent';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3 mt-3 p-3 rounded-lg bg-muted/50 border border-border">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Password strength</span>
          <span className={cn('text-xs font-medium', getTextColor(result.score))}>
            {result.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                index <= result.score ? getStrengthColor(result.score) : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1">
        {result.requirements.map((req) => (
          <div
            key={req.key}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors duration-200',
              req.met ? 'text-accent' : 'text-muted-foreground'
            )}
          >
            {req.met ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
