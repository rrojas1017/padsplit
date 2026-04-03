import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp, ChevronDown, Trash2, Copy, GripVertical, MessageSquare, GitBranch } from 'lucide-react';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';

const QUESTION_TYPES = [
  { value: 'open_ended', label: 'Open Ended' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'scale', label: 'Rating Scale (1-10)' },
  { value: 'yes_no', label: 'Yes / No' },
];

interface Props {
  question: ScriptQuestion;
  index: number;
  totalQuestions: number;
  onChange: (updates: Partial<ScriptQuestion>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function QuestionCard({ question, index, totalQuestions, onChange, onMoveUp, onMoveDown, onDelete, onDuplicate }: Props) {
  const [optionInput, setOptionInput] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  const addOption = () => {
    const val = optionInput.trim();
    if (!val) return;
    onChange({ options: [...(question.options || []), val] });
    setOptionInput('');
  };

  const removeOption = (i: number) => {
    onChange({ options: (question.options || []).filter((_, idx) => idx !== i) });
  };

  return (
    <Card className="border-border/60 group">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-start gap-2">
          {/* Reorder controls */}
          <div className="flex flex-col gap-0.5 mt-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
              <ChevronUp className="w-3 h-3" />
            </Button>
            <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === totalQuestions - 1}>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-3">
            {/* Question text */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs shrink-0">Q{index + 1}</Badge>
              <Textarea
                value={question.question}
                onChange={e => onChange({ question: e.target.value })}
                placeholder="Enter your question..."
                className="flex-1 min-h-[40px]"
                rows={1}
              />
            </div>

            {/* Type + Required + Section */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={question.type} onValueChange={(v: ScriptQuestion['type']) => onChange({ type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Required</Label>
                <div className="h-8 flex items-center">
                  <Switch checked={question.required} onCheckedChange={v => onChange({ required: v })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section</Label>
                <Input
                  value={question.section || ''}
                  onChange={e => onChange({ section: e.target.value || undefined })}
                  placeholder="e.g., Satisfaction"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AI Hint</Label>
                <Input
                  value={question.ai_extraction_hint || ''}
                  onChange={e => onChange({ ai_extraction_hint: e.target.value })}
                  placeholder="e.g., nps_score"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Multiple choice options */}
            {question.type === 'multiple_choice' && (
              <div className="space-y-2">
                <Label className="text-xs">Options</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(question.options || []).map((opt, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {opt}
                      <button onClick={() => removeOption(i)} className="ml-1 hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    placeholder="Add option..."
                    className="h-8 text-xs"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addOption}>Add</Button>
                </div>
              </div>
            )}

            {/* Probes (collapsible) */}
            <div className="flex gap-2">
              <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    Probes {question.probes?.length ? `(${question.probes.length})` : ''}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {(question.probes || []).map((probe, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={probe}
                        onChange={e => {
                          const updated = [...(question.probes || [])];
                          updated[i] = e.target.value;
                          onChange({ probes: updated });
                        }}
                        className="h-8 text-xs"
                        placeholder="Follow-up probe..."
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                        onChange({ probes: (question.probes || []).filter((_, idx) => idx !== i) });
                      }}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                    onChange({ probes: [...(question.probes || []), ''] });
                  }}>+ Add Probe</Button>
                </CollapsibleContent>
              </Collapsible>

              {/* Branching (collapsible) */}
              {question.type === 'yes_no' && (
                <Collapsible open={branchOpen} onOpenChange={setBranchOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <GitBranch className="w-3 h-3" />
                      Branching
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">If Yes → Go to Q#</Label>
                        <Input
                          type="number"
                          min={1}
                          max={totalQuestions}
                          value={question.branch?.yes_goto || ''}
                          onChange={e => onChange({
                            branch: { ...question.branch, yes_goto: e.target.value ? parseInt(e.target.value) : undefined }
                          })}
                          className="h-8 text-xs"
                          placeholder="Q#"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">If No → Go to Q#</Label>
                        <Input
                          type="number"
                          min={1}
                          max={totalQuestions}
                          value={question.branch?.no_goto || ''}
                          onChange={e => onChange({
                            branch: { ...question.branch, no_goto: e.target.value ? parseInt(e.target.value) : undefined }
                          })}
                          className="h-8 text-xs"
                          placeholder="Q#"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate" onClick={onDuplicate}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
