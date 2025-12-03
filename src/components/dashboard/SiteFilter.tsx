import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { mockSites } from '@/data/mockData';

interface SiteFilterProps {
  onSiteChange?: (siteId: string | null) => void;
}

export function SiteFilter({ onSiteChange }: SiteFilterProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (siteId: string | null) => {
    setSelected(siteId);
    onSiteChange?.(siteId);
  };

  const selectedLabel = selected 
    ? mockSites.find(s => s.id === selected)?.name 
    : 'All Sites';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="w-4 h-4" />
          {selectedLabel}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleSelect(null)}
          className={!selected ? 'bg-accent/20' : ''}
        >
          All Sites
        </DropdownMenuItem>
        {mockSites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onClick={() => handleSelect(site.id)}
            className={selected === site.id ? 'bg-accent/20' : ''}
          >
            {site.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
