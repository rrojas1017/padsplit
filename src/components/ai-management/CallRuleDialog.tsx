import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CallRule {
  id: string;
  call_type_id: string | null;
  rule_name: string;
  rule_description: string | null;
  rule_type: string;
  ai_instruction: string | null;
  weight: number | null;
  is_active: boolean | null;
}

interface CallType {
  id: string;
  name: string;
}

interface CallRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: CallRule | null;
  callTypes: CallType[];
  onSaved: () => void;
}

export function CallRuleDialog({ open, onOpenChange, rule, callTypes, onSaved }: CallRuleDialogProps) {
  const [callTypeId, setCallTypeId] = useState<string>('');
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleType, setRuleType] = useState<string>('recommended');
  const [aiInstruction, setAiInstruction] = useState('');
  const [weight, setWeight] = useState(5);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setCallTypeId(rule.call_type_id || '');
      setRuleName(rule.rule_name);
      setRuleDescription(rule.rule_description || '');
      setRuleType(rule.rule_type);
      setAiInstruction(rule.ai_instruction || '');
      setWeight(rule.weight || 5);
      setIsActive(rule.is_active ?? true);
    } else {
      setCallTypeId('');
      setRuleName('');
      setRuleDescription('');
      setRuleType('recommended');
      setAiInstruction('');
      setWeight(5);
      setIsActive(true);
    }
  }, [rule, open]);

  const handleSave = async () => {
    if (!callTypeId) {
      toast.error('Please select a call type');
      return;
    }
    if (!ruleName.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    if (!ruleType) {
      toast.error('Please select a rule type');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        call_type_id: callTypeId,
        rule_name: ruleName.trim(),
        rule_description: ruleDescription.trim() || null,
        rule_type: ruleType,
        ai_instruction: aiInstruction.trim() || null,
        weight,
        is_active: isActive,
      };

      if (rule) {
        const { error } = await supabase
          .from('call_type_rules')
          .update(data)
          .eq('id', rule.id);
        if (error) throw error;
        toast.success('Rule updated successfully');
      } else {
        const { error } = await supabase
          .from('call_type_rules')
          .insert(data);
        if (error) throw error;
        toast.success('Rule created successfully');
      }

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'required': return 'text-green-600';
      case 'recommended': return 'text-amber-600';
      case 'prohibited': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Rule' : 'Add New Rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="callType">Call Type <span className="text-destructive">*</span></Label>
            <Select value={callTypeId} onValueChange={setCallTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select call type" />
              </SelectTrigger>
              <SelectContent>
                {callTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleName">Rule Name <span className="text-destructive">*</span></Label>
            <Input
              id="ruleName"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Verify member identity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleType">Rule Type <span className="text-destructive">*</span></Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">
                  <span className="text-green-600 font-medium">Required</span>
                  <span className="text-muted-foreground text-xs ml-2">- Must be performed</span>
                </SelectItem>
                <SelectItem value="recommended">
                  <span className="text-amber-600 font-medium">Recommended</span>
                  <span className="text-muted-foreground text-xs ml-2">- Should be performed</span>
                </SelectItem>
                <SelectItem value="prohibited">
                  <span className="text-red-600 font-medium">Prohibited</span>
                  <span className="text-muted-foreground text-xs ml-2">- Must NOT be performed</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleDescription">Description</Label>
            <Input
              id="ruleDescription"
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              placeholder="Brief description of the rule"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiInstruction">AI Evaluation Instruction</Label>
            <Textarea
              id="aiInstruction"
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="How should the AI evaluate this rule? e.g., 'Check if agent confirmed member's name and property interest within first 2 minutes'"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Weight (Importance)</Label>
              <span className="text-sm font-medium text-muted-foreground">{weight}/10</span>
            </div>
            <Slider
              value={[weight]}
              onValueChange={(v) => setWeight(v[0])}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Higher weight = more important in scoring</p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
