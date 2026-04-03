import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { QuestionCard } from './QuestionCard';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';
import type { WizardData } from './StepUpload';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const emptyQuestion = (order: number): ScriptQuestion => ({
  order,
  question: '',
  type: 'open_ended',
  required: true,
});

export function StepQuestions({ data, onChange }: Props) {
  const { questions } = data;

  const updateQuestion = (idx: number, updates: Partial<ScriptQuestion>) => {
    onChange({ questions: questions.map((q, i) => i === idx ? { ...q, ...updates } : q) });
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onChange({ questions: updated.map((q, i) => ({ ...q, order: i + 1 })) });
  };

  const addQuestion = () => {
    onChange({ questions: [...questions, emptyQuestion(questions.length + 1)] });
  };

  const deleteQuestion = (idx: number) => {
    onChange({ questions: questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i + 1 })) });
  };

  const duplicateQuestion = (idx: number) => {
    const q = { ...questions[idx], order: questions.length + 1 };
    const updated = [...questions];
    updated.splice(idx + 1, 0, q);
    onChange({ questions: updated.map((q, i) => ({ ...q, order: i + 1 })) });
  };

  return (
    <Tabs defaultValue="questions" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
        <TabsTrigger value="intro">Intro & Closing</TabsTrigger>
        <TabsTrigger value="rebuttal">Rebuttal</TabsTrigger>
      </TabsList>

      <TabsContent value="questions" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Survey Questions</Label>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="w-4 h-4 mr-1" /> Add Question
          </Button>
        </div>

        {questions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-xl">
            <p className="text-sm text-muted-foreground mb-3">No questions yet</p>
            <Button onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-2" /> Add First Question
            </Button>
          </div>
        )}

        {questions.map((q, idx) => (
          <QuestionCard
            key={idx}
            question={q}
            index={idx}
            totalQuestions={questions.length}
            onChange={updates => updateQuestion(idx, updates)}
            onMoveUp={() => moveQuestion(idx, 'up')}
            onMoveDown={() => moveQuestion(idx, 'down')}
            onDelete={() => deleteQuestion(idx)}
            onDuplicate={() => duplicateQuestion(idx)}
          />
        ))}

        {questions.length > 0 && (
          <Button variant="outline" className="w-full" onClick={addQuestion}>
            <Plus className="w-4 h-4 mr-2" /> Add Question
          </Button>
        )}
      </TabsContent>

      <TabsContent value="intro" className="space-y-5 pt-2">
        <div className="space-y-2">
          <Label>Opening Introduction</Label>
          <p className="text-xs text-muted-foreground">
            Read aloud when the call starts. Use <code className="bg-muted px-1 rounded">{'{agent_name}'}</code> to auto-insert the researcher's name.
          </p>
          <Textarea
            value={data.introScript}
            onChange={e => onChange({ introScript: e.target.value })}
            placeholder="Hello, my name is {agent_name} and I'm calling from PadSplit..."
            rows={5}
          />
        </div>
        <div className="space-y-2">
          <Label>Closing Script</Label>
          <p className="text-xs text-muted-foreground">Read after the last question, before wrapping up.</p>
          <Textarea
            value={data.closingScript}
            onChange={e => onChange({ closingScript: e.target.value })}
            placeholder="Thank you so much for your time and feedback today..."
            rows={4}
          />
        </div>
      </TabsContent>

      <TabsContent value="rebuttal" className="space-y-5 pt-2">
        <div className="space-y-2">
          <Label>Rebuttal / Decline Script</Label>
          <p className="text-xs text-muted-foreground">Read when the caller declines to participate.</p>
          <Textarea
            value={data.rebuttalScript}
            onChange={e => onChange({ rebuttalScript: e.target.value })}
            placeholder="I completely understand, and I appreciate your time..."
            rows={4}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
