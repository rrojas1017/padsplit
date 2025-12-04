import { useState } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  label: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

const presets = [
  { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Yesterday', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'This Week', getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'Last 7 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: 'Last 30 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

export function DateRangePicker({ label, dateRange, onDateRangeChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (getValue: () => DateRange) => {
    onDateRangeChange(getValue());
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange({ from: undefined, to: undefined });
  };

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) return 'All';
    if (dateRange.from && dateRange.to) {
      if (format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
        return format(dateRange.from, 'MMM d, yyyy');
      }
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    if (dateRange.from) return `From ${format(dateRange.from, 'MMM d, yyyy')}`;
    return 'All';
  };

  const hasSelection = dateRange.from || dateRange.to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal gap-2",
            !hasSelection && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="text-xs text-muted-foreground mr-1">{label}:</span>
          <span className="truncate">{formatDateRange()}</span>
          {hasSelection && (
            <X
              className="h-3 w-3 ml-auto opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r border-border p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Quick Select</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm font-normal"
                onClick={() => handlePresetClick(preset.getValue)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm font-normal text-muted-foreground"
              onClick={() => {
                onDateRangeChange({ from: undefined, to: undefined });
                setOpen(false);
              }}
            >
              All Time
            </Button>
          </div>
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                onDateRangeChange({ from: range?.from, to: range?.to });
                if (range?.from && range?.to) {
                  setOpen(false);
                }
              }}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
