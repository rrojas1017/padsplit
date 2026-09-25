import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, XCircle, CheckCircle, Play, RotateCcw, PhoneOff } from 'lucide-react';
import { ProbingFollowUps } from '@/components/research/ProbingFollowUps';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import { useScriptTranslation, type SurveyLanguage } from '@/hooks/useScriptTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { resolveNextQuestionIndex } from '@/utils/scriptBranching';
import type { ScriptQuestion as CanonicalScriptQuestion } from '@/hooks/useResearchScripts';

interface ScriptQuestion {
  id?: number | string;
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
    scale_threshold?: number;
    scale_lte_goto?: number;
    scale_gt_goto?: number;
    option_gotos?: Record<string, number>;
  };
  scale_min?: number;
  scale_max?: number;
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
  intro_script_es: string | null;
  closing_script_es: string | null;
  rebuttal_script_es: string | null;
  questions_es: ScriptQuestion[] | null;
  translation_status: string | null;
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
    <div className="bg-card border border-border rounded-2xl shadow-lg p-8 space-y-6">
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
    <div className={`rounded-xl border p-6 ${styles[variant]}`}>
      <p className="text-lg leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}

export default function PublicScriptView() {
  const { token } = useParams<{ token: string }>();
  const [script, setScript] = useState<PublicScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('start');
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'start' && startedAtRef.current === null) startedAtRef.current = Date.now();
  }, [phase]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [visitedStack, setVisitedStack] = useState<number[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [probeNotes, setProbeNotes] = useState<Record<string, Record<number, string>>>({});
  const [agentNotes, setAgentNotes] = useState<Record<string, string>>({});
  const [endedEarly, setEndedEarly] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [earlyDisposition, setEarlyDisposition] = useState('');
  const [selectedEndDisposition, setSelectedEndDisposition] = useState('caller_hung_up');
  const [surveyLanguage, setSurveyLanguage] = useState<SurveyLanguage>('en');
  const [translatedContent, setTranslatedContent] = useState<{
    intro: string; closing: string; rebuttal: string; questions: ScriptQuestion[];
  } | null>(null);
  const { isTranslating, translateScript } = useScriptTranslation();

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

  const earlyEndDispositions = [
    { value: 'caller_hung_up', label: 'Caller Hung Up' },
    { value: 'caller_stopped', label: 'Caller Asked to Stop' },
    { value: 'other', label: 'Other' },
  ];

  const handleEndCall = (disposition: string) => {
    const label = earlyEndDispositions.find(d => d.value === disposition)?.label || disposition;
    setEarlyDisposition(label);
    setEndedEarly(true);
    setPhase('done'); // the done-phase effect sends the terminal save
  };

  // ---- Save queue (BUG-005) ----
  type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedAnswers, setLastSavedAnswers] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [terminalSaved, setTerminalSaved] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);

  // Snapshot of the latest committed state, read by queued sends.
  const snapshot = { responses, probeNotes, agentNotes, endedEarly, earlyDisposition, surveyLanguage, declined, submissionId };
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const saveSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<boolean | null>(null); // pending final flag
  const lastAttemptFinalRef = useRef(false);
  const savedJsonRef = useRef<string | null>(null);
  const terminalRequestedRef = useRef(false);
  const terminalSavedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const contentJson = (s: typeof snapshot) => JSON.stringify([s.responses, s.probeNotes, s.agentNotes]);

  const send = useCallback(async (final: boolean): Promise<void> => {
    if (!token) return;
    const s = snapshotRef.current;
    if (!s.submissionId) return;
    inFlightRef.current = true;
    lastAttemptFinalRef.current = final;
    saveSeqRef.current += 1;
    const json = contentJson(s);
    setSaveState('saving');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-public-script', {
        body: {
          token,
          responses: s.responses,
          probeNotes: s.probeNotes,
          agentNotes: s.agentNotes,
          endedEarly: !!s.endedEarly,
          earlyDisposition: s.endedEarly ? (s.earlyDisposition || null) : null,
          language: s.surveyLanguage,
          declined: s.declined,
          submission_id: s.submissionId,
          final,
          save_seq: saveSeqRef.current,
          durationSeconds: startedAtRef.current !== null
            ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
            : undefined,
        },
      });
      if (fnError) {
        let status = 0;
        let body: any = null;
        if (fnError instanceof FunctionsHttpError) {
          status = fnError.context.status;
          try { body = await fnError.context.json(); } catch { body = null; }
        }
        let reason = 'Server error';
        if (status === 429) reason = `Too many submissions from this office right now, retry in ${body?.retry_after ?? 60}s`;
        else if (status === 403 || status === 409) reason = body?.error || (status === 403 ? 'Access denied' : 'Submission expired');
        setLastError(reason);
        setSaveState('failed');
      } else {
        savedJsonRef.current = json;
        setLastSavedAt(new Date());
        setLastSavedAnswers(Number(data?.raw_answers_count ?? 0));
        setLastError(null);
        setSaveState('saved');
        if (final) { terminalSavedRef.current = true; setTerminalSaved(true); }
      }
    } catch {
      setLastError('Server error');
      setSaveState('failed');
    } finally {
      inFlightRef.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next !== null && !terminalSavedRef.current) void send(next);
    }
  }, [token]);

  const requestSave = useCallback((final: boolean) => {
    if (terminalSavedRef.current) return;
    if (inFlightRef.current) {
      pendingRef.current = final || pendingRef.current === true;
      return;
    }
    void send(final);
  }, [send]);

  // Trigger saves after state has been committed.
  const [saveTrigger, setSaveTrigger] = useState<{ n: number; final: boolean } | null>(null);
  const triggerSave = (final: boolean) => setSaveTrigger(p => ({ n: (p?.n ?? 0) + 1, final }));
  useEffect(() => {
    if (saveTrigger) requestSave(saveTrigger.final);
  }, [saveTrigger, requestSave]);

  // Terminal save when the flow reaches done (completion, End Call, or declined).
  useEffect(() => {
    if (phase === 'done' && !terminalRequestedRef.current) {
      terminalRequestedRef.current = true;
      triggerSave(true);
    }
  }, [phase]);

  const retrySave = () => requestSave(lastAttemptFinalRef.current);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === 'start') return;
      const dirty = savedJsonRef.current !== contentJson(snapshotRef.current);
      if (dirty || !terminalSavedRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const doRestart = useCallback(() => {
    setPhase('start');
    setQuestionIndex(0);
    setVisitedStack([]);
    setResponses({});
    setProbeNotes({});
    setAgentNotes({});
    setEndedEarly(false);
    setDeclined(false);
    setSubmissionId(null);
    setEarlyDisposition('');
    setSelectedEndDisposition('caller_hung_up');
    setSurveyLanguage('en');
    setTranslatedContent(null);
    setSaveState('idle');
    setLastSavedAt(null);
    setLastSavedAnswers(0);
    setLastError(null);
    setTerminalSaved(false);
    saveSeqRef.current = 0;
    pendingRef.current = null;
    lastAttemptFinalRef.current = false;
    savedJsonRef.current = null;
    terminalRequestedRef.current = false;
    terminalSavedRef.current = false;
    startedAtRef.current = null;
  }, []);

  const restart = () => {
    if (terminalSaved) doRestart();
    else setRestartConfirmOpen(true);
  };

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

  const sortedQuestions = translatedContent?.questions || [...(script.questions || [])].sort(
    (a, b) => Number(a.order ?? a.id ?? 0) - Number(b.order ?? b.id ?? 0)
  );

  // Stable response key: question id, else q_idx_<index in the original questions array>.
  const sourceQuestions: ScriptQuestion[] = translatedContent?.questions || script.questions || [];
  const stableKeyFor = (q: ScriptQuestion | undefined): string => {
    if (!q) return '';
    if (q.id !== undefined && q.id !== null && String(q.id).trim() !== '') return String(q.id);
    return `q_idx_${sourceQuestions.indexOf(q)}`;
  };

  const introScript = translatedContent?.intro ?? (script.intro_script || '');
  const rebuttalScript = translatedContent?.rebuttal ?? (script.rebuttal_script || '');
  const closingScript = translatedContent?.closing ?? (script.closing_script || '');
  const renderedIntro = introScript.replace(/\{agent_name\}/gi, 'Agent');

  const handleConsent = (agreed: boolean) => {
    if (agreed) {
      triggerSave(false);
      if (sortedQuestions.length > 0) { setPhase('question'); setQuestionIndex(0); }
      else if (closingScript) setPhase('closing');
      else setPhase('done');
    } else {
      setDeclined(true);
      if (rebuttalScript) setPhase('rebuttal');
      else setPhase('done');
    }
  };

  const handleNext = () => {
    if (phase === 'intro') setPhase('consent');
    else if (phase === 'question') {
      triggerSave(false);
      const currentQ = sortedQuestions[questionIndex] as unknown as CanonicalScriptQuestion;
      const resolved = resolveNextQuestionIndex({
        currentIndex: questionIndex,
        question: currentQ,
        answer: responses[stableKeyFor(sortedQuestions[questionIndex])],
        questionsLength: sortedQuestions.length,
      });
      if (resolved === 'closing') {
        if (closingScript) setPhase('closing');
        else setPhase('done');
      } else {
        setVisitedStack(prev => [...prev, questionIndex]);
        setQuestionIndex(resolved);
      }
    } else if (phase === 'closing' || phase === 'rebuttal') setPhase('done');
  };

  const popVisited = (): number | null => {
    if (visitedStack.length === 0) return null;
    const prev = visitedStack[visitedStack.length - 1];
    setVisitedStack(s => s.slice(0, -1));
    return prev;
  };

  const handleBack = () => {
    if (phase === 'question') {
      const prev = popVisited();
      if (prev !== null) { setQuestionIndex(prev); return; }
      if (questionIndex > 0) { setQuestionIndex(p => p - 1); return; }
      setPhase('consent');
    }
    else if (phase === 'consent') { if (introScript) setPhase('intro'); else setPhase('start'); }
    else if (phase === 'intro') setPhase('start');
    else if (phase === 'closing') {
      const prev = popVisited();
      if (prev !== null) { setPhase('question'); setQuestionIndex(prev); return; }
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
  const currentKey = stableKeyFor(currentQ);
  const currentResponse = responses[currentKey];
  const yesNoResponse = currentQ?.type === 'yes_no' ? (currentResponse as string) : undefined;

  const saveBanner = phase !== 'start' && (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
      saveState === 'failed' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'bg-muted/40 text-muted-foreground')}
      aria-live="polite">
      <span>
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && lastSavedAt && `Saved ${lastSavedAt.toLocaleTimeString()} · ${lastSavedAnswers} answer${lastSavedAnswers === 1 ? '' : 's'}`}
        {saveState === 'failed' && `Not saved — ${lastError ?? 'Server error'}`}
        {saveState === 'idle' && 'Not saved yet'}
      </span>
      {saveState === 'failed' && (
        <Button size="sm" variant="outline" className="h-7" onClick={retrySave}>Retry</Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
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
        <div className="w-full max-w-3xl space-y-6">

          {/* Progress bar + End Call */}
          {phase !== 'start' && phase !== 'done' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>
                  {phase === 'intro' ? 'Introduction'
                    : phase === 'consent' ? 'Consent'
                    : phase === 'question' ? `Question ${questionIndex + 1} of ${sortedQuestions.length}`
                    : phase === 'closing' ? 'Closing'
                    : 'Rebuttal'}
                </span>
                <div className="flex items-center gap-2">
                  <span>{Math.round(progressPercent)}%</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="h-6 px-2 text-xs gap-1">
                        <PhoneOff className="w-3 h-3" /> End Call
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>End Call Early</AlertDialogTitle>
                        <AlertDialogDescription>
                          Select the reason for ending the call.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2 py-2">
                        {earlyEndDispositions.map(d => (
                          <label
                            key={d.value}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                              selectedEndDisposition === d.value
                                ? 'border-destructive bg-destructive/5'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <input
                              type="radio"
                              name="pub-end-disposition"
                              value={d.value}
                              checked={selectedEndDisposition === d.value}
                              onChange={() => setSelectedEndDisposition(d.value)}
                              className="accent-destructive"
                            />
                            <span className="text-sm font-medium">{d.label}</span>
                          </label>
                        ))}
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => handleEndCall(selectedEndDisposition)}
                        >
                          End Call
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {saveBanner}

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
                <div className="flex justify-center">
                  <div className="w-48">
                    <Label className="text-xs text-muted-foreground">Language</Label>
                    <Select value={surveyLanguage} onValueChange={(v) => setSurveyLanguage(v as SurveyLanguage)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="lg" disabled={isTranslating} onClick={async () => {
                  if (surveyLanguage === 'es') {
                    // Use pre-translated content if available
                    if (script.translation_status === 'completed' && script.questions_es) {
                      setTranslatedContent({
                        intro: script.intro_script_es || '',
                        closing: script.closing_script_es || '',
                        rebuttal: script.rebuttal_script_es || '',
                        questions: script.questions_es,
                      });
                    } else {
                      // Fallback: translate on-the-fly
                      const result = await translateScript(script, 'es', token);
                      if (result) {
                        setTranslatedContent({
                          intro: result.intro,
                          closing: result.closing,
                          rebuttal: result.rebuttal,
                          questions: result.questions as ScriptQuestion[],
                        });
                      }
                    }
                  }
                  setSubmissionId(crypto.randomUUID());
                  setPhase(introScript ? 'intro' : 'consent');
                }}>
                  {isTranslating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Translating…
                    </>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" /> Begin Script</>
                  )}
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
              <div className="bg-muted/50 rounded-xl p-6 py-7 border">
                <p className="text-xl font-medium leading-relaxed">{currentQ.question || currentQ.text}</p>
              </div>

              {/* Probing follow-ups */}
              {currentQ.probes && currentQ.probes.length > 0 && (
                <ProbingFollowUps
                  probes={currentQ.probes}
                  probeNotes={probeNotes[String(questionIndex)]}
                  onProbeNoteChange={(idx, note) => setProbeNotes(prev => ({
                    ...prev,
                    [String(questionIndex)]: { ...(prev[String(questionIndex)] || {}), [idx]: note }
                  }))}
                />
              )}

              {/* Response input */}
              <div className="space-y-3">
                {currentQ.type === 'yes_no' && (
                  <RadioGroup
                    value={(currentResponse as string) || ''}
                    onValueChange={v => setResponses(prev => ({ ...prev, [currentKey]: v }))}
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
                  <div className="space-y-2 mt-1">
                    {yesNoResponse === 'yes' && currentQ.branch.yes_probes && currentQ.branch.yes_probes.length > 0 && (
                      <ProbingFollowUps
                        probes={currentQ.branch.yes_probes}
                        label="YES follow-ups"
                        variant="branch-yes"
                        probeNotes={probeNotes[`${questionIndex}_yes`]}
                        onProbeNoteChange={(idx, note) => setProbeNotes(prev => ({
                          ...prev,
                          [`${questionIndex}_yes`]: { ...(prev[`${questionIndex}_yes`] || {}), [idx]: note }
                        }))}
                      />
                    )}
                    {yesNoResponse === 'no' && currentQ.branch.no_probes && currentQ.branch.no_probes.length > 0 && (
                      <ProbingFollowUps
                        probes={currentQ.branch.no_probes}
                        label="NO follow-ups"
                        variant="branch-no"
                        probeNotes={probeNotes[`${questionIndex}_no`]}
                        onProbeNoteChange={(idx, note) => setProbeNotes(prev => ({
                          ...prev,
                          [`${questionIndex}_no`]: { ...(prev[`${questionIndex}_no`] || {}), [idx]: note }
                        }))}
                      />
                    )}
                  </div>
                )}

                {currentQ.type === 'multiple_choice' && (
                  <RadioGroup
                    value={(currentResponse as string) || ''}
                    onValueChange={v => setResponses(prev => ({ ...prev, [currentKey]: v }))}
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

                {currentQ.type === 'scale' && (() => {
                  const sMin = (currentQ as any).scale_min ?? 1;
                  const sMax = (currentQ as any).scale_max ?? 10;
                  const raw = (currentResponse as number);
                  const val = typeof raw === 'number' ? Math.min(Math.max(raw, sMin), sMax) : sMin;
                  return (
                  <div className="space-y-3 px-1">
                    <Label className="text-sm font-medium">Response: <span className="text-primary font-bold">{val}</span></Label>
                    <Slider
                      min={sMin} max={sMax} step={1}
                      value={[val]}
                      onValueChange={([v]) => setResponses(prev => ({ ...prev, [currentKey]: v }))}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{sMin} — Low</span><span>{sMax} — High</span>
                    </div>
                  </div>
                  );
                })()}

                {currentQ.type === 'open_ended' && (
                  <Textarea
                    placeholder="Quick notes (optional — AI extracts from recording)"
                    value={(currentResponse as string) || ''}
                    onChange={e => setResponses(prev => ({ ...prev, [currentKey]: e.target.value }))}
                    rows={4}
                  />
                )}
              </div>

              {/* Agent notes for this question */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  📝 Agent Notes
                </label>
                <Textarea
                  placeholder="Capture additional context, verbatim quotes, or observations..."
                  className="min-h-[60px] text-sm bg-background"
                  value={agentNotes[String(questionIndex)] || ''}
                  onChange={(e) => setAgentNotes(prev => ({ ...prev, [String(questionIndex)]: e.target.value }))}
                />
              </div>

              {currentQ.type === 'yes_no' && currentResponse === undefined && (
                <p className="text-xs text-center text-destructive font-medium">
                  A Yes or No response is required to determine next steps.
                </p>
              )}

              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button
                  onClick={handleNext}
                  disabled={currentQ.type === 'yes_no' && currentResponse === undefined}
                >
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
                {endedEarly ? (
                  <>
                    <PhoneOff className="w-12 h-12 mx-auto text-destructive" />
                    <h3 className="text-lg font-semibold">Call Ended Early</h3>
                    <p className="text-sm text-muted-foreground">
                      Disposition: <span className="font-medium text-foreground">{earlyDisposition}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-12 h-12 mx-auto text-primary" />
                    <h3 className="text-lg font-semibold">Script Complete</h3>
                    <p className="text-sm text-muted-foreground">You've walked through the full script flow.</p>
                  </>
                )}
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
