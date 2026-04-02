import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useResearchCalls, type ScriptQuestion, type CallSubmission } from '@/hooks/useResearchCalls';
import { useAuth } from '@/contexts/AuthContext';
import { useScriptTranslation, type SurveyLanguage } from '@/hooks/useScriptTranslation';
import { SectionJumpNavigator } from '@/components/research/SectionJumpNavigator';
import { ProbingFollowUps } from '@/components/research/ProbingFollowUps';
import {
  CheckCircle, Phone, ArrowRight, ArrowLeft, MessageSquare,
  XCircle, ThumbsUp, ThumbsDown, User, GitBranch, PhoneOff, Clock
} from 'lucide-react';
import { StepTracker, buildSteps } from '@/components/research/StepTracker';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function autoCapitalizeName(value: string): string {
  return value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length === 0) return '';
  if (local.length <= 3) return `+1 ${local}`;
  if (local.length <= 6) return `+1 ${local.slice(0, 3)}-${local.slice(3)}`;
  return `+1 ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6, 10)}`;
}

const callerTypes = [
  { value: 'existing_member', label: 'Existing Member' },
  { value: 'former_booking', label: 'Former Booking' },
  { value: 'rejected_lead', label: 'Rejected Lead' },
];

const callerStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'churned', label: 'Churned' },
  { value: 'prospect', label: 'Prospect' },
];

const outcomeOptions = [
  { value: 'completed', label: 'Completed' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'refused', label: 'Refused' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'caller_hung_up', label: 'Caller Hung Up' },
  { value: 'caller_stopped', label: 'Caller Asked to Stop' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'technical_issue', label: 'Technical Issue' },
];

const earlyEndDispositions = [
  { value: 'caller_hung_up', label: 'Caller Hung Up' },
  { value: 'caller_stopped', label: 'Caller Asked to Stop' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'technical_issue', label: 'Technical Issue' },
];

type WizardPhase = 'setup' | 'verify' | 'intro' | 'consent' | 'question' | 'rebuttal' | 'closing' | 'wrapup';

function CallTimer({ elapsedSeconds }: { elapsedSeconds: number }) {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const display = `${mins}:${String(secs).padStart(2, '0')}`;
  const colorClass =
    elapsedSeconds >= 660 ? 'text-destructive' :
    elapsedSeconds >= 540 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-green-600 dark:text-green-400';
  return (
    <div className={`flex items-center gap-1 text-xs font-mono font-semibold shrink-0 ${colorClass}`}>
      <Clock className="w-3 h-3" />
      <span>{display}</span>
      <span className="text-muted-foreground font-normal">/ 10:00</span>
    </div>
  );
}

// Derive unique sections from questions array
function deriveSections(questions: ScriptQuestion[]) {
  const sections: { name: string; firstQuestionIndex: number }[] = [];
  const seen = new Set<string>();
  questions.forEach((q, idx) => {
    const sectionName = q.section || 'Questions';
    if (!seen.has(sectionName)) {
      seen.add(sectionName);
      sections.push({ name: sectionName, firstQuestionIndex: idx });
    }
  });
  return sections;
}

export default function LogSurveyCall() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { myCampaigns, isLoading, isSubmitting, submitCall } = useResearchCalls();
  const { user } = useAuth();
  const { isTranslating, translateScript } = useScriptTranslation();

  // Setup fields
  const [campaignId, setCampaignId] = useState(searchParams.get('campaign') || '');
  const [surveyLanguage, setSurveyLanguage] = useState<SurveyLanguage>('en');
  const [callerFirstName, setCallerFirstName] = useState('');
  const [callerLastName, setCallerLastName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [callerType, setCallerType] = useState('');
  const [callerStatus, setCallerStatus] = useState('');

  // Wizard state
  const [phase, setPhase] = useState<WizardPhase>('setup');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [consent, setConsent] = useState<boolean | null>(null);

  // Verify phase state
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [nameConfirmed, setNameConfirmed] = useState<boolean | null>(null);
  const [correctedFirstName, setCorrectedFirstName] = useState('');
  const [correctedLastName, setCorrectedLastName] = useState('');

  // Branch state: after yes/no answer, show branch probes before auto-advancing
  const [pendingBranchAnswer, setPendingBranchAnswer] = useState<boolean | null>(null);
  const [branchProbesShown, setBranchProbesShown] = useState(false);

  // Visited questions for section navigator
  const [visitedIndices, setVisitedIndices] = useState<Set<number>>(new Set());

  // Wrapup fields
  const [callOutcome, setCallOutcome] = useState('');
  const [callDurationMinutes, setCallDurationMinutes] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [researcherNotes, setResearcherNotes] = useState('');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [probeNotes, setProbeNotes] = useState<Record<string, Record<number, string>>>({});
  const [agentNotes, setAgentNotes] = useState<Record<string, string>>({});

  const setProbeNote = (qId: number, probeIndex: number, note: string) => {
    setProbeNotes(prev => ({
      ...prev,
      [String(qId)]: { ...(prev[String(qId)] || {}), [probeIndex]: note }
    }));
  };

  const setAgentNote = (qId: number, note: string) => {
    setAgentNotes(prev => ({ ...prev, [String(qId)]: note }));
  };

  // End Call dialog
  const [endCallDialogOpen, setEndCallDialogOpen] = useState(false);
  const [selectedEndDisposition, setSelectedEndDisposition] = useState('caller_hung_up');

  // Call timer
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [submitted, setSubmitted] = useState(false);
  const [setupErrors, setSetupErrors] = useState<Record<string, string>>({});

  const activeCampaigns = useMemo(
    () => myCampaigns.filter(c => c.status === 'active'),
    [myCampaigns]
  );

  const selectedCampaign = useMemo(
    () => activeCampaigns.find(c => c.id === campaignId),
    [activeCampaigns, campaignId]
  );

  // Translated content (overrides original when Spanish selected)
  const [translatedContent, setTranslatedContent] = useState<{
    intro: string; closing: string; rebuttal: string; questions: ScriptQuestion[];
  } | null>(null);

  const questions: ScriptQuestion[] = useMemo(
    () => translatedContent?.questions || selectedCampaign?.script?.questions || [],
    [selectedCampaign, translatedContent]
  );
  const introScript = translatedContent?.intro ?? (selectedCampaign?.script?.intro_script || '');
  const rebuttalScript = translatedContent?.rebuttal ?? (selectedCampaign?.script?.rebuttal_script || '');
  const closingScript = translatedContent?.closing ?? (selectedCampaign?.script?.closing_script || '');

  const agentName = user?.name || 'Researcher';
  const renderedIntro = introScript.replace(/\{agent_name\}/gi, agentName);

  const sections = useMemo(() => deriveSections(questions), [questions]);

  // Reset branch state when question changes
  useEffect(() => {
    setPendingBranchAnswer(null);
    setBranchProbesShown(false);
  }, [questionIndex]);

  useEffect(() => {
    const param = searchParams.get('campaign');
    if (param && activeCampaigns.some(c => c.id === param)) {
      setCampaignId(param);
    }
  }, [searchParams, activeCampaigns]);

  // Call timer interval
  useEffect(() => {
    if (!callStartTime || phase === 'wrapup' || phase === 'setup') return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - callStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartTime, phase]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (phase === 'intro' || phase === 'closing' || phase === 'rebuttal') {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, questionIndex, questions.length]);

  const setResponse = (qId: number, value: unknown) => {
    setResponses(prev => ({ ...prev, [String(qId)]: value }));
  };

  const validateSetup = (): boolean => {
    const errs: Record<string, string> = {};
    if (!campaignId) errs.campaign = 'Select a campaign';
    if (!callerFirstName.trim()) errs.callerFirstName = 'First name is required';
    if (!callerLastName.trim()) errs.callerLastName = 'Last name is required';
    if (!callerPhone.trim()) errs.callerPhone = 'Phone number is required';
    if (!callerType) errs.callerType = 'Select caller type';
    setSetupErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStartScript = async () => {
    if (!validateSetup()) return;

    // Use pre-translated content if available; fall back to on-the-fly translation
    if (surveyLanguage === 'es' && selectedCampaign?.script) {
      const script = selectedCampaign.script;
      if (script.translation_status === 'completed' && script.questions_es) {
        // Instant switch — use stored translations
        setTranslatedContent({
          intro: script.intro_script_es || '',
          closing: script.closing_script_es || '',
          rebuttal: script.rebuttal_script_es || '',
          questions: script.questions_es as ScriptQuestion[],
        });
      } else {
        // Fallback: translate on-the-fly
        const result = await translateScript(script, 'es');
        if (result) {
          setTranslatedContent({
            intro: result.intro,
            closing: result.closing,
            rebuttal: result.rebuttal,
            questions: result.questions as ScriptQuestion[],
          });
        }
      }
    } else {
      setTranslatedContent(null);
    }

    setVerifiedPhone(callerPhone);
    setNameConfirmed(null);
    setCorrectedFirstName('');
    setCorrectedLastName('');
    setCallStartTime(new Date());
    setElapsedSeconds(0);
    setPhase('verify');
  };

  const handleVerifyConfirm = () => {
    if (introScript) {
      setPhase('intro');
    } else {
      setPhase('consent');
    }
  };

  const handleConsent = (agreed: boolean) => {
    setConsent(agreed);
    if (agreed) {
      if (questions.length > 0) {
        setPhase('question');
        setQuestionIndex(0);
      } else if (closingScript) {
        setPhase('closing');
      } else {
        setPhase('wrapup');
      }
    } else {
      setCallOutcome('refused');
      if (rebuttalScript) {
        setPhase('rebuttal');
      } else {
        setPhase('wrapup');
      }
    }
  };

  const handleEndCall = (disposition: string) => {
    setCallOutcome(disposition);
    setPhase('wrapup');
    setEndCallDialogOpen(false);
  };

  // Branch-aware navigation: find next question index based on answer
  const getNextQuestionIndex = useCallback((fromIndex: number, answer?: unknown): number => {
    const q = questions[fromIndex];
    if (q?.type === 'yes_no' && q.branch) {
      const isYes = answer === true;
      const goto = isYes ? q.branch.yes_goto : q.branch.no_goto;
      if (goto !== undefined) {
        // Find question by order number
        const targetIdx = questions.findIndex(sq => (sq.order ?? sq.id) === goto);
        if (targetIdx !== -1) return targetIdx;
      }
    }
    return fromIndex + 1;
  }, [questions]);

  const advanceQuestion = useCallback((fromIndex: number) => {
    const q = questions[fromIndex];
    const currentAnswer = responses[String(q?.id)];
    const nextIdx = getNextQuestionIndex(fromIndex, currentAnswer);

    setVisitedIndices(prev => new Set([...prev, fromIndex]));

    if (nextIdx < questions.length) {
      setQuestionIndex(nextIdx);
    } else if (closingScript) {
      setPhase('closing');
    } else {
      setPhase('wrapup');
    }
  }, [questions, responses, getNextQuestionIndex, closingScript]);

  const handleNext = useCallback(() => {
    if (phase === 'intro') {
      setPhase('consent');
    } else if (phase === 'question') {
      const q = questions[questionIndex];
      // If yes_no question with branch probes, show them first
      if (
        q?.type === 'yes_no' &&
        q.branch &&
        pendingBranchAnswer === null &&
        responses[String(q.id)] !== undefined
      ) {
        const answer = responses[String(q.id)] as boolean;
        const hasProbes =
          (answer && (q.branch.yes_probes?.length ?? 0) > 0) ||
          (!answer && (q.branch.no_probes?.length ?? 0) > 0);
        if (hasProbes && !branchProbesShown) {
          setPendingBranchAnswer(answer);
          setBranchProbesShown(true);
          return;
        }
      }
      advanceQuestion(questionIndex);
    } else if (phase === 'closing' || phase === 'rebuttal') {
      setPhase('wrapup');
    }
  }, [phase, questionIndex, questions, responses, pendingBranchAnswer, branchProbesShown, advanceQuestion]);

  const handleBack = () => {
    if (phase === 'question' && questionIndex > 0) {
      // Walk back to previous visited index
      const prevVisited = Math.max(...[...visitedIndices].filter(i => i < questionIndex), -1);
      if (prevVisited >= 0) setQuestionIndex(prevVisited);
      else setQuestionIndex(questionIndex - 1);
    } else if (phase === 'question' && questionIndex === 0) {
      setPhase('consent');
    } else if (phase === 'consent') {
      if (introScript) setPhase('intro');
      else setPhase('verify');
    } else if (phase === 'intro') {
      setPhase('verify');
    } else if (phase === 'verify') {
      setPhase('setup');
    } else if (phase === 'closing') {
      if (questions.length > 0) {
        setPhase('question');
        setQuestionIndex(questions.length - 1);
      } else {
        setPhase('consent');
      }
    }
  };

  const handleJumpToSection = (firstQuestionIndex: number) => {
    setQuestionIndex(firstQuestionIndex);
    setPendingBranchAnswer(null);
    setBranchProbesShown(false);
  };

  const handleSubmit = async () => {
    if (!callOutcome) return;

    const callerName = `${callerFirstName.trim()} ${callerLastName.trim()}`.trim();

    const submission: CallSubmission = {
      campaign_id: campaignId,
      caller_name: callerName,
      caller_first_name: callerFirstName.trim(),
      caller_last_name: callerLastName.trim(),
      caller_phone: verifiedPhone.trim() || callerPhone.trim() || undefined,
      caller_type: callerType,
      caller_status: callerStatus || undefined,
      call_outcome: callOutcome,
      call_duration_seconds: callDurationMinutes ? Math.round(parseFloat(callDurationMinutes) * 60) : undefined,
      transfer_notes: callOutcome === 'transferred' ? transferNotes : undefined,
      responses: Object.keys(responses).length > 0 ? responses : undefined,
      probe_notes: Object.keys(probeNotes).length > 0 ? probeNotes : undefined,
      agent_notes: Object.keys(agentNotes).length > 0 ? agentNotes : undefined,
      researcher_notes: researcherNotes.trim() || undefined,
      researcher_name: agentName,
      language: surveyLanguage,
    };

    const success = await submitCall(submission);
    if (success) setSubmitted(true);
  };

  const resetForm = () => {
    setCallerFirstName('');
    setCallerLastName('');
    setCallerPhone('');
    setCallerType('');
    setCallerStatus('');
    setCallOutcome('');
    setCallDurationMinutes('');
    setTransferNotes('');
    setResearcherNotes('');
    setResponses({});
    setSetupErrors({});
    setSubmitted(false);
    setPhase('setup');
    setQuestionIndex(0);
    setConsent(null);
    setPendingBranchAnswer(null);
    setBranchProbesShown(false);
    setVisitedIndices(new Set());
    setVerifiedPhone('');
    setNameConfirmed(null);
    setCorrectedFirstName('');
    setCorrectedLastName('');
    setCallStartTime(null);
    setElapsedSeconds(0);
    setSurveyLanguage('en');
    setTranslatedContent(null);
  };

  const currentQ = questions[questionIndex];
  const showSectionNav = phase === 'question' && sections.length > 1;

  if (submitted) {
    return (
      <ResearchLayout title="Call Logged" subtitle="Survey call recorded successfully">
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-primary" />
            <h3 className="text-xl font-semibold">Call Submitted!</h3>
            <p className="text-muted-foreground">Your survey call has been recorded.</p>
            <div className="flex gap-3 justify-center pt-4">
              <Button onClick={resetForm}><Phone className="h-4 w-4 mr-2" /> Log Another Call</Button>
              <Button variant="outline" onClick={() => navigate('/research/my-history')}>View History</Button>
            </div>
          </CardContent>
        </Card>
      </ResearchLayout>
    );
  }

  return (
    <ResearchLayout title="Log Survey Call" subtitle="Record a new research interview">
      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {/* Step Tracker */}
          {phase !== 'setup' && phase !== 'wrapup' && (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <StepTracker
                    steps={buildSteps({
                      hasVerify: true,
                      hasIntro: !!introScript,
                      hasClosing: !!closingScript,
                      questions,
                      phase,
                      questionIndex,
                    })}
                    totalQuestions={questions.length}
                    activeQuestionIndex={questionIndex}
                    onEndCall={phase !== 'verify' ? () => setEndCallDialogOpen(true) : undefined}
                  />
                </div>
                {callStartTime && <CallTimer elapsedSeconds={elapsedSeconds} />}
              </div>
            </div>
          )}

          {/* End Call AlertDialog */}
          <AlertDialog open={endCallDialogOpen} onOpenChange={setEndCallDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End Call Early</AlertDialogTitle>
                <AlertDialogDescription>
                  Select the reason for ending the call. Partial responses collected so far will be saved.
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
                      name="end-disposition"
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

          {/* Main layout: question phase with optional side navigator */}
          <div className={cn(
            'flex gap-4',
            showSectionNav ? 'items-start' : 'justify-center'
          )}>
            {/* Section jump navigator - left column on question phase */}
            {showSectionNav && (
              <SectionJumpNavigator
                sections={sections}
                currentQuestionIndex={questionIndex}
                visitedQuestionIndices={visitedIndices}
                onJump={handleJumpToSection}
              />
            )}

            {/* Main card */}
            <div className={cn('flex-1', !showSectionNav && 'max-w-2xl')}>

              {/* SETUP PHASE */}
              {phase === 'setup' && (
                <Card>
                  <CardContent className="p-6 space-y-5">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">Call Setup</h2>
                      <p className="text-sm text-muted-foreground">Select your campaign and enter caller details</p>
                    </div>

                    {/* Researcher badge */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border text-sm">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Researcher:</span>
                      <span className="font-medium text-foreground">{agentName}</span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>Campaign *</Label>
                        <Select value={campaignId} onValueChange={setCampaignId}>
                          <SelectTrigger className={setupErrors.campaign ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Select a campaign" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeCampaigns.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {setupErrors.campaign && <p className="text-sm text-destructive mt-1">{setupErrors.campaign}</p>}
                        {activeCampaigns.length === 0 && (
                          <p className="text-sm text-muted-foreground mt-2">No active campaigns assigned to you.</p>
                        )}
                      </div>

                      {/* Split name fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name *</Label>
                            <Input
                              value={callerFirstName}
                              onChange={e => setCallerFirstName(autoCapitalizeName(e.target.value))}
                              className={setupErrors.callerFirstName ? 'border-destructive' : ''}
                              placeholder="First name"
                          />
                          {setupErrors.callerFirstName && (
                            <p className="text-sm text-destructive mt-1">{setupErrors.callerFirstName}</p>
                          )}
                        </div>
                        <div>
                          <Label>Last Name *</Label>
                            <Input
                              value={callerLastName}
                              onChange={e => setCallerLastName(autoCapitalizeName(e.target.value))}
                              className={setupErrors.callerLastName ? 'border-destructive' : ''}
                              placeholder="Last name"
                          />
                          {setupErrors.callerLastName && (
                            <p className="text-sm text-destructive mt-1">{setupErrors.callerLastName}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label>Phone Number *</Label>
                        <Input
                          value={callerPhone}
                          onChange={e => setCallerPhone(formatPhone(e.target.value))}
                          className={setupErrors.callerPhone ? 'border-destructive' : ''}
                          placeholder="+1 305-433-2275"
                        />
                        {setupErrors.callerPhone && (
                          <p className="text-sm text-destructive mt-1">{setupErrors.callerPhone}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Caller Type *</Label>
                          <Select value={callerType} onValueChange={setCallerType}>
                            <SelectTrigger className={setupErrors.callerType ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {callerTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {setupErrors.callerType && <p className="text-sm text-destructive mt-1">{setupErrors.callerType}</p>}
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select value={callerStatus} onValueChange={setCallerStatus}>
                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            <SelectContent>
                              {callerStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Language selector */}
                    <div>
                      <Label>Language</Label>
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

                    <Button className="w-full" size="lg" onClick={handleStartScript} disabled={activeCampaigns.length === 0 || isTranslating}>
                      {isTranslating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                          Translating script…
                        </>
                      ) : (
                        <>Start Script <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* VERIFY PHASE */}
              {phase === 'verify' && (
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>Confirm Contact Details</span>
                    </div>

                    {/* Name read-back prompt */}
                    <div className="bg-muted/50 rounded-xl p-5 border">
                      <p className="text-lg leading-relaxed font-medium">
                        "Am I speaking with{' '}
                        <span className="text-primary">
                          {nameConfirmed === false && (correctedFirstName || correctedLastName)
                            ? `${correctedFirstName} ${correctedLastName}`.trim()
                            : `${callerFirstName} ${callerLastName}`.trim()}
                        </span>?"
                      </p>
                    </div>

                    {/* Name confirmation */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Name confirmed?</Label>
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          variant={nameConfirmed === true ? 'default' : 'outline'}
                          onClick={() => setNameConfirmed(true)}
                          className="gap-1.5"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Yes
                        </Button>
                        <Button
                          size="sm"
                          variant={nameConfirmed === false ? 'destructive' : 'outline'}
                          onClick={() => setNameConfirmed(false)}
                          className="gap-1.5"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> No — correct it
                        </Button>
                      </div>

                      {nameConfirmed === false && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <Label className="text-xs text-muted-foreground">Corrected First Name</Label>
                            <Input
                              value={correctedFirstName}
                              onChange={e => setCorrectedFirstName(autoCapitalizeName(e.target.value))}
                              placeholder={callerFirstName}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Corrected Last Name</Label>
                            <Input
                              value={correctedLastName}
                              onChange={e => setCorrectedLastName(autoCapitalizeName(e.target.value))}
                              placeholder={callerLastName}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Callback number */}
                    <div className="space-y-2">
                      <Label>Callback Number</Label>
                      <Input
                        value={verifiedPhone}
                        onChange={e => setVerifiedPhone(formatPhone(e.target.value))}
                        placeholder="+1 305-433-2275"
                      />
                      <p className="text-xs text-muted-foreground">
                        "In case the call gets cut, what's the best number to reach you back at?"
                      </p>
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button size="lg" onClick={handleVerifyConfirm}>
                        Confirmed — Start Script <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* INTRO PHASE */}
              {phase === 'intro' && (
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      <span>Read aloud to the caller</span>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-6 border">
                      <p className="text-lg leading-relaxed whitespace-pre-wrap">{renderedIntro}</p>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button size="lg" onClick={handleNext}>
                        Next <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CONSENT PHASE */}
              {phase === 'consent' && (
                <Card>
                  <CardContent className="p-8 space-y-6 text-center">
                    <h2 className="text-xl font-semibold">Did the caller agree to continue?</h2>
                    <p className="text-muted-foreground">"May I ask you a few questions?"</p>
                    <div className="flex gap-4 justify-center pt-4">
                      <Button size="lg" className="px-10 py-6 text-lg" onClick={() => handleConsent(true)}>
                        <ThumbsUp className="w-5 h-5 mr-2" /> Yes
                      </Button>
                      <Button size="lg" variant="outline" className="px-10 py-6 text-lg" onClick={() => handleConsent(false)}>
                        <ThumbsDown className="w-5 h-5 mr-2" /> No
                      </Button>
                    </div>
                    <div className="pt-2">
                      <Button variant="ghost" size="sm" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* REBUTTAL PHASE */}
              {phase === 'rebuttal' && (
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <XCircle className="w-4 h-4" />
                      <span>Read the dismissal script</span>
                    </div>
                    <div className="bg-destructive/5 rounded-xl p-6 border border-destructive/20">
                      <p className="text-lg leading-relaxed whitespace-pre-wrap">
                        {rebuttalScript || "I understand. Thank you for your time. Have a great day!"}
                      </p>
                    </div>
                    <Button className="w-full" size="lg" onClick={handleNext}>
                      End Call & Wrap Up <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* QUESTION PHASE */}
              {phase === 'question' && currentQ && (
                <Card>
                  <CardContent className="p-8 space-y-6">
                    {/* Section label */}
                    {currentQ.section && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {currentQ.section}
                        </Badge>
                        {currentQ.is_internal && (
                          <Badge variant="secondary" className="text-xs">Internal</Badge>
                        )}
                      </div>
                    )}

                    <div className={cn(
                      'flex items-center gap-2 text-sm',
                      currentQ.is_internal ? 'text-warning' : 'text-muted-foreground'
                    )}>
                      <MessageSquare className="w-4 h-4" />
                      <span>{currentQ.is_internal ? 'Internal classification — do not read aloud' : 'Read aloud to the caller'}</span>
                    </div>

                    <div className={cn(
                      'rounded-xl p-6 border',
                      currentQ.is_internal
                        ? 'bg-muted border-muted-foreground/20'
                        : 'bg-muted/50'
                    )}>
                      <p className="text-xl font-medium leading-relaxed">{currentQ.text}</p>
                    </div>

                    {/* Probing follow-ups (general) */}
                    {currentQ.probes && currentQ.probes.length > 0 && pendingBranchAnswer === null && (
                      <ProbingFollowUps
                        probes={currentQ.probes}
                        probeNotes={probeNotes[String(currentQ.id)]}
                        onProbeNoteChange={(idx, note) => setProbeNote(currentQ.id, idx, note)}
                      />
                    )}

                    {/* Answer input */}
                    {pendingBranchAnswer === null && (
                      <QuestionInput
                        question={currentQ}
                        value={responses[String(currentQ.id)]}
                        onChange={(val) => setResponse(currentQ.id, val)}
                        onBranchSelect={(answer) => {
                          setResponse(currentQ.id, answer);
                        }}
                      />
                    )}

                    {/* Branch probes revealed after yes/no selection */}
                    {pendingBranchAnswer !== null && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            {pendingBranchAnswer ? 'YES path — follow-up prompts' : 'NO path — follow-up prompts'}
                          </span>
                        </div>
                        {pendingBranchAnswer
                          ? currentQ.branch?.yes_probes && (
                            <ProbingFollowUps
                              probes={currentQ.branch.yes_probes}
                              label="YES follow-ups"
                              variant="branch-yes"
                              probeNotes={probeNotes[`${currentQ.id}_yes`]}
                              onProbeNoteChange={(idx, note) => setProbeNote(currentQ.id, idx, note)}
                            />
                          )
                          : currentQ.branch?.no_probes && (
                            <ProbingFollowUps
                              probes={currentQ.branch.no_probes}
                              label="NO follow-ups"
                              variant="branch-no"
                              probeNotes={probeNotes[`${currentQ.id}_no`]}
                              onProbeNoteChange={(idx, note) => setProbeNote(currentQ.id, idx, note)}
                            />
                          )
                        }
                      </div>
                    )}

                    {/* Agent notes for this question */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        📝 Agent Notes
                      </label>
                      <Textarea
                        placeholder="Capture additional context, verbatim quotes, or observations..."
                        className="min-h-[60px] text-sm bg-background"
                        value={agentNotes[String(currentQ.id)] || ''}
                        onChange={(e) => setAgentNote(currentQ.id, e.target.value)}
                      />
                    </div>

                    {/* Required hint for yes_no */}
                    {currentQ.type === 'yes_no' && responses[String(currentQ.id)] === undefined && pendingBranchAnswer === null && (
                      <p className="text-xs text-center text-destructive font-medium">
                        A Yes or No response is required to determine next steps.
                      </p>
                    )}

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={
                          currentQ.type === 'yes_no' &&
                          responses[String(currentQ.id)] === undefined &&
                          pendingBranchAnswer === null
                        }
                      >
                        {pendingBranchAnswer !== null
                          ? 'Continue →'
                          : questionIndex < questions.length - 1
                          ? 'Next'
                          : 'Finish Questions'}{' '}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CLOSING PHASE */}
              {phase === 'closing' && (
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      <span>Read the closing script</span>
                    </div>
                    <div className="bg-primary/5 rounded-xl p-6 border">
                      <p className="text-lg leading-relaxed whitespace-pre-wrap">
                        {closingScript || "Thank you for your time and feedback today!"}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button size="lg" onClick={handleNext}>
                        Wrap Up <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* WRAPUP PHASE */}
              {phase === 'wrapup' && (
                <Card>
                  <CardContent className="p-6 space-y-5">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">Wrap Up</h2>
                      <p className="text-sm text-muted-foreground">Finalize the call details</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>Outcome *</Label>
                        <Select value={callOutcome} onValueChange={setCallOutcome}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select outcome" />
                          </SelectTrigger>
                          <SelectContent>
                            {outcomeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {callOutcome === 'transferred' && (
                        <div>
                          <Label>Transfer Notes</Label>
                          <Textarea value={transferNotes} onChange={e => setTransferNotes(e.target.value)}
                            placeholder="Notes about the transfer..." />
                        </div>
                      )}

                      <div>
                        <Label>Duration (minutes)</Label>
                        <Input type="number" min="0" step="0.5" value={callDurationMinutes}
                          onChange={e => setCallDurationMinutes(e.target.value)} placeholder="(optional)" />
                      </div>

                      <div>
                        <Label>Researcher Notes</Label>
                        <Textarea value={researcherNotes} onChange={e => setResearcherNotes(e.target.value)}
                          placeholder="Any additional observations..." rows={3} />
                      </div>
                    </div>

                    <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting || !callOutcome}>
                      {isSubmitting ? 'Submitting...' : 'Submit Call'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </ResearchLayout>
  );
}

// Sub-component for rendering different question types
function QuestionInput({
  question,
  value,
  onChange,
  onBranchSelect,
}: {
  question: ScriptQuestion;
  value: unknown;
  onChange: (val: unknown) => void;
  onBranchSelect?: (answer: boolean) => void;
}) {
  switch (question.type) {
    case 'scale':
      return (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <Button
                key={n}
                type="button"
                variant={value === n ? 'default' : 'outline'}
                size="lg"
                className="w-12 h-12 text-lg"
                onClick={() => onChange(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">Tap a number (optional — AI extracts from recording)</p>
        </div>
      );

    case 'open_ended':
      return (
        <div className="space-y-1">
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Quick notes (optional — AI extracts from recording)"
            rows={2}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">Optional — just click Next to continue</p>
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="space-y-2">
          <RadioGroup value={typeof value === 'string' ? value : ''} onValueChange={onChange}>
            {(question.options || []).map((opt) => (
              <div key={opt} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value={opt} id={`q${question.id}_${opt}`} />
                <Label htmlFor={`q${question.id}_${opt}`} className="font-normal cursor-pointer text-base flex-1">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">Optional — AI extracts from recording</p>
        </div>
      );

    case 'yes_no': {
      const hasBranch = !!question.branch;
      const yesLabel = question.branch?.yes_goto !== undefined
        ? `YES → Q${question.branch.yes_goto}`
        : 'Yes';
      const noLabel = question.branch?.no_goto !== undefined
        ? `NO → Q${question.branch.no_goto}`
        : 'No';

      return (
        <div className="space-y-2">
          <div className="flex gap-3 justify-center">
            <Button
              type="button"
              variant={value === true ? 'default' : 'outline'}
              size="lg"
              className={cn(
                'px-8 py-5 text-base',
                value === true && 'ring-2 ring-primary'
              )}
              onClick={() => {
                onChange(true);
                onBranchSelect?.(true);
              }}
            >
              {hasBranch ? (
                <span className="flex items-center gap-1.5">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm">{yesLabel}</span>
                </span>
              ) : (
                <><ThumbsUp className="w-4 h-4 mr-2" />Yes</>
              )}
            </Button>
            <Button
              type="button"
              variant={value === false ? 'default' : 'outline'}
              size="lg"
              className={cn(
                'px-8 py-5 text-base',
                value === false && 'ring-2 ring-primary'
              )}
              onClick={() => {
                onChange(false);
                onBranchSelect?.(false);
              }}
            >
              {hasBranch ? (
                <span className="flex items-center gap-1.5">
                  <ThumbsDown className="w-4 h-4" />
                  <span className="text-sm">{noLabel}</span>
                </span>
              ) : (
                <><ThumbsDown className="w-4 h-4 mr-2" />No</>
              )}
            </Button>
          </div>
          {hasBranch && (
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <GitBranch className="w-3 h-3" /> Answer determines next question
            </p>
          )}
        </div>
      );
    }

    default:
      return <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} />;
  }
}
