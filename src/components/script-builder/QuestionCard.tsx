import { useState, useEffect, useRef } from 'react';
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
  { value: 'scale', label: 'Rating Scale' },
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

// Parse goto input: '' → undefined, '0' → 0 (end survey), otherwise positive int or undefined
const parseGoto = (raw: string): number | undefined => {
  if (raw === '') return undefined;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
};

const BRANCHABLE_TYPES = new Set(['yes_no', 'scale', 'multiple_choice']);

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
    const opts = question.options || [];
    const removed = opts[i];
    const newOpts = opts.filter((_, idx) => idx !== i);
    const updates: Partial<ScriptQuestion> = { options: newOpts };
    // Clean stale option_gotos entry
    if (removed && question.branch?.option_gotos && removed in question.branch.option_gotos) {
      const { [removed]: _drop, ...rest } = question.branch.option_gotos;
      updates.branch = { ...question.branch, option_gotos: rest };
    }
    onChange(updates);
  };

  // Clean stale option_gotos keys whenever options drift (e.g. on rename)
  const lastOptionsRef = useRef<string[] | undefined>(question.options);
  useEffect(() => {
    lastOptionsRef.current = question.options;
    const gotos = question.branch?.option_gotos;
    if (!gotos) return;
    const validKeys = new Set(question.options || []);
    const staleKeys = Object.keys(gotos).filter(k => !validKeys.has(k));
    if (staleKeys.length === 0) return;
    const cleaned = { ...gotos };
    staleKeys.forEach(k => delete cleaned[k]);
    onChange({ branch: { ...question.branch, option_gotos: cleaned } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(question.options)]);

  const updateBranch = (patch: Partial<NonNullable<ScriptQuestion['branch']>>) => {
    onChange({ branch: { ...question.branch, ...patch } });
  };

  const handleTypeChange = (v: ScriptQuestion['type']) => {
    const updates: Partial<ScriptQuestion> = { type: v };
    if (v === 'scale') {
      if (question.scale_min === undefined) updates.scale_min = 1;
      if (question.scale_max === undefined) updates.scale_max = 5;
    }
    onChange(updates);
  };

  const showBranching = BRANCHABLE_TYPES.has(question.type);
  const scaleMin = question.scale_min ?? 1;
  const scaleMax = question.scale_max ?? 5;
  const thresholdMax = Math.max(scaleMin, scaleMax - 1);

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
                <Select value={question.type} onValueChange={handleTypeChange}>
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

            {/* Scale min/max controls */}
            {question.type === 'scale' && (
              <div className="space-y-1.5 max-w-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Scale Min</Label>
                    <Input
                      type="number"
                      value={question.scale_min ?? 1}
                      onChange={e => onChange({ scale_min: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                      className="h-8 text-xs"
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Scale Max</Label>
                    <Input
                      type="number"
                      value={question.scale_max ?? 5}
                      onChange={e => onChange({ scale_max: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                      className="h-8 text-xs"
                      placeholder="5"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Defaults to 1–5. Use 1–10 for NPS-style.</p>
              </div>
            )}

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

            {/* Probes + Branching */}
            <div className="flex flex-wrap gap-2">
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

              {showBranching && (
                <Collapsible open={branchOpen} onOpenChange={setBranchOpen} className="w-full">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <GitBranch className="w-3 h-3" />
                      Branching
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-3">
                    {/* Yes / No */}
                    {question.type === 'yes_no' && (
                      <div className="grid grid-cols-2 gap-3 max-w-md">
                        <div className="space-y-1">
                          <Label className="text-xs">If Yes → Go to Q#</Label>
                          <Input
                            type="number"
                            min={0}
                            max={totalQuestions}
                            value={question.branch?.yes_goto ?? ''}
                            onChange={e => updateBranch({ yes_goto: parseGoto(e.target.value) })}
                            className="h-8 text-xs"
                            placeholder="Q# or 0 to end"
                          />
                          <p className="text-[11px] text-muted-foreground">Enter 0 to end survey.</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">If No → Go to Q#</Label>
                          <Input
                            type="number"
                            min={0}
                            max={totalQuestions}
                            value={question.branch?.no_goto ?? ''}
                            onChange={e => updateBranch({ no_goto: parseGoto(e.target.value) })}
                            className="h-8 text-xs"
                            placeholder="Q# or 0 to end"
                          />
                          <p className="text-[11px] text-muted-foreground">Enter 0 to end survey.</p>
                        </div>
                      </div>
                    )}

                    {/* Scale */}
                    {question.type === 'scale' && (
                      <div className="space-y-2 max-w-md">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Threshold</Label>
                            <Input
                              type="number"
                              min={scaleMin}
                              max={thresholdMax}
                              value={question.branch?.scale_threshold ?? ''}
                              onChange={e => {
                                const raw = e.target.value;
                                if (raw === '') return updateBranch({ scale_threshold: undefined });
                                const n = parseInt(raw, 10);
                                if (Number.isNaN(n)) return;
                                const clamped = Math.min(thresholdMax, Math.max(scaleMin, n));
                                updateBranch({ scale_threshold: clamped });
                              }}
                              className="h-8 text-xs"
                              placeholder={String(scaleMin)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">If ≤ threshold → Q#</Label>
                            <Input
                              type="number"
                              min={0}
                              max={totalQuestions}
                              value={question.branch?.scale_lte_goto ?? ''}
                              onChange={e => updateBranch({ scale_lte_goto: parseGoto(e.target.value) })}
                              className="h-8 text-xs"
                              placeholder="Q# or 0 to end"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">If &gt; threshold → Q#</Label>
                            <Input
                              type="number"
                              min={0}
                              max={totalQuestions}
                              value={question.branch?.scale_gt_goto ?? ''}
                              onChange={e => updateBranch({ scale_gt_goto: parseGoto(e.target.value) })}
                              className="h-8 text-xs"
                              placeholder="Q# or 0 to end"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Enter 0 to end survey. Threshold range: {scaleMin}–{thresholdMax}.
                        </p>
                        <p className="text-[11px] text-muted-foreground italic">
                          Scale and multiple-choice branching are saved here but will not affect live survey navigation until runtime support is enabled.
                        </p>
                      </div>
                    )}

                    {/* Multiple choice */}
                    {question.type === 'multiple_choice' && (
                      <div className="space-y-2 max-w-md">
                        {(question.options || []).length === 0 && (
                          <p className="text-[11px] text-muted-foreground">Add options above to configure per-option branching.</p>
                        )}
                        {(question.options || []).map((opt) => (
                          <div key={opt} className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <Label className="text-xs truncate" title={opt}>If "{opt}" →</Label>
                            <Input
                              type="number"
                              min={0}
                              max={totalQuestions}
                              value={question.branch?.option_gotos?.[opt] ?? ''}
                              onChange={e => {
                                const next = parseGoto(e.target.value);
                                const current = question.branch?.option_gotos || {};
                                if (next === undefined) {
                                  const { [opt]: _drop, ...rest } = current;
                                  updateBranch({ option_gotos: rest });
                                } else {
                                  updateBranch({ option_gotos: { ...current, [opt]: next } });
                                }
                              }}
                              className="h-8 text-xs w-32"
                              placeholder="Q# or 0 to end"
                            />
                          </div>
                        ))}
                        <p className="text-[11px] text-muted-foreground">Enter 0 to end survey.</p>
                        <p className="text-[11px] text-muted-foreground italic">
                          Scale and multiple-choice branching are saved here but will not affect live survey navigation until runtime support is enabled.
                        </p>
                      </div>
                    )}
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
