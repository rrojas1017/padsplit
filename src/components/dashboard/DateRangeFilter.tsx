import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

export type DateFilterValue = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all';

const presets: { label: string; value: DateFilterValue }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

interface DateRangeFilterProps {
  onRangeChange?: (range: DateFilterValue) => void;
  defaultValue?: DateFilterValue;
  includeAllTime?: boolean;
}

export function DateRangeFilter({ onRangeChange, defaultValue = 'today', includeAllTime = false }: DateRangeFilterProps) {
  const [selected, setSelected] = useState<DateFilterValue>(defaultValue);

  const handleSelect = (value: DateFilterValue) => {
    setSelected(value);
    onRangeChange?.(value);
  };

  const filteredPresets = includeAllTime ? presets : presets.filter(p => p.value !== 'all');
  const selectedLabel = presets.find(p => p.value === selected)?.label || 'Select range';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="w-4 h-4" />
          {selectedLabel}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {filteredPresets.map((preset) => (
          <DropdownMenuItem
            key={preset.value}
            onClick={() => handleSelect(preset.value)}
            className={selected === preset.value ? 'bg-accent/20' : ''}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
