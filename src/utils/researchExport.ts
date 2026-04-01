import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ExportRecord {
  memberName: string;
  phone: string;
  email: string;
  bookingId: string;
  primaryReasonCode: string;
  secondaryFactors: string;
  preventabilityScore: string;
  keyQuote: string;
  agentNotes: string;
  callDate: string;
}

const CSV_HEADERS = [
  'Member Name', 'Phone Number', 'Email', 'Booking ID',
  'Primary Reason Code', 'Secondary Factors', 'Preventability Score',
  'Key Quote', 'Agent Notes', 'Call Date',
];

function escapeCSV(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function recordToRow(r: ExportRecord): string {
  return [
    r.memberName, r.phone, r.email, r.bookingId,
    r.primaryReasonCode, r.secondaryFactors, r.preventabilityScore,
    r.keyQuote, r.agentNotes, r.callDate,
  ].map(escapeCSV).join(',');
}

function downloadCSVBlob(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(filename: string, rows: ExportRecord[]) {
  const csv = CSV_HEADERS.join(',') + '\n' + rows.map(recordToRow).join('\n');
  downloadCSVBlob(filename, csv);
}

function mapRow(row: any): ExportRecord {
  const b = row.bookings as any;
  const cls = row.research_classification as any;
  const ext = row.research_extraction as any;
  const rawName = ext?.member_name || b?.member_name || 'Unknown';
  const memberName = rawName.startsWith('API Submission - ') ? rawName.replace('API Submission - ', '') : rawName;
  return {
    memberName,
    phone: b?.contact_phone || '',
    email: b?.contact_email || '',
    bookingId: row.booking_id || '',
    primaryReasonCode: cls?.primary_reason_code || cls?.reason_code || '',
    secondaryFactors: (cls?.sub_reasons || []).join('; '),
    preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? '',
    keyQuote: cls?.key_quote || cls?.supporting_quote || '',
    agentNotes: cls?.root_cause_summary || cls?.root_cause || cls?.summary || '',
    callDate: b?.booking_date || '',
  };
}

/** Export by specific booking IDs */
export async function exportByBookingIds(bookingIds: string[], filename: string) {
  if (!bookingIds.length) return;
  const { data, error } = await supabase
    .from('booking_transcriptions')
    .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email)')
    .in('booking_id', bookingIds);
  if (error) throw error;
  downloadCSV(filename, (data || []).map(mapRow));
  return (data || []).length;
}

/** Export by keyword matching on classification (for clusters/host flags) */
export async function exportByKeywords(keywords: string[], filename: string) {
  const { data, error } = await supabase
    .from('booking_transcriptions')
    .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email, record_type, has_valid_conversation)')
    .eq('research_processing_status', 'completed')
    .not('research_classification', 'is', null);
  if (error) throw error;

  const lowerKw = keywords.map(k => k.toLowerCase());
  const matched = (data || []).filter((row: any) => {
    const b = row.bookings as any;
    if (b?.record_type !== 'research' || !b?.has_valid_conversation) return false;
    const cls = row.research_classification as any;
    if (!cls) return false;
    const text = [
      cls.primary_reason_code, cls.reason_code,
      cls.root_cause_summary, cls.root_cause, cls.summary,
      ...(cls.sub_reasons || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return lowerKw.some(kw => text.includes(kw));
  });
  downloadCSV(filename, matched.map(mapRow));
  return matched.length;
}

/** Export human review queue */
export async function exportHumanReviewQueue(filename: string) {
  const { data, error } = await supabase
    .from('booking_transcriptions')
    .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email)')
    .eq('research_human_review', true)
    .not('research_classification', 'is', null);
  if (error) throw error;
  downloadCSV(filename, (data || []).map(mapRow));
  return (data || []).length;
}

/** Export full report — all completed research records */
export async function exportFullReport(filename: string) {
  const { data, error } = await supabase
    .from('booking_transcriptions')
    .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email, record_type, has_valid_conversation)')
    .eq('research_processing_status', 'completed')
    .not('research_classification', 'is', null);
  if (error) throw error;
  const filtered = (data || []).filter((row: any) => {
    const b = row.bookings as any;
    return b?.record_type === 'research' && b?.has_valid_conversation;
  });
  downloadCSV(filename, filtered.map(mapRow));
  return filtered.length;
}

// ── Step 11: Actionable export utilities ──

export interface DrillDownMember {
  transcriptionId: string;
  bookingId: string;
  memberName: string;
  phone: string;
  email: string;
  reasonCode: string;
  subReason: string;
  preventabilityScore: number | null;
  addressability: string;
  keyQuote: string;
  caseSummary: string;
  statedReason: string;
  actualReason: string;
  statedVsActualMatch: string;
  moveOutDate: string;
}

export function exportForSurvey(members: DrillDownMember[], filename: string) {
  const headers = [
    'member_name', 'phone', 'email', 'reason_code', 'sub_reason',
    'preventability_score', 'addressability', 'key_quote', 'case_summary',
    'stated_reason', 'actual_reason', 'stated_vs_actual_match', 'move_out_date',
  ];
  const rows = members.map(m => [
    m.memberName, m.phone, m.email, m.reasonCode, m.subReason,
    m.preventabilityScore ?? '', m.addressability, m.keyQuote, m.caseSummary,
    m.statedReason, m.actualReason, m.statedVsActualMatch, m.moveOutDate,
  ].map(v => escapeCSV(String(v ?? ''))).join(','));
  downloadCSVBlob(filename, headers.join(',') + '\n' + rows.join('\n'));
}

export function exportCallList(members: DrillDownMember[], filename: string) {
  const headers = ['member_name', 'phone', 'reason_summary', 'priority_notes'];
  const rows = members.map(m => {
    const summary = `${m.subReason} - ${m.caseSummary}`.substring(0, 120);
    const score = m.preventabilityScore ?? 0;
    const priority = score >= 7 ? 'HIGH PRIORITY' : score >= 4 ? 'MEDIUM' : 'LOW';
    const notes = `${priority}: Score ${score}/10, ${m.addressability}`;
    return [m.memberName, m.phone, summary, notes].map(v => escapeCSV(String(v))).join(',');
  });
  downloadCSVBlob(filename, headers.join(',') + '\n' + rows.join('\n'));
}

export function copyPhones(members: DrillDownMember[]) {
  const phones = members.map(m => m.phone).filter(Boolean);
  navigator.clipboard.writeText(phones.join('\n'));
  toast({ title: `Copied ${phones.length} phone numbers to clipboard` });
}

export function generateActionItems(subReason: string, count: number, cluster: string): string[] {
  const actions: string[] = [];

  if (cluster.includes('Host')) {
    actions.push(`Schedule property inspections for affected addresses`);
    actions.push(`Send maintenance follow-up survey to ${count} affected members`);
    actions.push(`Flag hosts with 3+ complaints for accountability review`);
    if (subReason.toLowerCase().includes('mold') || subReason.toLowerCase().includes('pest')) {
      actions.push(`Create mold/pest remediation tracking tickets`);
    }
    if (subReason.toLowerCase().includes('illegal') || subReason.toLowerCase().includes('eviction')) {
      actions.push(`Escalate to legal team for review`);
      actions.push(`Document host violations for potential removal`);
    }
  } else if (cluster.includes('Payment')) {
    actions.push(`Review payment plans for ${count} affected members`);
    actions.push(`Send financial assistance resource information`);
    actions.push(`Evaluate pricing/fee structure for this segment`);
  } else if (cluster.includes('Roommate')) {
    actions.push(`Review house assignments and compatibility screening`);
    actions.push(`Send safety concern follow-up survey to ${count} members`);
    actions.push(`Evaluate roommate matching algorithm for these addresses`);
  } else if (cluster.includes('Communication')) {
    actions.push(`Audit support ticket response times for these cases`);
    actions.push(`Send service recovery outreach to ${count} members`);
    actions.push(`Review agent training on case follow-through`);
  } else if (cluster.includes('Policy')) {
    actions.push(`Review transfer/guest policy documentation for clarity`);
    actions.push(`Send policy explanation survey to ${count} members`);
    actions.push(`Evaluate policy flexibility options`);
  }

  actions.push(`Add ${count} members to retention/win-back campaign`);
  return actions;
}

/** Generate a priority label based on cluster and count */
export function getActionPriority(cluster: string, count: number): { label: string; level: string } {
  if (cluster.includes('Host') && count > 30) return { label: 'P0 — Critical', level: 'P0' };
  if (cluster.includes('Host') || cluster.includes('Roommate')) return { label: 'P1 — High', level: 'P1' };
  return { label: 'P2 — Medium', level: 'P2' };
}
