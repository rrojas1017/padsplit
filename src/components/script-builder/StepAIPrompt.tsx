import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';
import type { WizardData } from './StepUpload';

const AI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (fast, recommended)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (complex scripts)' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (balanced)' },
];

function generateAIPrompt(name: string, scriptType: string, questions: ScriptQuestion[]): string {
  const questionsBlock = questions
    .filter(q => q.question?.trim())
    .map((q, i) => {
      let block = `Q${i + 1}: ${q.question}`;
      if (q.type === 'multiple_choice' && q.options?.length) {
        block += `\n  Options: ${q.options.join(' | ')}`;
      }
      if (q.type === 'scale') {
        block += `\n  Scale: 1 to 10`;
      }
      if (q.ai_extraction_hint) {
        block += `\n  [Extract as: ${q.ai_extraction_hint}]`;
      }
      if (q.probes?.length) {
        block += `\n  Probes: ${q.probes.join('; ')}`;
      }
      return block;
    }).join('\n\n');

  if (scriptType === 'qualitative') {
    return `You are analyzing a phone call recording between a PadSplit agent and a member.
This call follows the "${name}" research script.

The agent asked the following questions:

${questionsBlock}

For each question, extract:
1. The member's response (verbatim quote if possible)
2. Key themes or sentiments expressed
3. Any specific names, properties, or issues mentioned
4. Sentiment: positive / neutral / negative / mixed

Also provide:
- Overall sentiment of the call
- Primary reason/theme identified
- Whether the case needs human review (flag if: contradictory answers, emotional distress, mentions of legal action, or the agent deviated from the script)
- Addressability score: can PadSplit act on this feedback? (addressable / partially_addressable / not_addressable)

Return as structured JSON matching the research_insights schema.`;
  }

  if (scriptType === 'quantitative') {
    return `You are analyzing a phone call recording between a PadSplit agent and a member.
This call follows the "${name}" research script with structured multiple-choice questions.

The agent asked the following questions:

${questionsBlock}

For each question, extract the member's selected answer. Map their response to the closest matching option.
If the member's answer doesn't match any option exactly, choose the closest match and note the discrepancy.
If a question was skipped or not answered, mark it as null.

Return as structured JSON with keys matching q1 through q${questions.length} format, plus:
- completion_rate: what percentage of questions were answered
- data_quality: high / medium / low (based on how clearly the member answered)
- notes: any observations about the call quality or deviations`;
  }

  return `You are analyzing a phone call recording between a PadSplit agent and a member.
This call follows the "${name}" research script, which contains both structured and open-ended questions.

The agent asked the following questions:

${questionsBlock}

For structured questions (multiple choice, yes/no, rating scale): extract the specific answer selected.
For open-ended questions: extract verbatim quotes and identify key themes.

Return as structured JSON with:
- Answers for each question (keyed as q1 through q${questions.length})
- Overall sentiment (positive / neutral / negative / mixed)
- Key themes identified across all open-ended responses
- Addressability score (addressable / partially_addressable / not_addressable)
- Flag for human review if needed`;
}

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

export function StepAIPrompt({ data, onChange }: Props) {
  const regenerate = useCallback(() => {
    const prompt = generateAIPrompt(data.name, data.scriptType, data.questions);
    onChange({ aiPrompt: prompt });
  }, [data.name, data.scriptType, data.questions, onChange]);

  // Auto-generate on first visit if empty
  if (!data.aiPrompt) {
    const prompt = generateAIPrompt(data.name, data.scriptType, data.questions);
    onChange({ aiPrompt: prompt });
  }

  return (
    <div className="space-y-6">
      {/* Prompt Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">AI Processing Prompt</Label>
            <p className="text-xs text-muted-foreground mt-0.5">This prompt is sent to the AI model when processing call recordings for this script</p>
          </div>
          <Button variant="outline" size="sm" onClick={regenerate}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Regenerate
          </Button>
        </div>

        <div className="relative">
          <Textarea
            value={data.aiPrompt}
            onChange={e => onChange({ aiPrompt: e.target.value })}
            className="min-h-[400px] font-mono text-sm bg-slate-950 text-slate-100 border-slate-800 rounded-xl p-6"
            style={{ lineHeight: '1.6' }}
          />
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs">AI Model</Label>
              <Select value={data.aiModel} onValueChange={v => onChange({ aiModel: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Temperature: {data.aiTemperature.toFixed(2)}</Label>
              <Slider
                value={[data.aiTemperature]}
                onValueChange={([v]) => onChange({ aiTemperature: v })}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">Lower = more deterministic extraction. Default: 0.20</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
