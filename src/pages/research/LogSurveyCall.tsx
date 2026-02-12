import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useResearchCalls, type ScriptQuestion, type CallSubmission } from '@/hooks/useResearchCalls';
import { CheckCircle, Phone } from 'lucide-react';

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

export default function LogSurveyCall() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { myCampaigns, isLoading, isSubmitting, submitCall } = useResearchCalls();

  const [campaignId, setCampaignId] = useState(searchParams.get('campaign') || '');
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [callerType, setCallerType] = useState('');
  const [callerStatus, setCallerStatus] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [callDurationMinutes, setCallDurationMinutes] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [researcherNotes, setResearcherNotes] = useState('');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeCampaigns = useMemo(
    () => myCampaigns.filter(c => c.status === 'active'),
    [myCampaigns]
  );

  const selectedCampaign = useMemo(
    () => activeCampaigns.find(c => c.id === campaignId),
    [activeCampaigns, campaignId]
  );

  const questions: ScriptQuestion[] = selectedCampaign?.script?.questions || [];

  // Auto-select campaign from URL param
  useEffect(() => {
    const param = searchParams.get('campaign');
    if (param && activeCampaigns.some(c => c.id === param)) {
      setCampaignId(param);
    }
  }, [searchParams, activeCampaigns]);

  const setResponse = (qId: number, value: unknown) => {
    setResponses(prev => ({ ...prev, [String(qId)]: value }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!campaignId) errs.campaign = 'Select a campaign';
    if (!callerName.trim()) errs.callerName = 'Caller name is required';
    if (!callerType) errs.callerType = 'Select caller type';
    if (!callOutcome) errs.callOutcome = 'Select call outcome';

    questions.forEach(q => {
      if (q.required && (responses[String(q.id)] === undefined || responses[String(q.id)] === '')) {
        errs[`q_${q.id}`] = 'This question is required';
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const submission: CallSubmission = {
      campaign_id: campaignId,
      caller_name: callerName.trim(),
      caller_phone: callerPhone.trim() || undefined,
      caller_type: callerType,
      caller_status: callerStatus || undefined,
      call_outcome: callOutcome,
      call_duration_seconds: callDurationMinutes ? Math.round(parseFloat(callDurationMinutes) * 60) : undefined,
      transfer_notes: callOutcome === 'transferred' ? transferNotes : undefined,
      responses: Object.keys(responses).length > 0 ? responses : undefined,
      researcher_notes: researcherNotes.trim() || undefined,
    };

    const success = await submitCall(submission);
    if (success) setSubmitted(true);
  };

  const resetForm = () => {
    setCallerName('');
    setCallerPhone('');
    setCallerType('');
    setCallerStatus('');
    setCallOutcome('');
    setCallDurationMinutes('');
    setTransferNotes('');
    setResearcherNotes('');
    setResponses({});
    setErrors({});
    setSubmitted(false);
  };

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
        <div className="space-y-6 max-w-2xl">
          {/* Campaign Selection */}
          <Card>
            <CardHeader><CardTitle className="text-base">Campaign</CardTitle></CardHeader>
            <CardContent>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className={errors.campaign ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {activeCampaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.campaign && <p className="text-sm text-destructive mt-1">{errors.campaign}</p>}
              {activeCampaigns.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">No active campaigns assigned to you.</p>
              )}
            </CardContent>
          </Card>

          {/* Caller Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Caller Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Caller Name *</Label>
                <Input value={callerName} onChange={e => setCallerName(e.target.value)}
                  className={errors.callerName ? 'border-destructive' : ''} placeholder="Enter caller name" />
                {errors.callerName && <p className="text-sm text-destructive mt-1">{errors.callerName}</p>}
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={callerPhone} onChange={e => setCallerPhone(e.target.value)} placeholder="(optional)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Caller Type *</Label>
                  <Select value={callerType} onValueChange={setCallerType}>
                    <SelectTrigger className={errors.callerType ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {callerTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.callerType && <p className="text-sm text-destructive mt-1">{errors.callerType}</p>}
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
            </CardContent>
          </Card>

          {/* Dynamic Script Questions */}
          {selectedCampaign && questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Survey Questions</CardTitle>
                <p className="text-sm text-muted-foreground">Script: {selectedCampaign.script?.name}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-sm">
                      {q.text} {q.required && <span className="text-destructive">*</span>}
                    </Label>
                    <QuestionInput
                      question={q}
                      value={responses[String(q.id)]}
                      onChange={(val) => setResponse(q.id, val)}
                    />
                    {errors[`q_${q.id}`] && (
                      <p className="text-sm text-destructive">{errors[`q_${q.id}`]}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Call Outcome */}
          <Card>
            <CardHeader><CardTitle className="text-base">Call Outcome</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Outcome *</Label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger className={errors.callOutcome ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.callOutcome && <p className="text-sm text-destructive mt-1">{errors.callOutcome}</p>}
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
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Call'}
          </Button>
        </div>
      )}
    </ResearchLayout>
  );
}

// Sub-component for rendering different question types
function QuestionInput({ question, value, onChange }: {
  question: ScriptQuestion;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (question.type) {
    case 'scale':
      return (
        <div className="space-y-2">
          <Slider
            min={1} max={10} step={1}
            value={[typeof value === 'number' ? value : 5]}
            onValueChange={([v]) => onChange(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span className="font-medium text-foreground text-sm">{typeof value === 'number' ? value : '–'}</span>
            <span>10</span>
          </div>
        </div>
      );

    case 'open_ended':
      return (
        <Textarea
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter response..."
          rows={3}
        />
      );

    case 'multiple_choice':
      return (
        <RadioGroup value={typeof value === 'string' ? value : ''} onValueChange={onChange}>
          {(question.options || []).map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`q${question.id}_${opt}`} />
              <Label htmlFor={`q${question.id}_${opt}`} className="font-normal cursor-pointer">{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      );

    case 'yes_no':
      return (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={value === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(true)}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={value === false ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(false)}
          >
            No
          </Button>
        </div>
      );

    default:
      return <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} />;
  }
}
