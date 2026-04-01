import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Users } from 'lucide-react';
import type { ResearchCampaign, CampaignInput, ResearcherProfile } from '@/hooks/useResearchCampaigns';
import type { ResearchScript } from '@/hooks/useResearchScripts';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: ResearchCampaign | null;
  scripts: ResearchScript[];
  researchers: ResearcherProfile[];
  onSave: (data: CampaignInput) => Promise<void>;
}

export function ResearchCampaignDialog({ open, onOpenChange, campaign, scripts, researchers, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [status, setStatus] = useState<ResearchCampaign['status']>('draft');
  const [targetCount, setTargetCount] = useState(50);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedResearchers, setSelectedResearchers] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (campaign) {
        setName(campaign.name);
        setDescription('');
        setScriptId(campaign.script_id);
        setStatus(campaign.status);
        setTargetCount(campaign.target_count);
        setStartDate(campaign.start_date || '');
        setEndDate(campaign.end_date || '');
        setSelectedResearchers(campaign.assigned_researchers || []);
      } else {
        setName('');
        setDescription('');
        setScriptId('');
        setStatus('draft');
        setTargetCount(50);
        setStartDate('');
        setEndDate('');
        setSelectedResearchers([]);
      }
    }
  }, [open, campaign]);

  const toggleResearcher = (id: string) => {
    setSelectedResearchers(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const dateError = startDate && endDate && new Date(endDate) <= new Date(startDate);
  const isValid = name.trim() && scriptId && selectedResearchers.length > 0 && targetCount > 0 && !dateError;

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        script_id: scriptId,
        status,
        target_count: targetCount,
        start_date: startDate || null,
        end_date: endDate || null,
        assigned_researchers: selectedResearchers,
      });
      onOpenChange(false);
    } catch {
      // handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const getResearcherName = (id: string) => {
    const r = researchers.find(r => r.id === id);
    return r?.name || r?.email || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Campaign Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., January NPS Check" />
            {name.trim() && (
              <p className="text-[11px] text-muted-foreground font-mono">
                API campaign key: <span className="text-foreground">{name.trim().replace(/\s+/g, '-')}</span>
              </p>
            )}
          </div>

          {/* Script selector */}
          <div className="space-y-2">
            <Label>Research Script *</Label>
            <Select value={scriptId} onValueChange={setScriptId}>
              <SelectTrigger><SelectValue placeholder="Select a script..." /></SelectTrigger>
              <SelectContent>
                {scripts.filter(s => s.is_active).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status & Target */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as ResearchCampaign['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Calls *</Label>
              <Input
                type="number"
                min={1}
                value={targetCount}
                onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          {dateError && (
            <p className="text-sm text-destructive">End date must be after start date</p>
          )}

          {/* Researcher assignment */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Assign Researchers * ({selectedResearchers.length} selected)
            </Label>

            {/* Selected badges */}
            {selectedResearchers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedResearchers.map(id => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {getResearcherName(id)}
                    <button onClick={() => toggleResearcher(id)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Researcher list */}
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {researchers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">No researchers found. Add users with the "researcher" role first.</p>
              ) : (
                researchers.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleResearcher(r.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center justify-between border-b last:border-b-0 transition-colors ${
                      selectedResearchers.includes(r.id) ? 'bg-accent/30 font-medium' : ''
                    }`}
                  >
                    <span>{r.name || 'Unnamed'} <span className="text-muted-foreground">({r.email})</span></span>
                    {selectedResearchers.includes(r.id) && (
                      <Badge variant="outline" className="text-xs">Selected</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
            {selectedResearchers.length === 0 && (
              <p className="text-sm text-destructive">At least one researcher is required</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !isValid}>
            {isSaving ? 'Saving...' : campaign ? 'Update Campaign' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
