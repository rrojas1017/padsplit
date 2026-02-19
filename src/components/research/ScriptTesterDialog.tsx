import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, ArrowLeft, MessageSquare, XCircle, ThumbsUp, ThumbsDown, RotateCcw, Play, CheckCircle, PhoneOff } from 'lucide-react';
import { StepTracker, buildSteps } from '@/components/research/StepTracker';
import type { ResearchScript, ScriptQuestion } from '@/hooks/useResearchScripts';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

type Phase = 'start' | 'intro' | 'consent' | 'question' | 'closing' | 'rebuttal' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: ResearchScript;
}

const END_DISPOSITIONS = [
  { value: 'caller_hung_up', label: 'Caller Hung Up' },
  { value: 'caller_stopped', label: 'Caller Asked to Stop' },
  { value: 'other', label: 'Other' },
];

export function ScriptTesterDialog({ open, onOpenChange, script }: Props) {
  const [phase, setPhase] = useState<Phase>('start');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, unknown>>({});
  const [endCallOpen, setEndCallOpen] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  const [earlyDisposition, setEarlyDisposition] = useState<string | null>(null);
  const [selectedEndDisposition, setSelectedEndDisposition] = useState('caller_hung_up');

  const questions = script.questions;
  const introScript = script.intro_script || '';
  const rebuttalScript = script.rebuttal_script || '';
  const closingScript = script.closing_script || '';
  const renderedIntro = introScript.replace(/\{agent_name\}/gi, 'Test Agent');

  const restart = useCallback(() => {
    setPhase('start');
    setQuestionIndex(0);
    setResponses({});
    setEndedEarly(false);
    setEarlyDisposition(null);
    setSelectedEndDisposition('caller_hung_up');
  }, []);

  const handleEndCall = (disposition: string) => {
    setEndedEarly(true);
    setEarlyDisposition(disposition);
    setEndCallOpen(false);
    setPhase('done');
  };

  const handleConsent = (agreed: boolean) => {
    if (agreed) {
      if (questions.length > 0) {
        setPhase('question');
        setQuestionIndex(0);
      } else if (closingScript) {
        setPhase('closing');
      } else {
        setPhase('done');
      }
    } else {
      if (rebuttalScript) {
        setPhase('rebuttal');
      } else {
        setPhase('done');
      }
    }
  };

  const handleNext = () => {
    if (phase === 'intro') {
      setPhase('consent');
    } else if (phase === 'question') {
      if (questionIndex < questions.length - 1) {
        setQuestionIndex(prev => prev + 1);
      } else if (closingScript) {
        setPhase('closing');
      } else {
        setPhase('done');
      }
    } else if (phase === 'closing' || phase === 'rebuttal') {
      setPhase('done');
    }
  };

  const handleBack = () => {
    if (phase === 'question' && questionIndex > 0) {
      setQuestionIndex(prev => prev - 1);
    } else if (phase === 'question' && questionIndex === 0) {
      setPhase('consent');
    } else if (phase === 'consent') {
      if (introScript) setPhase('intro');
      else setPhase('start');
    } else if (phase === 'intro') {
      setPhase('start');
    } else if (phase === 'closing') {
      if (questions.length > 0) {
        setPhase('question');
        setQuestionIndex(questions.length - 1);
      } else {
        setPhase('consent');
      }
    }
  };

  const currentQ = questions[questionIndex];
  const isActivePhase = phase !== 'start' && phase !== 'done';
  const isNextDisabled = phase === 'question' && currentQ?.type === 'yes_no' && responses[questionIndex] === undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) restart(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Test Script: {script.name}
            </DialogTitle>
            <DialogDescription>
              Walk through the script exactly as the researcher will see it
            </DialogDescription>
          </DialogHeader>

          {/* Step Tracker */}
          {phase !== 'start' && phase !== 'done' && (
            <StepTracker
              steps={buildSteps({
                hasIntro: !!introScript,
                hasClosing: !!closingScript,
                questions,
                phase,
                questionIndex,
              })}
              totalQuestions={questions.length}
              activeQuestionIndex={questionIndex}
              onEndCall={() => setEndCallOpen(true)}
            />
          )}

          {/* START */}
          {phase === 'start' && (
            <div className="text-center py-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{script.name}</h3>
                {script.description && <p className="text-sm text-muted-foreground">{script.description}</p>}
                <div className="flex gap-1.5 justify-center">
                  <Badge variant="outline">{questions.length} questions</Badge>
                  {introScript && <Badge variant="secondary">Has intro</Badge>}
                  {closingScript && <Badge variant="secondary">Has closing</Badge>}
                  {rebuttalScript && <Badge variant="secondary">Has rebuttal</Badge>}
                </div>
              </div>
              <Button size="lg" onClick={() => setPhase(introScript ? 'intro' : 'consent')}>
                <Play className="w-4 h-4 mr-2" /> Start Test
              </Button>
            </div>
          )}

          {/* INTRO */}
          {phase === 'intro' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Read aloud to the caller</span>
              </div>
              <div className="bg-muted/50 rounded-xl p-5 border">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{renderedIntro}</p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleNext}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {/* CONSENT */}
          {phase === 'consent' && (
            <div className="text-center space-y-4 py-4">
              <h3 className="text-lg font-semibold">Did the caller agree to continue?</h3>
              <p className="text-muted-foreground">"May I ask you a few questions?"</p>
              <div className="flex gap-4 justify-center pt-2">
                <Button size="lg" className="px-10 py-6 text-xl" onClick={() => handleConsent(true)}>
                  <ThumbsUp className="w-5 h-5 mr-2" /> Yes
                </Button>
                <Button size="lg" variant="outline" className="px-10 py-6 text-xl" onClick={() => handleConsent(false)}>
                  <ThumbsDown className="w-5 h-5 mr-2" /> No
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </div>
          )}

          {/* QUESTION */}
          {phase === 'question' && currentQ && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Read aloud to the caller</span>
              </div>
              <div className="bg-muted/50 rounded-xl p-6 py-7 border">
                <p className="text-2xl font-medium leading-relaxed">{currentQ.question}</p>
              </div>

              {/* Response input simulation */}
              <div className="space-y-2">
                {currentQ.type === 'scale' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Response: {(responses[questionIndex] as number) || 5}</Label>
                    <Slider
                      min={1} max={10} step={1}
                      value={[(responses[questionIndex] as number) || 5]}
                      onValueChange={([v]) => setResponses(prev => ({ ...prev, [questionIndex]: v }))}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span><span>10</span>
                    </div>
                  </div>
                )}
                {currentQ.type === 'yes_no' && (
                  <div className="space-y-2">
                    <RadioGroup
                      value={(responses[questionIndex] as string) || ''}
                      onValueChange={v => setResponses(prev => ({ ...prev, [questionIndex]: v }))}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="yes" id={`yn-yes-${questionIndex}`} />
                        <Label htmlFor={`yn-yes-${questionIndex}`} className="cursor-pointer font-medium">Yes</Label>
                      </div>
                      <div className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="no" id={`yn-no-${questionIndex}`} />
                        <Label htmlFor={`yn-no-${questionIndex}`} className="cursor-pointer font-medium">No</Label>
                      </div>
                    </RadioGroup>
                    {responses[questionIndex] === undefined && (
                      <p className="text-xs text-muted-foreground">A Yes or No response is required to determine next steps.</p>
                    )}
                  </div>
                )}
                {currentQ.type === 'multiple_choice' && (
                  <RadioGroup
                    value={(responses[questionIndex] as string) || ''}
                    onValueChange={v => setResponses(prev => ({ ...prev, [questionIndex]: v }))}
                    className="space-y-2"
                  >
                    {(currentQ.options || []).map((opt, i) => (
                      <div key={i} className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value={opt} id={`mc-${questionIndex}-${i}`} />
                        <Label htmlFor={`mc-${questionIndex}-${i}`} className="cursor-pointer">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                {currentQ.type === 'open_ended' && (
                  <Textarea
                    placeholder="Quick notes (optional — AI extracts from recording)"
                    value={(responses[questionIndex] as string) || ''}
                    onChange={e => setResponses(prev => ({ ...prev, [questionIndex]: e.target.value }))}
                    rows={4}
                  />
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleNext} disabled={isNextDisabled}>
                  {questionIndex < questions.length - 1 ? 'Next' : 'Finish'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* CLOSING */}
          {phase === 'closing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Read closing script</span>
              </div>
              <div className="bg-primary/5 rounded-xl p-5 border">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{closingScript}</p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleNext}>Done <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {/* REBUTTAL */}
          {phase === 'rebuttal' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4" />
                <span>Read dismissal script</span>
              </div>
              <div className="bg-destructive/5 rounded-xl p-5 border border-destructive/20">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{rebuttalScript}</p>
              </div>
              <Button className="w-full" onClick={handleNext}>
                End Call <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <div className="text-center py-6 space-y-4">
              {endedEarly ? (
                <>
                  <PhoneOff className="w-12 h-12 mx-auto text-destructive" />
                  <h3 className="text-lg font-semibold">Call Ended Early</h3>
                  <p className="text-sm text-muted-foreground">
                    Disposition: <span className="font-medium">{END_DISPOSITIONS.find(d => d.value === earlyDisposition)?.label || earlyDisposition}</span>
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-12 h-12 mx-auto text-primary" />
                  <h3 className="text-lg font-semibold">Test Complete!</h3>
                  <p className="text-sm text-muted-foreground">You've walked through the full script flow.</p>
                </>
              )}
              <div className="flex gap-3 justify-center">
                <Button onClick={restart}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Restart Test
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* End Call AlertDialog */}
      <AlertDialog open={endCallOpen} onOpenChange={setEndCallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PhoneOff className="w-5 h-5 text-destructive" /> End Call Early
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select a reason for ending the call. Responses collected so far will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            {END_DISPOSITIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setSelectedEndDisposition(d.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  selectedEndDisposition === d.value
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => handleEndCall(selectedEndDisposition)}>
              Confirm End Call
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
