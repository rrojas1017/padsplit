import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutoTranscriptionRule {
  id: string;
  rule_type: 'global' | 'call_type' | 'agent' | 'site';
  call_type_id: string | null;
  agent_id: string | null;
  site_id: string | null;
  auto_transcribe: boolean;
  auto_coaching: boolean;
  priority: number;
  is_active: boolean;
}

interface AutoTranscriptionRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutoTranscriptionRule | null;
  onSaved: () => void;
  existingRuleTypes: string[];
}

interface CallType {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
}

export function AutoTranscriptionRuleDialog({ 
  open, 
  onOpenChange, 
  rule, 
  onSaved,
  existingRuleTypes 
}: AutoTranscriptionRuleDialogProps) {
  const [ruleType, setRuleType] = useState<'global' | 'call_type' | 'agent' | 'site'>('global');
  const [callTypeId, setCallTypeId] = useState<string>('');
  const [agentId, setAgentId] = useState<string>('');
  const [siteId, setSiteId] = useState<string>('');
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [autoCoaching, setAutoCoaching] = useState(true);
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    if (open) {
      fetchOptions();
      if (rule) {
        setRuleType(rule.rule_type);
        setCallTypeId(rule.call_type_id || '');
        setAgentId(rule.agent_id || '');
        setSiteId(rule.site_id || '');
        setAutoTranscribe(rule.auto_transcribe);
        setAutoCoaching(rule.auto_coaching);
        setPriority(rule.priority);
        setIsActive(rule.is_active);
      } else {
        setRuleType('global');
        setCallTypeId('');
        setAgentId('');
        setSiteId('');
        setAutoTranscribe(true);
        setAutoCoaching(true);
        setPriority(0);
        setIsActive(true);
      }
    }
  }, [open, rule]);

  const fetchOptions = async () => {
    const [callTypesRes, agentsRes, sitesRes] = await Promise.all([
      supabase.from('call_types').select('id, name').eq('is_active', true).order('name'),
      supabase.from('agents').select('id, name').eq('active', true).order('name'),
      supabase.from('sites').select('id, name').order('name')
    ]);

    if (callTypesRes.data) setCallTypes(callTypesRes.data);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (sitesRes.data) setSites(sitesRes.data);
  };

  const handleSave = async () => {
    // Validation
    if (ruleType === 'call_type' && !callTypeId) {
      toast.error('Please select a call type');
      return;
    }
    if (ruleType === 'agent' && !agentId) {
      toast.error('Please select an agent');
      return;
    }
    if (ruleType === 'site' && !siteId) {
      toast.error('Please select a site');
      return;
    }

    // Check for duplicate global rule
    if (ruleType === 'global' && !rule && existingRuleTypes.includes('global')) {
      toast.error('A global rule already exists. Edit the existing one instead.');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        rule_type: ruleType,
        call_type_id: ruleType === 'call_type' ? callTypeId : null,
        agent_id: ruleType === 'agent' ? agentId : null,
        site_id: ruleType === 'site' ? siteId : null,
        auto_transcribe: autoTranscribe,
        auto_coaching: autoCoaching,
        priority,
        is_active: isActive
      };

      if (rule) {
        const { error } = await supabase
          .from('transcription_auto_rules')
          .update(data)
          .eq('id', rule.id);
        if (error) throw error;
        toast.success('Rule updated');
      } else {
        const { error } = await supabase
          .from('transcription_auto_rules')
          .insert(data);
        if (error) throw error;
        toast.success('Rule created');
      }

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  const getPriorityHint = () => {
    switch (ruleType) {
      case 'agent': return 'Highest priority (checked first)';
      case 'call_type': return 'Medium priority';
      case 'site': return 'Lower priority';
      case 'global': return 'Lowest priority (fallback)';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Rule' : 'Add Auto-Transcription Rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Rule Type</Label>
            <Select 
              value={ruleType} 
              onValueChange={(v) => setRuleType(v as any)}
              disabled={!!rule}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (All Calls)</SelectItem>
                <SelectItem value="call_type">By Call Type</SelectItem>
                <SelectItem value="agent">By Agent</SelectItem>
                <SelectItem value="site">By Site</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{getPriorityHint()}</p>
          </div>

          {ruleType === 'call_type' && (
            <div className="space-y-2">
              <Label>Call Type</Label>
              <Select value={callTypeId} onValueChange={setCallTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select call type..." />
                </SelectTrigger>
                <SelectContent>
                  {callTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {ruleType === 'agent' && (
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {ruleType === 'site' && (
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Transcribe</Label>
              <p className="text-xs text-muted-foreground">Automatically transcribe calls</p>
            </div>
            <Switch checked={autoTranscribe} onCheckedChange={setAutoTranscribe} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Coaching</Label>
              <p className="text-xs text-muted-foreground">Generate coaching feedback</p>
            </div>
            <Switch checked={autoCoaching} onCheckedChange={setAutoCoaching} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Rule is currently enabled</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
