import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { QuestionCard } from './QuestionCard';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';
import type { WizardData } from './StepUpload';
import { generateQuestionId } from '@/utils/rawScriptAnswers';
import { GridQuestionCard } from './GridQuestionCard';
import { appendGrid, duplicateBlock, groupEditorBlocks, moveBlock, removeBlock } from '@/utils/scriptMatrix';
import { CallOutcomesEditor } from '@/components/research/CallOutcomesEditor';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const emptyQuestion = (order: number): ScriptQuestion => ({
  id: generateQuestionId(),
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
    onChange({ questions: moveBlock(questions, idx, idx, direction) });
  };

  const addGrid = () => {
    onChange({ questions: appendGrid(questions, generateQuestionId) });
  };

  const blocks = groupEditorBlocks(questions);

  const addQuestion = () => {
    onChange({ questions: [...questions, emptyQuestion(questions.length + 1)] });
  };

  const deleteQuestion = (idx: number) => {
    onChange({ questions: questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i + 1 })) });
  };

  const duplicateQuestion = (idx: number) => {
    const q = { ...questions[idx], id: generateQuestionId(), order: questions.length + 1 };
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-1" /> Add Question
            </Button>
            <Button variant="outline" size="sm" onClick={addGrid}>
              <Plus className="w-4 h-4 mr-1" /> Add grid question
            </Button>
          </div>
        </div>

        {questions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-xl">
            <p className="text-sm text-muted-foreground mb-3">No questions yet</p>
            <Button onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-2" /> Add First Question
            </Button>
          </div>
        )}

        {blocks.map((b, bi) => b.kind === 'grid' ? (
          <GridQuestionCard
            key={`g-${b.start}-${String(questions[b.start].matrix?.group)}`}
            questions={questions}
            start={b.start}
            end={b.end}
            onChange={qs => onChange({ questions: qs })}
            onMoveUp={() => onChange({ questions: moveBlock(questions, b.start, b.end, 'up') })}
            onMoveDown={() => onChange({ questions: moveBlock(questions, b.start, b.end, 'down') })}
            onDelete={() => onChange({ questions: removeBlock(questions, b.start, b.end) })}
            onDuplicate={() => onChange({ questions: duplicateBlock(questions, b.start, b.end, generateQuestionId) })}
            canMoveUp={bi > 0}
            canMoveDown={bi < blocks.length - 1}
            newId={generateQuestionId}
          />
        ) : (
          <QuestionCard
            key={b.index}
            question={questions[b.index]}
            index={b.index}
            totalQuestions={questions.length}
            onChange={updates => updateQuestion(b.index, updates)}
            onMoveUp={() => moveQuestion(b.index, 'up')}
            onMoveDown={() => moveQuestion(b.index, 'down')}
            onDelete={() => deleteQuestion(b.index)}
            onDuplicate={() => duplicateQuestion(b.index)}
          />
        ))}

        {questions.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-2" /> Add Question
            </Button>
            <Button variant="outline" className="flex-1" onClick={addGrid}>
              <Plus className="w-4 h-4 mr-2" /> Add grid question
            </Button>
          </div>
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
        <CallOutcomesEditor value={data.callOutcomes ?? []} onChange={callOutcomes => onChange({ callOutcomes })} />
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
