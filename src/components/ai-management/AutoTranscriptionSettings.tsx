import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Zap, Users, Phone, Building2, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AutoTranscriptionRuleDialog } from './AutoTranscriptionRuleDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  call_types?: { name: string } | null;
  agents?: { name: string } | null;
  sites?: { name: string } | null;
}

export function AutoTranscriptionSettings() {
  const [rules, setRules] = useState<AutoTranscriptionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoTranscriptionRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AutoTranscriptionRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transcription_auto_rules')
        .select(`
          *,
          call_types(name),
          agents(name),
          sites(name)
        `)
        .order('priority', { ascending: false })
        .order('rule_type');

      if (error) throw error;
      
      // Transform and type the data properly
      const typedRules: AutoTranscriptionRule[] = (data || []).map((rule: any) => ({
        id: rule.id,
        rule_type: rule.rule_type as 'global' | 'call_type' | 'agent' | 'site',
        call_type_id: rule.call_type_id,
        agent_id: rule.agent_id,
        site_id: rule.site_id,
        auto_transcribe: rule.auto_transcribe,
        auto_coaching: rule.auto_coaching,
        priority: rule.priority,
        is_active: rule.is_active,
        call_types: rule.call_types,
        agents: rule.agents,
        sites: rule.sites,
      }));
      
      setRules(typedRules);
    } catch (error: any) {
      toast.error('Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (rule: AutoTranscriptionRule) => {
    try {
      const { error } = await supabase
        .from('transcription_auto_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      toast.success(`Rule ${rule.is_active ? 'disabled' : 'enabled'}`);
      fetchRules();
    } catch (error: any) {
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    
    try {
      const { error } = await supabase
        .from('transcription_auto_rules')
        .delete()
        .eq('id', ruleToDelete.id);

      if (error) throw error;
      toast.success('Rule deleted');
      fetchRules();
    } catch (error: any) {
      toast.error('Failed to delete rule');
    } finally {
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'global': return <Globe className="h-4 w-4" />;
      case 'call_type': return <Phone className="h-4 w-4" />;
      case 'agent': return <Users className="h-4 w-4" />;
      case 'site': return <Building2 className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getRuleName = (rule: AutoTranscriptionRule) => {
    switch (rule.rule_type) {
      case 'global': return 'All Calls (Global)';
      case 'call_type': return rule.call_types?.name || 'Unknown Call Type';
      case 'agent': return rule.agents?.name || 'Unknown Agent';
      case 'site': return rule.sites?.name || 'Unknown Site';
      default: return 'Unknown';
    }
  };

  const getRuleTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      global: 'default',
      call_type: 'secondary',
      agent: 'outline',
      site: 'outline'
    };
    return (
      <Badge variant={variants[type] || 'default'} className="text-xs">
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  const existingRuleTypes = rules.map(r => r.rule_type);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Auto-Transcription Rules
          </CardTitle>
          <CardDescription>
            Configure automatic transcription and coaching for calls
          </CardDescription>
        </div>
        <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Rule
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Zap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No rules configured</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add a rule to automatically transcribe calls
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setEditingRule(null); setDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  rule.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${rule.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    {getRuleIcon(rule.rule_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getRuleName(rule)}</span>
                      {getRuleTypeBadge(rule.rule_type)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className={rule.auto_transcribe ? 'text-green-600' : 'text-muted-foreground'}>
                        {rule.auto_transcribe ? '✓ Transcribe' : '✗ Transcribe'}
                      </span>
                      <span className={rule.auto_coaching ? 'text-green-600' : 'text-muted-foreground'}>
                        {rule.auto_coaching ? '✓ Coaching' : '✗ Coaching'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => handleToggleActive(rule)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditingRule(rule); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setRuleToDelete(rule); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Priority Order:</strong> Agent rules → Call Type rules → Site rules → Global rule. 
            The first matching rule is applied.
          </p>
        </div>
      </CardContent>

      <AutoTranscriptionRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        onSaved={fetchRules}
        existingRuleTypes={existingRuleTypes}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the auto-transcription rule for "{ruleToDelete ? getRuleName(ruleToDelete) : ''}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
