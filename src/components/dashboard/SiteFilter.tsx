import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';

interface SiteFilterProps {
  onSiteChange?: (siteId: string | null) => void;
}

export function SiteFilter({ onSiteChange }: SiteFilterProps) {
  const { sites } = useAgents();
  const { user } = useAuth();

  // Supervisors can only ever see their own site (enforced by the database).
  const isSupervisor = user?.role === 'supervisor' && !!user?.siteId;
  const supervisorSite = isSupervisor ? user!.siteId! : null;

  const [selected, setSelected] = useState<string | null>(
    isSupervisor ? supervisorSite : null,
  );

  // Lock the supervisor to their site on mount so the Dashboard filters to it.
  useEffect(() => {
    if (isSupervisor && supervisorSite) {
      onSiteChange?.(supervisorSite);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (siteId: string | null) => {
    if (isSupervisor) return; // locked
    setSelected(siteId);
    onSiteChange?.(siteId);
  };

  const supervisorSiteName = supervisorSite
    ? sites.find((s) => s.id === supervisorSite)?.name ?? 'My Site'
    : 'My Site';

  const selectedLabel = isSupervisor
    ? supervisorSiteName
    : selected
      ? sites.find((s) => s.id === selected)?.name ?? 'All Sites'
      : 'All Sites';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isSupervisor}>
          <Building2 className="w-4 h-4" />
          {selectedLabel}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isSupervisor ? (
          <DropdownMenuItem
            onClick={() => handleSelect(supervisorSite)}
            className="bg-accent/20"
          >
            {supervisorSiteName}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => handleSelect(null)}
              className={!selected ? 'bg-accent/20' : ''}
            >
              All Sites
            </DropdownMenuItem>
            {sites.map((site) => (
              <DropdownMenuItem
                key={site.id}
                onClick={() => handleSelect(site.id)}
                className={selected === site.id ? 'bg-accent/20' : ''}
              >
                {site.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
