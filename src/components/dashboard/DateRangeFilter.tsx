import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

const presets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This month', value: 'month' },
];

interface DateRangeFilterProps {
  onRangeChange?: (range: string) => void;
}

export function DateRangeFilter({ onRangeChange }: DateRangeFilterProps) {
  const [selected, setSelected] = useState('7d');

  const handleSelect = (value: string) => {
    setSelected(value);
    onRangeChange?.(value);
  };

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
        {presets.map((preset) => (
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
