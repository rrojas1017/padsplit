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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useResearchCalls, type ScriptQuestion, type CallSubmission } from '@/hooks/useResearchCalls';
import { useAuth } from '@/contexts/AuthContext';
import { SectionJumpNavigator } from '@/components/research/SectionJumpNavigator';
import { ProbingFollowUps } from '@/components/research/ProbingFollowUps';
import {
  CheckCircle, Phone, ArrowRight, ArrowLeft, MessageSquare,
  XCircle, ThumbsUp, ThumbsDown, User, GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
];

type WizardPhase = 'setup' | 'intro' | 'consent' | 'question' | 'rebuttal' | 'closing' | 'wrapup';

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

  // Setup fields
  const [campaignId, setCampaignId] = useState(searchParams.get('campaign') || '');
  const [callerFirstName, setCallerFirstName] = useState('');
  const [callerLastName, setCallerLastName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [callerType, setCallerType] = useState('');
  const [callerStatus, setCallerStatus] = useState('');

  // Wizard state
  const [phase, setPhase] = useState<WizardPhase>('setup');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [consent, setConsent] = useState<boolean | null>(null);

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

  const questions: ScriptQuestion[] = useMemo(
    () => selectedCampaign?.script?.questions || [],
    [selectedCampaign]
  );
  const introScript = selectedCampaign?.script?.intro_script || '';
  const rebuttalScript = selectedCampaign?.script?.rebuttal_script || '';
  const closingScript = selectedCampaign?.script?.closing_script || '';

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

  const handleStartScript = () => {
    if (!validateSetup()) return;
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
      else setPhase('setup');
    } else if (phase === 'intro') {
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
      caller_phone: callerPhone.trim() || undefined,
      caller_type: callerType,
      caller_status: callerStatus || undefined,
      call_outcome: callOutcome,
      call_duration_seconds: callDurationMinutes ? Math.round(parseFloat(callDurationMinutes) * 60) : undefined,
      transfer_notes: callOutcome === 'transferred' ? transferNotes : undefined,
      responses: Object.keys(responses).length > 0 ? responses : undefined,
      researcher_notes: researcherNotes.trim() || undefined,
      researcher_name: agentName,
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
  };

  // Progress calculation
  const totalSteps = questions.length + (introScript ? 1 : 0) + 1 + (closingScript ? 1 : 0);
  const currentStepNum = (() => {
    if (phase === 'intro') return 1;
    if (phase === 'consent') return (introScript ? 2 : 1);
    if (phase === 'question') return (introScript ? 3 : 2) + questionIndex;
    if (phase === 'closing') return totalSteps;
    return totalSteps;
  })();
  const progressPercent = totalSteps > 0 ? (currentStepNum / totalSteps) * 100 : 0;

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
          {/* Progress bar */}
          {phase !== 'setup' && phase !== 'wrapup' && (
            <div className="space-y-1 max-w-2xl mx-auto">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {phase === 'question'
                    ? `Question ${questionIndex + 1} of ${questions.length}`
                    : phase === 'intro' ? 'Introduction'
                    : phase === 'consent' ? 'Consent'
                    : phase === 'closing' ? 'Closing'
                    : 'Rebuttal'}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

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
                            onChange={e => setCallerFirstName(e.target.value)}
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
                            onChange={e => setCallerLastName(e.target.value)}
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
                          onChange={e => setCallerPhone(e.target.value)}
                          className={setupErrors.callerPhone ? 'border-destructive' : ''}
                          placeholder="e.g. (404) 555-0100"
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

                    <Button className="w-full" size="lg" onClick={handleStartScript} disabled={activeCampaigns.length === 0}>
                      Start Script <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
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
                      <ProbingFollowUps probes={currentQ.probes} />
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
                            />
                          )
                          : currentQ.branch?.no_probes && (
                            <ProbingFollowUps
                              probes={currentQ.branch.no_probes}
                              label="NO follow-ups"
                              variant="branch-no"
                            />
                          )
                        }
                      </div>
                    )}

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button size="lg" onClick={handleNext}>
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
          {!hasBranch && (
            <p className="text-xs text-center text-muted-foreground">Optional — AI extracts from recording</p>
          )}
        </div>
      );
    }

    default:
      return <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} />;
  }
}
