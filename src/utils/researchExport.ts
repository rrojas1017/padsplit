import { supabase } from '@/integrations/supabase/client';

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

function downloadCSV(filename: string, rows: ExportRecord[]) {
  const csv = CSV_HEADERS.join(',') + '\n' + rows.map(recordToRow).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
    .select('booking_id, research_classification, bookings!inner(member_name, booking_date, contact_phone, contact_email, record_type, has_valid_conversation)')
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
