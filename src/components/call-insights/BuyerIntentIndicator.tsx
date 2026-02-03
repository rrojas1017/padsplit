import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Flame, Thermometer, Snowflake, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuyerIntent } from '@/types';

interface BuyerIntentIndicatorProps {
  intent: BuyerIntent;
  size?: 'sm' | 'md' | 'lg';
  showSignals?: boolean;
}

const getIntentConfig = (level: BuyerIntent['intentLevel']) => {
  switch (level) {
    case 'hot':
      return {
        icon: Flame,
        label: 'HOT',
        className: 'bg-destructive/20 text-destructive border-destructive/30',
        iconClassName: 'text-destructive',
        description: 'High conversion potential',
      };
    case 'warm':
      return {
        icon: Thermometer,
        label: 'WARM',
        className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
        iconClassName: 'text-orange-500',
        description: 'Interested, needs nurturing',
      };
    case 'cold':
      return {
        icon: Snowflake,
        label: 'COLD',
        className: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30',
        iconClassName: 'text-sky-500',
        description: 'Low immediate potential',
      };
  }
};

const getTimeframeLabel = (timeframe: BuyerIntent['timeframe']) => {
  switch (timeframe) {
    case 'immediate': return 'Moving ASAP';
    case 'this_week': return 'This week';
    case 'this_month': return 'This month';
    case 'exploring': return 'Just exploring';
  }
};

export function BuyerIntentIndicator({ 
  intent, 
  size = 'md',
  showSignals = true 
}: BuyerIntentIndicatorProps) {
  const config = getIntentConfig(intent.intentLevel);
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'font-semibold cursor-help gap-1',
              sizeClasses[size],
              config.className
            )}
          >
            <Icon className={cn(iconSizes[size], config.iconClassName)} />
            {config.label}
            <span className="opacity-70 font-normal">{intent.score}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', config.iconClassName)} />
                <span className="font-semibold">{config.label} Lead</span>
              </div>
              <span className="text-lg font-bold">{intent.score}/100</span>
            </div>
            
            <p className="text-xs text-muted-foreground">{config.description}</p>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Timeline:</span>
              <span className="font-medium">{getTimeframeLabel(intent.timeframe)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Decision Maker:</span>
              <span className={cn('font-medium', intent.decisionMaker ? 'text-success' : 'text-amber-500')}>
                {intent.decisionMaker ? 'Yes' : 'No'}
              </span>
            </div>

            {showSignals && (
              <>
                {intent.positiveSignals.length > 0 && (
                  <div className="pt-1 border-t">
                    <div className="flex items-center gap-1 text-xs text-success mb-1">
                      <TrendingUp className="h-3 w-3" />
                      <span className="font-medium">Positive Signals</span>
                    </div>
                    <ul className="space-y-0.5">
                      {intent.positiveSignals.slice(0, 3).map((signal, i) => (
                        <li key={i} className="text-xs text-muted-foreground pl-4">• {signal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {intent.negativeSignals.length > 0 && (
                  <div className="pt-1 border-t">
                    <div className="flex items-center gap-1 text-xs text-destructive mb-1">
                      <TrendingDown className="h-3 w-3" />
                      <span className="font-medium">Negative Signals</span>
                    </div>
                    <ul className="space-y-0.5">
                      {intent.negativeSignals.slice(0, 3).map((signal, i) => (
                        <li key={i} className="text-xs text-muted-foreground pl-4">• {signal}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact badge version for use in tables/lists
export function BuyerIntentBadge({ intent }: { intent: BuyerIntent }) {
  const config = getIntentConfig(intent.intentLevel);
  const Icon = config.icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold cursor-help',
            config.className
          )}>
            <Icon className={cn('h-3 w-3', config.iconClassName)} />
            <span>{intent.score}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span className="font-semibold">{config.label}</span> - {config.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
