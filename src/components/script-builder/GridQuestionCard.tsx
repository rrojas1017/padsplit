import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp, ChevronDown, Trash2, Copy, Plus, Grid3x3 } from 'lucide-react';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';
import {
  setGridTitle, setGridColumns, setGridField, renameGridRow, setRowHint,
  addGridRow, removeGridRow, moveGridRow,
} from '@/utils/scriptMatrix';

interface Props {
  questions: ScriptQuestion[];
  start: number;
  end: number;
  onChange: (questions: ScriptQuestion[]) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  newId: () => string;
}

export function GridQuestionCard({ questions, start, end, onChange, onMoveUp, onMoveDown, onDelete, onDuplicate, canMoveUp, canMoveDown, newId }: Props) {
  const [colInput, setColInput] = useState('');
  const [hintsOpen, setHintsOpen] = useState(false);
  const first = questions[start];
  const title = first.matrix?.title ?? '';
  const columns = first.options || [];
  const rows = questions.slice(start, end + 1);

  const addColumn = () => {
    const v = colInput.trim();
    if (!v || columns.some(c => c.toLowerCase() === v.toLowerCase())) return;
    onChange(setGridColumns(questions, start, end, [...columns, v]));
    setColInput('');
  };

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5 mt-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={!canMoveUp}>
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={!canMoveDown}>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs shrink-0 gap-1">
                <Grid3x3 className="w-3 h-3" /> Q{start + 1}–Q{end + 1}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">Grid question</span>
              <Input
                value={title}
                onChange={e => onChange(setGridTitle(questions, start, end, e.target.value))}
                placeholder="Grid question title..."
                className="flex-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1">
                <Label className="text-xs">Section</Label>
                <Input
                  value={first.section || ''}
                  onChange={e => onChange(setGridField(questions, start, end, { section: e.target.value || undefined }))}
                  placeholder="e.g., Satisfaction"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Required</Label>
                <div className="h-8 flex items-center">
                  <Switch checked={first.required} onCheckedChange={v => onChange(setGridField(questions, start, end, { required: v }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Columns (answer choices, min 2)</Label>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {c}
                    <button
                      onClick={() => columns.length > 2 && onChange(setGridColumns(questions, start, end, columns.filter((_, j) => j !== i)))}
                      disabled={columns.length <= 2}
                      className="ml-1 hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={colInput}
                  onChange={e => setColInput(e.target.value)}
                  placeholder="Add column..."
                  className="h-8 text-xs"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColumn())}
                />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addColumn}>Add</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Rows</Label>
              {rows.map((r, k) => {
                const idx = start + k;
                return (
                  <div key={String(r.id ?? idx)} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">Q{idx + 1}</Badge>
                    <Input
                      value={r.matrix?.row ?? ''}
                      onChange={e => onChange(renameGridRow(questions, idx, e.target.value))}
                      placeholder="Row label..."
                      className="h-8 text-xs flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(moveGridRow(questions, start, end, idx, 'up'))} disabled={idx === start}>
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(moveGridRow(questions, start, end, idx, 'down'))} disabled={idx === end}>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => (rows.length <= 1 ? onDelete() : onChange(removeGridRow(questions, idx)))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange(addGridRow(questions, start, end, newId))}>
                <Plus className="w-3 h-3 mr-1" /> Add row
              </Button>
            </div>

            <Collapsible open={hintsOpen} onOpenChange={setHintsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">AI hints</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {rows.map((r, k) => (
                  <div key={String(r.id ?? k)} className="grid grid-cols-[1fr_1fr] gap-2 items-center">
                    <span className="text-xs text-muted-foreground truncate">{r.matrix?.row || `Row ${k + 1}`}</span>
                    <Input
                      value={r.ai_extraction_hint || ''}
                      onChange={e => onChange(setRowHint(questions, start + k, e.target.value))}
                      placeholder="e.g., fee_clarity"
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {onDuplicate && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate}>
                <Copy className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
