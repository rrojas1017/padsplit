import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Scale, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CallRuleDialog } from './CallRuleDialog';

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

export function CallRulesList() {
  const [rules, setRules] = useState<CallRule[]>([]);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [selectedCallTypeId, setSelectedCallTypeId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CallRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rulesRes, typesRes] = await Promise.all([
        supabase.from('call_type_rules').select('*').order('rule_type', { ascending: true }).order('weight', { ascending: false }),
        supabase.from('call_types').select('id, name').eq('is_active', true).order('name')
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (typesRes.error) throw typesRes.error;

      setRules(rulesRes.data || []);
      setCallTypes(typesRes.data || []);
    } catch (error: any) {
      toast.error('Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (rule: CallRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('call_type_rules').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Rule deleted');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete rule');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredRules = selectedCallTypeId === 'all' 
    ? rules 
    : rules.filter(r => r.call_type_id === selectedCallTypeId);

  const getCallTypeName = (id: string | null) => {
    if (!id) return 'Unknown';
    return callTypes.find(ct => ct.id === id)?.name || 'Unknown';
  };

  const getRuleTypeConfig = (type: string) => {
    switch (type) {
      case 'required':
        return { 
          label: 'Required', 
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
          icon: CheckCircle
        };
      case 'recommended':
        return { 
          label: 'Recommended', 
          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          icon: AlertCircle
        };
      case 'prohibited':
        return { 
          label: 'Prohibited', 
          className: 'bg-red-500/10 text-red-600 border-red-500/20',
          icon: XCircle
        };
      default:
        return { 
          label: type, 
          className: 'bg-muted text-muted-foreground',
          icon: AlertCircle
        };
    }
  };

  // Group rules by type
  const groupedRules = {
    required: filteredRules.filter(r => r.rule_type === 'required'),
    recommended: filteredRules.filter(r => r.rule_type === 'recommended'),
    prohibited: filteredRules.filter(r => r.rule_type === 'prohibited'),
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by Call Type:</span>
          <Select value={selectedCallTypeId} onValueChange={setSelectedCallTypeId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Call Types</SelectItem>
              {callTypes.map((ct) => (
                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {filteredRules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No rules configured yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Rules define what agents should or should not do during calls.</p>
            <Button onClick={handleAdd} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-1" />
              Add First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Required Rules */}
          {groupedRules.required.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h4 className="font-medium text-green-600">Required Actions</h4>
                <Badge variant="secondary" className="text-xs">{groupedRules.required.length}</Badge>
              </div>
              <div className="grid gap-3">
                {groupedRules.required.map((rule) => (
                  <RuleCard 
                    key={rule.id} 
                    rule={rule} 
                    callTypeName={getCallTypeName(rule.call_type_id)}
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => setDeleteId(rule.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recommended Rules */}
          {groupedRules.recommended.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <h4 className="font-medium text-amber-600">Recommended Actions</h4>
                <Badge variant="secondary" className="text-xs">{groupedRules.recommended.length}</Badge>
              </div>
              <div className="grid gap-3">
                {groupedRules.recommended.map((rule) => (
                  <RuleCard 
                    key={rule.id} 
                    rule={rule} 
                    callTypeName={getCallTypeName(rule.call_type_id)}
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => setDeleteId(rule.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Prohibited Rules */}
          {groupedRules.prohibited.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4 text-red-600" />
                <h4 className="font-medium text-red-600">Prohibited Actions</h4>
                <Badge variant="secondary" className="text-xs">{groupedRules.prohibited.length}</Badge>
              </div>
              <div className="grid gap-3">
                {groupedRules.prohibited.map((rule) => (
                  <RuleCard 
                    key={rule.id} 
                    rule={rule} 
                    callTypeName={getCallTypeName(rule.call_type_id)}
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => setDeleteId(rule.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CallRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        callTypes={callTypes}
        onSaved={fetchData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this rule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RuleCardProps {
  rule: CallRule;
  callTypeName: string;
  onEdit: () => void;
  onDelete: () => void;
}

function RuleCard({ rule, callTypeName, onEdit, onDelete }: RuleCardProps) {
  const typeConfig = getRuleTypeConfig(rule.rule_type);
  const TypeIcon = typeConfig.icon;

  return (
    <Card className={`${!rule.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{rule.rule_name}</span>
              <Badge variant="outline" className={typeConfig.className}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {typeConfig.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Weight: {rule.weight || 5}
              </Badge>
              {!rule.is_active && (
                <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Call Type: {callTypeName}
            </div>
            {rule.rule_description && (
              <p className="text-sm text-muted-foreground mt-2">{rule.rule_description}</p>
            )}
            {rule.ai_instruction && (
              <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                AI: {rule.ai_instruction}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getRuleTypeConfig(type: string) {
  switch (type) {
    case 'required':
      return { 
        label: 'Required', 
        className: 'bg-green-500/10 text-green-600 border-green-500/20',
        icon: CheckCircle
      };
    case 'recommended':
      return { 
        label: 'Recommended', 
        className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: AlertCircle
      };
    case 'prohibited':
      return { 
        label: 'Prohibited', 
        className: 'bg-red-500/10 text-red-600 border-red-500/20',
        icon: XCircle
      };
    default:
      return { 
        label: type, 
        className: 'bg-muted text-muted-foreground',
        icon: AlertCircle
      };
  }
}
