import { Calendar, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type DateFilterValue = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom';

const presets: { label: string; value: DateFilterValue }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

export interface CustomDateRange {
  from: Date;
  to: Date;
}

interface DateRangeFilterProps {
  onRangeChange?: (range: DateFilterValue, customDates?: CustomDateRange) => void;
  defaultValue?: DateFilterValue;
  includeAllTime?: boolean;
  includeCustom?: boolean;
}

export function DateRangeFilter({ 
  onRangeChange, 
  defaultValue = 'today', 
  includeAllTime = false,
  includeCustom = true,
}: DateRangeFilterProps) {
  const [selected, setSelected] = useState<DateFilterValue>(defaultValue);
  const [customDates, setCustomDates] = useState<DateRange | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetSelect = (value: DateFilterValue) => {
    setSelected(value);
    setCustomDates(undefined);
    onRangeChange?.(value);
    setIsOpen(false);
  };

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    setCustomDates(range);
    if (range?.from && range?.to) {
      setSelected('custom');
      onRangeChange?.('custom', { from: range.from, to: range.to });
    }
  };

  const handleClearCustom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected('today');
    setCustomDates(undefined);
    onRangeChange?.('today');
  };

  const filteredPresets = includeAllTime ? presets : presets.filter(p => p.value !== 'all');
  
  const getDisplayLabel = () => {
    if (selected === 'custom' && customDates?.from && customDates?.to) {
      return `${format(customDates.from, 'MMM d')} - ${format(customDates.to, 'MMM d')}`;
    }
    return presets.find(p => p.value === selected)?.label || 'Select range';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[160px] justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="truncate">{getDisplayLabel()}</span>
          </div>
          {selected === 'custom' ? (
            <X 
              className="w-4 h-4 hover:text-destructive" 
              onClick={handleClearCustom}
            />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Preset options */}
          <div className="border-r border-border p-2 min-w-[140px]">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1">
              Quick Select
            </div>
            {filteredPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset.value)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  selected === preset.value && selected !== 'custom'
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                {preset.label}
              </button>
            ))}
            {includeCustom && (
              <>
                <div className="border-t border-border my-2" />
                <div className={cn(
                  "px-2 py-1.5 text-sm rounded-md",
                  selected === 'custom' ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}>
                  Custom Range
                </div>
              </>
            )}
          </div>
          
          {/* Calendar for custom range */}
          {includeCustom && (
            <div className="p-3">
              <CalendarComponent
                mode="range"
                selected={customDates}
                onSelect={handleCustomDateSelect}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
                className="pointer-events-auto"
              />
              {customDates?.from && customDates?.to && (
                <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {format(customDates.from, 'MMM d, yyyy')} - {format(customDates.to, 'MMM d, yyyy')}
                  </span>
                  <Button 
                    size="sm" 
                    onClick={() => setIsOpen(false)}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
