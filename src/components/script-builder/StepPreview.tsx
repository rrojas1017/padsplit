import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, RotateCcw, MessageSquare } from 'lucide-react';
import type { WizardData } from './StepUpload';
import { resolveNextQuestionIndex, type NextStep } from '@/utils/scriptBranching';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';

interface Props {
  data: WizardData;
}

// -1 = intro, 0..n-1 = question, n = closing
type Step = number;

export function StepPreview({ data }: Props) {
  const validQuestions = useMemo(
    () => data.questions.filter(q => q.question?.trim()) as ScriptQuestion[],
    [data.questions]
  );
  const total = validQuestions.length;

  const [currentIdx, setCurrentIdx] = useState<Step>(-1);
  const [history, setHistory] = useState<Step[]>([]);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});

  const isIntro = currentIdx === -1;
  const isClosing = currentIdx >= total;
  const currentQ = !isIntro && !isClosing ? validQuestions[currentIdx] : null;
  const currentAnswer = currentQ ? answers[currentIdx] : undefined;

  const needsAnswerToBranch =
    currentQ && currentQ.branch
      ? (currentQ.type === 'yes_no' && (currentQ.branch.yes_goto !== undefined || currentQ.branch.no_goto !== undefined)) ||
        (currentQ.type === 'scale' && currentQ.branch.scale_threshold !== undefined) ||
        (currentQ.type === 'multiple_choice' && currentQ.branch.option_gotos && Object.keys(currentQ.branch.option_gotos).length > 0)
      : false;

  const nextResolved: NextStep | null = currentQ
    ? resolveNextQuestionIndex({
        currentIndex: currentIdx,
        question: currentQ,
        answer: currentAnswer,
        questionsLength: total,
      })
    : null;

  const nextDisabled = !!needsAnswerToBranch && (currentAnswer === undefined || currentAnswer === '');

  const goTo = (step: Step) => {
    setHistory(prev => [...prev, currentIdx]);
    setCurrentIdx(step);
  };

  const handleNext = () => {
    if (isClosing) return;
    if (isIntro) {
      goTo(total === 0 ? total : 0);
      return;
    }
    if (!currentQ) return;
    const resolved = resolveNextQuestionIndex({
      currentIndex: currentIdx,
      question: currentQ,
      answer: currentAnswer,
      questionsLength: total,
    });
    goTo(resolved === 'closing' ? total : resolved);
  };

  const handlePrev = () => {
    if (history.length === 0) {
      setCurrentIdx(prev => Math.max(prev - 1, -1));
      return;
    }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrentIdx(prev);
  };

  const restart = () => {
    setCurrentIdx(-1);
    setHistory([]);
    setAnswers({});
  };

  const setAnswer = (val: unknown) => {
    setAnswers(a => ({ ...a, [currentIdx]: val }));
  };

  const progress = isIntro ? 0 : isClosing ? 100 : ((currentIdx + 1) / Math.max(total, 1)) * 100;

  // Highlight target in the flow map
  const highlightedNextIdx: number | 'closing' | null =
    currentQ && currentAnswer !== undefined && currentAnswer !== '' ? (nextResolved as NextStep) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Phone mockup */}
      <div className="lg:col-span-2">
        <Card className="max-w-lg mx-auto rounded-2xl shadow-xl border-2">
          <CardContent className="p-0">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {isIntro ? 'Introduction' : isClosing ? 'Closing' : `Question ${currentIdx + 1} of ${total}`}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={restart}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Restart
                </Button>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Content */}
            <div className="p-5 min-h-[300px] flex flex-col">
              {isIntro && (
                <div className="flex-1 space-y-4">
                  <Badge variant="outline" className="text-xs">Opening Script</Badge>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {data.introScript || <span className="text-muted-foreground italic">No introduction script configured</span>}
                  </p>
                </div>
              )}

              {isClosing && (
                <div className="flex-1 space-y-4">
                  <Badge variant="outline" className="text-xs">Closing Script</Badge>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {data.closingScript || <span className="text-muted-foreground italic">No closing script configured</span>}
                  </p>
                  <div className="text-center pt-4">
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">✓ Survey Complete</Badge>
                  </div>
                </div>
              )}

              {currentQ && (
                <div className="flex-1 space-y-4">
                  {currentQ.section && (
                    <Badge variant="secondary" className="text-xs">{currentQ.section}</Badge>
                  )}

                  {currentQ.probes?.length ? (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400 p-3 text-xs rounded-r-lg">
                      <div className="flex items-center gap-1.5 mb-1 font-medium text-blue-700 dark:text-blue-300">
                        <MessageSquare className="w-3 h-3" /> Probes
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
                        {currentQ.probes.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  <p className="text-base font-medium leading-relaxed">{currentQ.question}</p>

                  {currentQ.type === 'open_ended' && (
                    <Textarea
                      placeholder="Member's response..."
                      rows={3}
                      className="text-sm"
                      value={(currentAnswer as string) || ''}
                      onChange={e => setAnswer(e.target.value)}
                    />
                  )}

                  {currentQ.type === 'multiple_choice' && currentQ.options?.length ? (
                    <RadioGroup
                      className="space-y-2"
                      value={(currentAnswer as string) || ''}
                      onValueChange={val => setAnswer(val)}
                    >
                      {currentQ.options.map((opt, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`opt-${currentIdx}-${i}`} />
                          <Label htmlFor={`opt-${currentIdx}-${i}`} className="text-sm cursor-pointer">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : null}

                  {currentQ.type === 'scale' && (() => {
                    const min = currentQ.scale_min ?? 1;
                    const max = currentQ.scale_max ?? 10;
                    return (
                      <div className="flex gap-1.5 flex-wrap">
                        {Array.from({ length: max - min + 1 }, (_, i) => {
                          const val = min + i;
                          const selected = Number(currentAnswer) === val;
                          return (
                            <Button
                              key={i}
                              variant={selected ? 'default' : 'outline'}
                              size="sm"
                              className="h-9 w-9 text-sm"
                              onClick={() => setAnswer(val)}
                            >
                              {val}
                            </Button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {currentQ.type === 'yes_no' && (
                    <div className="flex gap-3">
                      <Button
                        variant={currentAnswer === 'yes' ? 'default' : 'outline'}
                        className="flex-1 h-12"
                        onClick={() => setAnswer('yes')}
                      >
                        Yes
                      </Button>
                      <Button
                        variant={currentAnswer === 'no' ? 'default' : 'outline'}
                        className="flex-1 h-12"
                        onClick={() => setAnswer('no')}
                      >
                        No
                      </Button>
                    </div>
                  )}

                  {currentQ.branch && (currentAnswer !== undefined && currentAnswer !== '') && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                      Next →{' '}
                      {nextResolved === 'closing'
                        ? 'Closing'
                        : `Question ${(nextResolved as number) + 1}`}
                    </p>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 mt-auto border-t">
                <Button variant="outline" size="sm" onClick={handlePrev} disabled={isIntro && history.length === 0}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <Button size="sm" onClick={handleNext} disabled={isClosing || nextDisabled}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Script Flow Map */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Script Flow</Label>
        <ScrollArea className="h-[500px]">
          <div className="space-y-1 pr-3">
            <button
              onClick={() => { setHistory(h => [...h, currentIdx]); setCurrentIdx(-1); }}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                isIntro ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              📋 Introduction
            </button>

            {validQuestions.map((q, i) => {
              const isCurrent = currentIdx === i;
              const isNextTarget = highlightedNextIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => { setHistory(h => [...h, currentIdx]); setCurrentIdx(i); }}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isNextTarget
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="font-medium">Q{i + 1}</span>{' '}
                  <span>{q.question?.slice(0, 40)}{(q.question?.length || 0) > 40 ? '…' : ''}</span>
                  {q.branch && <span className="ml-1 text-[10px]">↗</span>}
                  {isNextTarget && <span className="ml-1 text-[10px] font-semibold">← next</span>}
                </button>
              );
            })}

            <button
              onClick={() => { setHistory(h => [...h, currentIdx]); setCurrentIdx(total); }}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                isClosing
                  ? 'bg-primary text-primary-foreground'
                  : highlightedNextIdx === 'closing'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40'
                  : 'hover:bg-muted'
              }`}
            >
              ✅ Closing
              {highlightedNextIdx === 'closing' && <span className="ml-1 text-[10px] font-semibold">← next</span>}
            </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
