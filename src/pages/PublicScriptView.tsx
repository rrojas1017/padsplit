import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, XCircle, CheckCircle, Play, RotateCcw } from 'lucide-react';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';

interface ScriptQuestion {
  id?: number;
  order?: number;
  text?: string;
  question?: string;
  type: string;
  required?: boolean;
  options?: string[];
  probes?: string[];
  branch?: {
    yes_goto?: number;
    no_goto?: number;
    yes_probes?: string[];
    no_probes?: string[];
  };
  section?: string;
  is_internal?: boolean;
  ai_extraction_hint?: string;
}

interface PublicScript {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  target_audience: string;
  questions: ScriptQuestion[];
  intro_script: string | null;
  rebuttal_script: string | null;
  closing_script: string | null;
}

type Phase = 'start' | 'intro' | 'consent' | 'question' | 'closing' | 'rebuttal' | 'done';

const CAMPAIGN_LABELS: Record<string, string> = {
  satisfaction: 'Satisfaction',
  market_research: 'Market Research',
  retention: 'Retention',
};

const AUDIENCE_LABELS: Record<string, string> = {
  existing_member: 'Existing Members',
  former_booking: 'Former Bookings',
  rejected: 'Rejected Leads',
};

function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-lg p-6 space-y-5">
      {children}
    </div>
  );
}

function ScriptBlock({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'amber' | 'green' | 'red' }) {
  const styles = {
    default: 'bg-primary/5 border-primary/20',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    green: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    red: 'bg-destructive/5 border-destructive/20',
  };
  return (
    <div className={`rounded-xl border p-5 ${styles[variant]}`}>
      <p className="text-base leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}

export default function PublicScriptView() {
  const { token } = useParams<{ token: string }>();
  const [script, setScript] = useState<PublicScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('start');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, unknown>>({});

  useEffect(() => {
    if (!token) { setError('No token provided'); setIsLoading(false); return; }
    supabase.functions.invoke('validate-script-token', { body: { token } })
      .then(({ data, error: fnError }) => {
        if (fnError) setError('Unable to load script. Please try again.');
        else if (!data?.valid) setError(data?.error || 'Invalid or expired link.');
        else setScript(data.script);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const restart = useCallback(() => {
    setPhase('start');
    setQuestionIndex(0);
    setResponses({});
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading script…</p>
        </div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm mx-auto px-6">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-semibold">Link Unavailable</h1>
          <p className="text-muted-foreground text-sm">{error || 'This script link is invalid or has been revoked.'}</p>
        </div>
      </div>
    );
  }

  const sortedQuestions = [...(script.questions || [])].sort(
    (a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0)
  );

  const introScript = script.intro_script || '';
  const rebuttalScript = script.rebuttal_script || '';
  const closingScript = script.closing_script || '';
  const renderedIntro = introScript.replace(/\{agent_name\}/gi, 'Agent');

  const handleConsent = (agreed: boolean) => {
    if (agreed) {
      if (sortedQuestions.length > 0) { setPhase('question'); setQuestionIndex(0); }
      else if (closingScript) setPhase('closing');
      else setPhase('done');
    } else {
      if (rebuttalScript) setPhase('rebuttal');
      else setPhase('done');
    }
  };

  const handleNext = () => {
    if (phase === 'intro') setPhase('consent');
    else if (phase === 'question') {
      if (questionIndex < sortedQuestions.length - 1) setQuestionIndex(prev => prev + 1);
      else if (closingScript) setPhase('closing');
      else setPhase('done');
    } else if (phase === 'closing' || phase === 'rebuttal') setPhase('done');
  };

  const handleBack = () => {
    if (phase === 'question' && questionIndex > 0) setQuestionIndex(prev => prev - 1);
    else if (phase === 'question' && questionIndex === 0) setPhase('consent');
    else if (phase === 'consent') { if (introScript) setPhase('intro'); else setPhase('start'); }
    else if (phase === 'intro') setPhase('start');
    else if (phase === 'closing') {
      if (sortedQuestions.length > 0) { setPhase('question'); setQuestionIndex(sortedQuestions.length - 1); }
      else setPhase('consent');
    }
  };

  const totalSteps = sortedQuestions.length + (introScript ? 1 : 0) + 1 + (closingScript ? 1 : 0);
  const currentStep = (() => {
    if (phase === 'intro') return 1;
    if (phase === 'consent') return introScript ? 2 : 1;
    if (phase === 'question') return (introScript ? 3 : 2) + questionIndex;
    return totalSteps;
  })();
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  const currentQ = sortedQuestions[questionIndex];
  const currentResponse = responses[questionIndex];
  const yesNoResponse = currentQ?.type === 'yes_no' ? (currentResponse as string) : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <img src={padsplitLogo} alt="PadSplit" className="h-8 w-8 rounded object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">{script.name}</h1>
            {script.description && (
              <p className="text-xs text-muted-foreground truncate">{script.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge variant="outline" className="text-xs">{CAMPAIGN_LABELS[script.campaign_type] || script.campaign_type}</Badge>
            <Badge variant="secondary" className="text-xs">{AUDIENCE_LABELS[script.target_audience] || script.target_audience}</Badge>
          </div>
        </div>
      </div>

      {/* Wizard body */}
      <div className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-lg space-y-5">

          {/* Progress bar */}
          {phase !== 'start' && phase !== 'done' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {phase === 'intro' ? 'Introduction'
                    : phase === 'consent' ? 'Consent'
                    : phase === 'question' ? `Question ${questionIndex + 1} of ${sortedQuestions.length}`
                    : phase === 'closing' ? 'Closing'
                    : 'Rebuttal'}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* START */}
          {phase === 'start' && (
            <WizardCard>
              <div className="text-center py-4 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold">{script.name}</h2>
                  {script.description && <p className="text-sm text-muted-foreground">{script.description}</p>}
                  <div className="flex gap-1.5 justify-center flex-wrap pt-1">
                    <Badge variant="outline">{sortedQuestions.length} questions</Badge>
                    {introScript && <Badge variant="secondary">Has intro</Badge>}
                    {closingScript && <Badge variant="secondary">Has closing</Badge>}
                    {rebuttalScript && <Badge variant="secondary">Has rebuttal</Badge>}
                  </div>
                </div>
                <Button size="lg" onClick={() => setPhase(introScript ? 'intro' : 'consent')}>
                  <Play className="w-4 h-4 mr-2" /> Begin Script
                </Button>
              </div>
            </WizardCard>
          )}

          {/* INTRO */}
          {phase === 'intro' && (
            <WizardCard>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Read aloud to the caller</span>
              </div>
              <ScriptBlock>{renderedIntro}</ScriptBlock>
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleNext}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </WizardCard>
          )}

          {/* CONSENT */}
          {phase === 'consent' && (
            <WizardCard>
              <div className="text-center space-y-4 py-2">
                <h3 className="text-lg font-semibold">Did the caller agree to continue?</h3>
                <p className="text-muted-foreground text-sm">"May I ask you a few questions?"</p>
                <div className="flex gap-4 justify-center pt-2">
                  <Button size="lg" className="px-8 py-5 text-lg" onClick={() => handleConsent(true)}>
                    <ThumbsUp className="w-5 h-5 mr-2" /> Yes
                  </Button>
                  <Button size="lg" variant="outline" className="px-8 py-5 text-lg" onClick={() => handleConsent(false)}>
                    <ThumbsDown className="w-5 h-5 mr-2" /> No
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </div>
            </WizardCard>
          )}

          {/* QUESTION */}
          {phase === 'question' && currentQ && (
            <WizardCard>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Read aloud to the caller</span>
                {currentQ.is_internal && (
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 ml-auto">Internal</Badge>
                )}
              </div>

              {/* Question text */}
              <div className="bg-muted/50 rounded-xl p-5 border">
                <p className="text-lg font-medium leading-relaxed">{currentQ.question || currentQ.text}</p>
              </div>

              {/* Probing follow-ups */}
              {currentQ.probes && currentQ.probes.length > 0 && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-1 border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">▾ Probing follow-ups</p>
                  {currentQ.probes.map((probe, i) => (
                    <p key={i} className="text-sm text-muted-foreground pl-2">• {probe}</p>
                  ))}
                </div>
              )}

              {/* Response input */}
              <div className="space-y-3">
                {currentQ.type === 'yes_no' && (
                  <RadioGroup
                    value={(currentResponse as string) || ''}
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
                )}

                {/* Branch probes revealed after yes/no selection */}
                {currentQ.type === 'yes_no' && yesNoResponse && currentQ.branch && (
                  <div className="border-l-4 border-primary/40 pl-4 space-y-1.5 mt-1">
                    {yesNoResponse === 'yes' && currentQ.branch.yes_probes && currentQ.branch.yes_probes.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">✓ If YES — follow up with:</p>
                        {currentQ.branch.yes_probes.map((p, i) => (
                          <p key={i} className="text-sm text-muted-foreground">• {p}</p>
                        ))}
                      </>
                    )}
                    {yesNoResponse === 'no' && currentQ.branch.no_probes && currentQ.branch.no_probes.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">✗ If NO — follow up with:</p>
                        {currentQ.branch.no_probes.map((p, i) => (
                          <p key={i} className="text-sm text-muted-foreground">• {p}</p>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {currentQ.type === 'multiple_choice' && (
                  <RadioGroup
                    value={(currentResponse as string) || ''}
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

                {currentQ.type === 'scale' && (
                  <div className="space-y-3 px-1">
                    <Label className="text-sm font-medium">Response: <span className="text-primary font-bold">{(currentResponse as number) || 5}</span></Label>
                    <Slider
                      min={1} max={10} step={1}
                      value={[(currentResponse as number) || 5]}
                      onValueChange={([v]) => setResponses(prev => ({ ...prev, [questionIndex]: v }))}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 — Low</span><span>10 — High</span>
                    </div>
                  </div>
                )}

                {currentQ.type === 'open_ended' && (
                  <Textarea
                    placeholder="Quick notes (optional — AI extracts from recording)"
                    value={(currentResponse as string) || ''}
                    onChange={e => setResponses(prev => ({ ...prev, [questionIndex]: e.target.value }))}
                    rows={3}
                  />
                )}
              </div>

              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleNext}>
                  {questionIndex < sortedQuestions.length - 1 ? 'Next' : 'Finish'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </WizardCard>
          )}

          {/* CLOSING */}
          {phase === 'closing' && (
            <WizardCard>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Read closing script</span>
              </div>
              <ScriptBlock variant="green">{closingScript}</ScriptBlock>
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleNext}>Done <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </WizardCard>
          )}

          {/* REBUTTAL */}
          {phase === 'rebuttal' && (
            <WizardCard>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4" />
                <span>Read dismissal script</span>
              </div>
              <ScriptBlock variant="red">{rebuttalScript}</ScriptBlock>
              <Button className="w-full" onClick={handleNext}>
                End Call <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </WizardCard>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <WizardCard>
              <div className="text-center py-4 space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-lg font-semibold">Script Complete</h3>
                <p className="text-sm text-muted-foreground">You've walked through the full script flow.</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={restart}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Restart
                  </Button>
                </div>
              </div>
            </WizardCard>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center border-t">
        <p className="text-xs text-muted-foreground">PadSplit Operations · External View</p>
      </div>
    </div>
  );
}
