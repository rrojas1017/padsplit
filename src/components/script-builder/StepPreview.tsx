import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, RotateCcw, MessageSquare } from 'lucide-react';
import type { WizardData } from './StepUpload';

interface Props {
  data: WizardData;
}

export function StepPreview({ data }: Props) {
  const { questions } = data;
  const [currentIdx, setCurrentIdx] = useState(-1); // -1 = intro
  const validQuestions = questions.filter(q => q.question?.trim());
  const total = validQuestions.length;

  const isIntro = currentIdx === -1;
  const isClosing = currentIdx >= total;
  const currentQ = !isIntro && !isClosing ? validQuestions[currentIdx] : null;

  const handleNext = () => {
    if (currentQ?.type === 'yes_no' && currentQ.branch) {
      // Simple branching: just go next for now in preview
    }
    setCurrentIdx(prev => Math.min(prev + 1, total));
  };

  const handlePrev = () => setCurrentIdx(prev => Math.max(prev - 1, -1));
  const restart = () => setCurrentIdx(-1);

  const progress = isIntro ? 0 : isClosing ? 100 : ((currentIdx + 1) / total) * 100;

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

                  {/* Agent notes callout */}
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

                  {/* Response area by type */}
                  {currentQ.type === 'open_ended' && (
                    <Textarea placeholder="Member's response..." rows={3} className="text-sm" disabled />
                  )}

                  {currentQ.type === 'multiple_choice' && currentQ.options?.length ? (
                    <RadioGroup className="space-y-2">
                      {currentQ.options.map((opt, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`opt-${i}`} disabled />
                          <Label htmlFor={`opt-${i}`} className="text-sm">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : null}

                  {currentQ.type === 'scale' && (
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from({ length: 10 }, (_, i) => (
                        <Button key={i} variant="outline" size="sm" className="h-9 w-9 text-sm" disabled>
                          {i + 1}
                        </Button>
                      ))}
                    </div>
                  )}

                  {currentQ.type === 'yes_no' && (
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12" disabled>Yes</Button>
                      <Button variant="outline" className="flex-1 h-12" disabled>No</Button>
                    </div>
                  )}

                  {currentQ.branch && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                      Branching: {currentQ.branch.yes_goto ? `Yes → Q${currentQ.branch.yes_goto}` : ''}{' '}
                      {currentQ.branch.no_goto ? `No → Q${currentQ.branch.no_goto}` : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 mt-auto border-t">
                <Button variant="outline" size="sm" onClick={handlePrev} disabled={isIntro}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <Button size="sm" onClick={handleNext} disabled={isClosing}>
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
            {/* Intro */}
            <button
              onClick={() => setCurrentIdx(-1)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                isIntro ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              📋 Introduction
            </button>

            {validQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                  currentIdx === i ? 'bg-primary text-primary-foreground' : currentIdx > i ? 'text-muted-foreground' : 'hover:bg-muted'
                }`}
              >
                <span className="font-medium">Q{i + 1}</span>{' '}
                <span className="truncate">{q.question?.slice(0, 40)}{(q.question?.length || 0) > 40 ? '…' : ''}</span>
                {q.branch && <span className="ml-1 text-[10px]">↗</span>}
              </button>
            ))}

            {/* Closing */}
            <button
              onClick={() => setCurrentIdx(total)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                isClosing ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              ✅ Closing
            </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
