import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { newCallOutcomeId, type CallOutcome } from '@/hooks/useResearchScripts';

const MAX_OUTCOMES = 20;

const SUGGESTED: Array<[string, string]> = [
  ['Completed survey', 'Encuesta completada'],
  ['Transferred to Customer Service', 'Transferido a Servicio al Cliente'],
  ['Transferred to Sales', 'Transferido a Ventas'],
  ['Caller hung up', 'El cliente colgó'],
  ['Caller asked to stop', 'El cliente pidió terminar'],
  ['Callback requested', 'Pidió que lo llamen luego'],
  ['Wrong number', 'Número equivocado'],
  ['Other', 'Otro'],
];

export const DUPLICATE_OUTCOME_MESSAGE =
  'Two call close outcomes have the same English label — rename one before saving.';

/** Indexes of rows whose trimmed English label duplicates another (case-insensitive). */
export function duplicateOutcomeLabels(list: CallOutcome[]): Set<number> {
  const seen = new Map<string, number[]>();
  list.forEach((o, i) => {
    const k = (o.label ?? '').trim().toLowerCase();
    if (!k) return;
    seen.set(k, [...(seen.get(k) ?? []), i]);
  });
  const out = new Set<number>();
  for (const idxs of seen.values()) if (idxs.length > 1) idxs.forEach(i => out.add(i));
  return out;
}

interface Props {
  value: CallOutcome[];
  onChange: (next: CallOutcome[]) => void;
}

export function CallOutcomesEditor({ value, onChange }: Props) {
  const dups = duplicateOutcomeLabels(value);

  const update = (idx: number, patch: Partial<CallOutcome>) =>
    onChange(value.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= MAX_OUTCOMES) return;
    onChange([...value, { id: newCallOutcomeId(), label: '', label_es: '' }]);
  };
  const addSuggested = () =>
    onChange(SUGGESTED.map(([label, label_es]) => ({ id: newCallOutcomeId(), label, label_es })));

  return (
    <div className="space-y-2">
      <Label>Call close outcomes</Label>
      <p className="text-xs text-muted-foreground">
        What the agent can select when a call ends — at any point of the script, or after completing it. Leave empty to keep the default End Call reasons.
      </p>

      {value.map((o, idx) => (
        <div key={o.id || idx} className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === value.length - 1}>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Input
                value={o.label}
                maxLength={80}
                onChange={e => update(idx, { label: e.target.value })}
                placeholder="English label (required)"
                className={cn(dups.has(idx) && 'border-destructive')}
              />
              {dups.has(idx) && <p className="text-xs text-destructive">Duplicate label</p>}
            </div>
            <Input
              value={o.label_es ?? ''}
              maxLength={80}
              onChange={e => update(idx, { label_es: e.target.value })}
              placeholder="Spanish (optional)"
            />
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(idx)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={value.length >= MAX_OUTCOMES}>
          <Plus className="w-4 h-4 mr-1" /> Add outcome
        </Button>
        {value.length === 0 && (
          <Button type="button" variant="outline" size="sm" onClick={addSuggested}>
            Add suggested outcomes
          </Button>
        )}
      </div>
      {dups.size > 0 && <p className="text-xs text-destructive">{DUPLICATE_OUTCOME_MESSAGE}</p>}
      <p className="text-xs text-muted-foreground">
        Removing or renaming an outcome does not change past calls — they keep the label they were saved with.
      </p>
    </div>
  );
}
