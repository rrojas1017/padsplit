import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResearchPrompt {
  id: string;
  prompt_key: string;
  prompt_text: string;
  temperature: number;
  model: string;
  version: number;
  updated_at: string;
}

const SUPPORTED_MODELS = [
  'google/gemini-2.5-pro',
  'google/gemini-3-pro-preview',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-5',
  'openai/gpt-5-mini',
];

const PROMPT_LABELS: Record<string, { title: string; description: string }> = {
  merged: { title: 'Prompt AB — Merged Extraction + Classification', description: 'Single call per record: extracts structured data and classifies in one pass (cost-optimized)' },
  extraction: { title: 'Prompt A — Record Extraction (Legacy)', description: 'Legacy: runs per record to extract structured data. Only used if merged prompt is not configured.' },
  classification: { title: 'Prompt B — Record Classification (Legacy)', description: 'Legacy: runs per record to classify. Only used if merged prompt is not configured.' },
  aggregation: { title: 'Prompt C — Aggregate Insights', description: 'Runs on batch of all records to generate the insight report' },
};

export function ResearchPromptsSettings() {
  const [prompts, setPrompts] = useState<ResearchPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<ResearchPrompt>>>({});

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('research_prompts')
        .select('*')
        .order('prompt_key');

      if (error) throw error;
      setPrompts((data || []) as ResearchPrompt[]);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      toast.error('Failed to load research prompts');
    } finally {
      setIsLoading(false);
    }
  };

  const getEditedValue = (key: string, field: keyof ResearchPrompt) => {
    const edit = edits[key];
    const prompt = prompts.find(p => p.prompt_key === key);
    if (edit && field in edit) return edit[field];
    return prompt?.[field];
  };

  const setEdit = (key: string, field: keyof ResearchPrompt, value: any) => {
    setEdits(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSave = async (promptKey: string) => {
    const prompt = prompts.find(p => p.prompt_key === promptKey);
    if (!prompt) return;

    setSavingKey(promptKey);
    const edit = edits[promptKey] || {};

    try {
      const { error } = await supabase
        .from('research_prompts')
        .update({
          prompt_text: edit.prompt_text ?? prompt.prompt_text,
          temperature: edit.temperature ?? prompt.temperature,
          model: edit.model ?? prompt.model,
          version: prompt.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prompt.id);

      if (error) throw error;

      toast.success(`${PROMPT_LABELS[promptKey]?.title || promptKey} saved (v${prompt.version + 1})`);
      setEdits(prev => { const next = { ...prev }; delete next[promptKey]; return next; });
      await fetchPrompts();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('Failed to save prompt');
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading prompts...</div>;
  }

  const orderedKeys = ['merged', 'extraction', 'classification', 'aggregation'];

  return (
    <div className="space-y-6">
      {orderedKeys.map((key) => {
        const prompt = prompts.find(p => p.prompt_key === key);
        if (!prompt) return null;
        const label = PROMPT_LABELS[key];
        const hasEdits = !!edits[key];

        return (
          <Card key={key}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">{label.title}</h4>
                  <p className="text-xs text-muted-foreground">{label.description}</p>
                </div>
                <Badge variant="outline">v{prompt.version}</Badge>
              </div>

              <Textarea
                value={(getEditedValue(key, 'prompt_text') as string) || ''}
                onChange={(e) => setEdit(key, 'prompt_text', e.target.value)}
                className="min-h-[200px] font-mono text-xs"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Model</label>
                  <Select
                    value={(getEditedValue(key, 'model') as string) || ''}
                    onValueChange={(v) => setEdit(key, 'model', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Temperature: {(getEditedValue(key, 'temperature') as number)?.toFixed(1) || '0.2'}
                  </label>
                  <Slider
                    value={[Number(getEditedValue(key, 'temperature')) || 0.2]}
                    onValueChange={([v]) => setEdit(key, 'temperature', v)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSave(key)}
                  disabled={savingKey === key || !hasEdits}
                  className="gap-2"
                  size="sm"
                >
                  {savingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
