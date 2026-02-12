import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import type { ResearchScript, ScriptQuestion } from '@/hooks/useResearchScripts';

const CAMPAIGN_TYPES = [
  { value: 'satisfaction', label: 'Member Satisfaction (NPS)' },
  { value: 'market_research', label: 'Market Research' },
  { value: 'retention', label: 'Retention Check-in' },
];

const TARGET_AUDIENCES = [
  { value: 'existing_member', label: 'Existing Members' },
  { value: 'former_booking', label: 'Former Bookings' },
  { value: 'rejected', label: 'Rejected Leads' },
];

const QUESTION_TYPES = [
  { value: 'scale', label: 'Scale (1-10)' },
  { value: 'open_ended', label: 'Open Ended' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'yes_no', label: 'Yes / No' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script?: ResearchScript | null;
  onSave: (data: Omit<ResearchScript, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => Promise<void>;
}

const emptyQuestion = (): ScriptQuestion => ({
  order: 1,
  question: '',
  type: 'open_ended',
  required: true,
  options: [],
  ai_extraction_hint: '',
});

export function ResearchScriptDialog({ open, onOpenChange, script, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState('satisfaction');
  const [targetAudience, setTargetAudience] = useState('existing_member');
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<ScriptQuestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [optionInput, setOptionInput] = useState<Record<number, string>>({});

  useEffect(() => {
    if (open) {
      if (script) {
        setName(script.name);
        setDescription(script.description || '');
        setCampaignType(script.campaign_type);
        setTargetAudience(script.target_audience);
        setIsActive(script.is_active);
        setQuestions(script.questions.length > 0 ? script.questions : [emptyQuestion()]);
      } else {
        setName('');
        setDescription('');
        setCampaignType('satisfaction');
        setTargetAudience('existing_member');
        setIsActive(true);
        setQuestions([emptyQuestion()]);
      }
      setOptionInput({});
    }
  }, [open, script]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, { ...emptyQuestion(), order: prev.length + 1 }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i + 1 })));
  };

  const updateQuestion = (idx: number, updates: Partial<ScriptQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setQuestions(updated.map((q, i) => ({ ...q, order: i + 1 })));
  };

  const addOption = (idx: number) => {
    const val = (optionInput[idx] || '').trim();
    if (!val) return;
    const q = questions[idx];
    updateQuestion(idx, { options: [...(q.options || []), val] });
    setOptionInput(prev => ({ ...prev, [idx]: '' }));
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    updateQuestion(qIdx, { options: (q.options || []).filter((_, i) => i !== optIdx) });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const validQuestions = questions.filter(q => q.question.trim());
    if (validQuestions.length === 0) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        campaign_type: campaignType,
        target_audience: targetAudience,
        is_active: isActive,
        questions: validQuestions.map((q, i) => ({
          ...q,
          order: i + 1,
          options: q.type === 'multiple_choice' ? q.options : undefined,
          ai_extraction_hint: q.ai_extraction_hint?.trim() || undefined,
        })),
      });
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{script ? 'Edit Research Script' : 'Create Research Script'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Script Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Member Satisfaction Survey Q1" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose of this script..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Campaign Type *</Label>
              <Select value={campaignType} onValueChange={setCampaignType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Audience *</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_AUDIENCES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Questions ({questions.length})</Label>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="w-4 h-4 mr-1" /> Add Question
              </Button>
            </div>

            {questions.map((q, idx) => (
              <Card key={idx} className="border-border/60">
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5 mt-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">Q{idx + 1}</Badge>
                        <Input
                          value={q.question}
                          onChange={e => updateQuestion(idx, { question: e.target.value })}
                          placeholder="Enter your question..."
                          className="flex-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={q.type} onValueChange={(v: ScriptQuestion['type']) => updateQuestion(idx, { type: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Required</Label>
                          <div className="h-8 flex items-center">
                            <Switch checked={q.required} onCheckedChange={v => updateQuestion(idx, { required: v })} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">AI Hint</Label>
                          <Input
                            value={q.ai_extraction_hint || ''}
                            onChange={e => updateQuestion(idx, { ai_extraction_hint: e.target.value })}
                            placeholder="e.g., nps_score"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      {q.type === 'multiple_choice' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Options</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {(q.options || []).map((opt, oIdx) => (
                              <Badge key={oIdx} variant="secondary" className="gap-1 pr-1">
                                {opt}
                                <button onClick={() => removeOption(idx, oIdx)} className="ml-1 hover:text-destructive">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={optionInput[idx] || ''}
                              onChange={e => setOptionInput(prev => ({ ...prev, [idx]: e.target.value }))}
                              placeholder="Add option..."
                              className="h-8 text-xs"
                              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption(idx))}
                            />
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addOption(idx)}>Add</Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeQuestion(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim() || questions.filter(q => q.question.trim()).length === 0}>
            {isSaving ? 'Saving...' : script ? 'Update Script' : 'Create Script'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
