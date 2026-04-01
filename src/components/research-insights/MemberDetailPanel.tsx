import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Quote, Search, CheckCircle2, Lightbulb, AlertTriangle, User, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { normalizeAddressability, CLUSTER_COLORS } from '@/utils/reason-code-mapping';

interface MemberDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcriptionId: string | null;
  onAuditSaved?: () => void;
}

const CLUSTER_NAMES = Object.keys(CLUSTER_COLORS);

function scoreColor(score: number | null) {
  if (score == null) return '';
  if (score >= 7) return 'text-red-600 bg-red-100';
  if (score >= 4) return 'text-amber-600 bg-amber-100';
  return 'text-emerald-600 bg-emerald-100';
}

export function MemberDetailPanel({ open, onOpenChange, transcriptionId, onAuditSaved }: MemberDetailPanelProps) {
  const { isAdmin } = useIsAdmin();
  const [activeTab, setActiveTab] = useState('summary');
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Transcript state (lazy loaded)
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Audit state
  const [auditReasonCode, setAuditReasonCode] = useState('');
  const [auditScore, setAuditScore] = useState('');
  const [auditAddressability, setAuditAddressability] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [auditReprocess, setAuditReprocess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch record when panel opens
  useEffect(() => {
    if (!open || !transcriptionId) { setRecord(null); setTranscript(null); setActiveTab('summary'); return; }
    setLoading(true);
    setTranscript(null);
    supabase
      .from('booking_transcriptions')
      .select('id, booking_id, research_extraction, research_classification, research_human_review, research_audit, created_at, bookings!inner(member_name, contact_phone, contact_email)')
      .eq('id', transcriptionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error);
        setRecord(data);
        const cls = (data as any)?.research_classification;
        setAuditReasonCode(cls?.primary_reason_code || '');
        setAuditScore(String(cls?.preventability_score ?? ''));
        setAuditAddressability(normalizeAddressability(cls?.addressability || ''));
        setAuditNotes('');
        setAuditReprocess(false);
        setLoading(false);
      });
  }, [open, transcriptionId]);

  // Lazy load transcript
  useEffect(() => {
    if (activeTab !== 'transcript' || !transcriptionId || transcript !== null) return;
    setTranscriptLoading(true);
    supabase
      .from('booking_transcriptions')
      .select('call_transcription')
      .eq('id', transcriptionId)
      .maybeSingle()
      .then(({ data }) => {
        setTranscript((data as any)?.call_transcription || '');
        setTranscriptLoading(false);
      });
  }, [activeTab, transcriptionId, transcript]);

  const cls = record?.research_classification || {};
  const ext = record?.research_extraction || {};
  const booking = (record?.bookings as any) || {};
  const audit = record?.research_audit;
  const memberName = ext?.member_name || booking?.member_name || 'Unknown';
  const phone = booking?.contact_phone || ext?.phone_number || '';

  // Parse transcript into chat bubbles
  const chatLines = useMemo(() => {
    if (!transcript) return [];
    const lines: { speaker: 'agent' | 'member' | 'unknown'; text: string }[] = [];
    transcript.split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      if (/^agent\s*:/i.test(line)) {
        lines.push({ speaker: 'agent', text: line.replace(/^agent\s*:\s*/i, '') });
      } else if (/^member\s*:/i.test(line)) {
        lines.push({ speaker: 'member', text: line.replace(/^member\s*:\s*/i, '') });
      } else if (lines.length > 0) {
        lines[lines.length - 1].text += ' ' + line;
      } else {
        lines.push({ speaker: 'unknown', text: line });
      }
    });
    return lines;
  }, [transcript]);

  const wordCount = useMemo(() => transcript?.split(/\s+/).filter(Boolean).length || 0, [transcript]);
  const estMinutes = Math.round(wordCount / 150);

  const handleSaveAudit = async () => {
    if (!transcriptionId || !record) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const auditData = {
        audited_by: user?.id,
        audited_at: new Date().toISOString(),
        original_reason_code: cls.primary_reason_code,
        original_score: cls.preventability_score,
        original_addressability: cls.addressability,
        override_reason_code: auditReasonCode,
        override_score: parseInt(auditScore) || null,
        override_addressability: auditAddressability,
        audit_notes: auditNotes,
        needs_reprocessing: auditReprocess,
      };

      const updatedClassification = {
        ...cls,
        primary_reason_code: auditReasonCode,
        preventability_score: parseInt(auditScore) || cls.preventability_score,
        addressability: auditAddressability,
      };

      const { error } = await supabase
        .from('booking_transcriptions')
        .update({
          research_classification: updatedClassification,
          research_audit: auditData,
          research_human_review: false,
        } as any)
        .eq('id', transcriptionId);

      if (error) throw error;
      toast.success('Audit saved — classification updated.');
      setRecord({ ...record, research_classification: updatedClassification, research_audit: auditData, research_human_review: false });
      onAuditSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save audit');
    } finally {
      setSaving(false);
    }
  };

  const highlightText = useCallback((text: string) => {
    if (!transcriptSearch.trim()) return text;
    const regex = new RegExp(`(${transcriptSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
  }, [transcriptSearch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[620px] overflow-y-auto">
        {loading ? (
          <div className="space-y-4 pt-8">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : record ? (
          <>
            <SheetHeader className="pb-4 border-b border-border">
              <SheetTitle className="text-lg">{memberName}</SheetTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{phone}</span>}
                <span className="font-mono text-xs">ID: {record.booking_id?.substring(0, 8)}</span>
              </div>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                {isAdmin && <TabsTrigger value="audit">Audit</TabsTrigger>}
              </TabsList>

              {/* SUMMARY TAB */}
              <TabsContent value="summary" className="space-y-5 mt-4">
                {/* Primary Reason */}
                <Section title="Primary Reason">
                  {ext.primary_reason_stated && <Field label="Stated by member" value={ext.primary_reason_stated} />}
                  {ext.primary_reason_interpreted && <Field label="Interpreted" value={ext.primary_reason_interpreted} />}
                  {cls.primary_reason_code && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Reason Code:</span>
                      <Badge variant="outline">{cls.primary_reason_code}</Badge>
                    </div>
                  )}
                  {cls.secondary_reason_codes?.length > 0 && (
                    <Field label="Secondary factors" value={cls.secondary_reason_codes.join(', ')} />
                  )}
                </Section>

                {/* Case Assessment */}
                <Section title="Case Assessment">
                  {cls.case_brief && <Field label="Case Brief" value={cls.case_brief} />}
                  {cls.preventability_score != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Preventability:</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${scoreColor(cls.preventability_score)}`}>
                        {cls.preventability_score}/10
                      </span>
                      {cls.preventability_rationale && <span className="text-xs text-muted-foreground ml-1">{cls.preventability_rationale}</span>}
                    </div>
                  )}
                  {cls.addressability && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Addressability:</span>
                      <Badge variant="secondary" className="text-xs">{cls.addressability}</Badge>
                      {cls.addressability_rationale && <span className="text-xs text-muted-foreground ml-1">{cls.addressability_rationale}</span>}
                    </div>
                  )}
                </Section>

                {/* Key Quotes */}
                {cls.key_quotes?.length > 0 && (
                  <Section title="Key Quotes">
                    {cls.key_quotes.map((q: string, i: number) => (
                      <div key={i} className="bg-red-50 border-l-[3px] border-red-300 rounded-r-lg p-3 mb-2">
                        <p className="text-sm italic text-muted-foreground">&ldquo;{q}&rdquo;</p>
                      </div>
                    ))}
                  </Section>
                )}

                {/* What We Could Have Done */}
                {cls.what_we_could_have_done && (
                  <Section title="What We Could Have Done">
                    <p className="text-sm text-muted-foreground">{cls.what_we_could_have_done}</p>
                  </Section>
                )}

                {/* Intervention Opportunities */}
                {cls.intervention_opportunities?.length > 0 && (
                  <Section title="Intervention Opportunities">
                    {cls.intervention_opportunities.map((item: any, i: number) => {
                      const text = typeof item === 'string' ? item : item?.action || item?.moment || JSON.stringify(item);
                      const dept = typeof item === 'object' && item?.department_responsible ? item.department_responsible : null;
                      const retention = typeof item === 'object' && item?.likelihood_of_retention ? item.likelihood_of_retention : null;
                      return (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <Lightbulb className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-sm text-muted-foreground">{text}</span>
                            {(dept || retention) && (
                              <div className="flex gap-2 mt-0.5">
                                {dept && <Badge variant="outline" className="text-[10px]">{dept}</Badge>}
                                {retention && <span className="text-[10px] text-muted-foreground">Retention: {retention}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Section>
                )}

                {/* Agent Notes */}
                {cls.agent_performance_notes && (
                  <Section title="Agent Notes">
                    <p className="text-sm text-muted-foreground">{cls.agent_performance_notes}</p>
                  </Section>
                )}
              </TabsContent>

              {/* TRANSCRIPT TAB */}
              <TabsContent value="transcript" className="mt-4">
                {transcriptLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-3/4" />)}
                  </div>
                ) : !transcript ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No transcript available for this record.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">~{wordCount.toLocaleString()} words, ~{estMinutes} min call</span>
                      <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input placeholder="Search transcript..." value={transcriptSearch} onChange={e => setTranscriptSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                      {chatLines.map((line, i) => (
                        <div key={i} className={`flex ${line.speaker === 'member' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            line.speaker === 'agent' ? 'bg-muted' : line.speaker === 'member' ? 'bg-blue-50' : 'bg-muted/50'
                          }`}>
                            <p className={`text-[10px] font-semibold mb-0.5 ${
                              line.speaker === 'agent' ? 'text-muted-foreground' : 'text-blue-600'
                            }`}>
                              {line.speaker === 'agent' ? 'Agent' : line.speaker === 'member' ? 'Member' : ''}
                            </p>
                            <p
                              className="text-sm text-foreground leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: highlightText(line.text) }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* AUDIT TAB */}
              {isAdmin && (
                <TabsContent value="audit" className="space-y-5 mt-4">
                  {/* Previous audit info */}
                  {audit && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-foreground">Previously Audited</p>
                      <p className="text-xs text-muted-foreground">
                        Audited on {audit.audited_at ? format(new Date(audit.audited_at), 'MMM d, yyyy h:mm a') : '—'}
                      </p>
                      {audit.original_reason_code && audit.override_reason_code && (
                        <p className="text-xs text-muted-foreground">
                          Original: <Badge variant="outline" className="text-[10px] mx-1">{audit.original_reason_code}</Badge>
                          → Overridden to: <Badge variant="outline" className="text-[10px] mx-1">{audit.override_reason_code}</Badge>
                        </p>
                      )}
                      {audit.audit_notes && <p className="text-xs text-muted-foreground">Notes: {audit.audit_notes}</p>}
                    </div>
                  )}

                  {/* Current Classification */}
                  <Section title="Current Classification">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Field label="Reason Code" value={cls.primary_reason_code || '—'} />
                      <Field label="Score" value={`${cls.preventability_score ?? '—'} / 10`} />
                      <Field label="Addressability" value={cls.addressability || '—'} />
                      <Field label="Human Review" value={record.research_human_review ? 'Flagged' : 'Not Flagged'} />
                    </div>
                  </Section>

                  {/* Override Section */}
                  <Section title="Override">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-foreground">Reason Code Override</label>
                        <Select value={auditReasonCode} onValueChange={setAuditReasonCode}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CLUSTER_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">Preventability Score Override</label>
                        <Input type="number" min={1} max={10} value={auditScore} onChange={e => setAuditScore(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">Addressability Override</label>
                        <Select value={auditAddressability} onValueChange={setAuditAddressability}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Addressable">Addressable</SelectItem>
                            <SelectItem value="Partially Addressable">Partially Addressable</SelectItem>
                            <SelectItem value="Not Addressable">Not Addressable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground">Audit Notes</label>
                        <Textarea value={auditNotes} onChange={e => setAuditNotes(e.target.value)} className="mt-1" placeholder="Explain why you're overriding..." rows={3} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={auditReprocess} onCheckedChange={(v) => setAuditReprocess(!!v)} id="reprocess" />
                        <label htmlFor="reprocess" className="text-xs text-muted-foreground">Needs Re-processing</label>
                      </div>
                      <Button onClick={handleSaveAudit} disabled={saving} className="w-full">
                        {saving ? 'Saving...' : 'Save Audit'}
                      </Button>
                    </div>
                  </Section>
                </TabsContent>
              )}
            </Tabs>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center pt-12">Record not found.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1">
      <span className="text-xs text-muted-foreground">{label}:</span>{' '}
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
