import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface Row { options?: string[]; matrix?: { row: string }; question?: string; text?: string }

interface Props {
  rows: Row[];
  getValue: (k: number) => unknown;
  setValue: (k: number, value: string | undefined) => void;
  idPrefix: string;
}

/** CR-013: renders a grid block (rows × columns) with one radio per cell. */
export function MatrixGridInput({ rows, getValue, setValue, idPrefix }: Props) {
  const headers = rows[0]?.options || [];
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid gap-2 px-4 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: `minmax(0,2fr) repeat(${headers.length}, minmax(0,1fr))` }}>
        <span />
        {headers.map((h, i) => <span key={i} className="text-center">{h}</span>)}
      </div>
      {rows.map((r, k) => {
        const opts = r.options || [];
        const current = getValue(k);
        const value = typeof current === 'string' ? current : '';
        const label = r.matrix?.row || r.question || r.text || `Row ${k + 1}`;
        return (
          <div key={k} className="border rounded-lg px-4 py-3">
            <RadioGroup
              value={value}
              onValueChange={v => setValue(k, v)}
              className="flex flex-col gap-2 sm:grid sm:items-center"
              style={{ gridTemplateColumns: `minmax(0,2fr) repeat(${headers.length}, minmax(0,1fr))` }}
            >
              <span className="text-sm font-medium">{label}</span>
              <div className="flex flex-wrap gap-4 sm:contents">
                {opts.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 sm:justify-center">
                    <RadioGroupItem
                      value={opt}
                      id={`${idPrefix}-${k}-${i}`}
                      onClick={() => { if (value === opt) setValue(k, undefined); }}
                    />
                    <Label htmlFor={`${idPrefix}-${k}-${i}`} className="cursor-pointer text-sm sm:hidden">{opt}</Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        );
      })}
    </div>
  );
}
