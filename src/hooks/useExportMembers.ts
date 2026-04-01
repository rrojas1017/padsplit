import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExportMember {
  bookingId: string;
  memberName: string;
  phone: string;
  email: string;
  primaryReasonCode: string;
  preventabilityScore: number | null;
  keyQuote: string;
  callDate: string;
}

export type ExportFilter =
  | { type: 'keywords'; keywords: string[] }
  | { type: 'reason_code'; reasonCode: string; includedCodes?: string[] }
  | { type: 'booking_ids'; bookingIds: string[] }
  | { type: 'human_review' }
  | { type: 'full_report' };

const CSV_HEADERS = [
  'Member Name', 'Phone Number', 'Email', 'Booking ID',
  'Primary Reason Code', 'Preventability Score', 'Key Quote', 'Call Date',
];

function escapeCSV(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function memberToRow(m: ExportMember): string {
  return [
    m.memberName, m.phone, m.email, m.bookingId,
    m.primaryReasonCode, m.preventabilityScore?.toString() ?? '',
    m.keyQuote, m.callDate,
  ].map(escapeCSV).join(',');
}

export function downloadMembersCSV(members: ExportMember[], filename: string) {
  const csv = CSV_HEADERS.join(',') + '\n' + members.map(memberToRow).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function mapRow(row: any): ExportMember {
  const b = row.bookings as any;
  const cls = row.research_classification as any;
  const ext = row.research_extraction as any;
  const rawName = ext?.member_name || b?.member_name || 'Unknown';
  const memberName = rawName.startsWith('API Submission - ') ? rawName.replace('API Submission - ', '') : rawName;
  return {
    bookingId: row.booking_id || '',
    memberName,
    phone: b?.contact_phone || '',
    email: b?.contact_email || '',
    primaryReasonCode: cls?.primary_reason_code || cls?.reason_code || '',
    preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? null,
    keyQuote: cls?.key_quote || cls?.supporting_quote || '',
    callDate: b?.booking_date || '',
  };
}

function matchesKeywords(row: any, keywords: string[]): boolean {
  const b = row.bookings as any;
  if (b?.record_type !== 'research' || !b?.has_valid_conversation) return false;
  const cls = row.research_classification as any;
  if (!cls) return false;
  const text = [
    cls.primary_reason_code, cls.reason_code,
    cls.root_cause_summary, cls.root_cause, cls.summary,
    ...(cls.sub_reasons || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

export function useExportMembers() {
  const [members, setMembers] = useState<ExportMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async (filter: ExportFilter) => {
    setIsLoading(true);
    setError(null);
    setMembers([]);

    try {
      if (filter.type === 'booking_ids') {
        if (!filter.bookingIds.length) { setMembers([]); return; }
        const { data, error: err } = await supabase
          .from('booking_transcriptions')
          .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email)')
          .in('booking_id', filter.bookingIds);
        if (err) throw err;
        setMembers((data || []).map(mapRow));
        return;
      }

      if (filter.type === 'human_review') {
        const { data, error: err } = await supabase
          .from('booking_transcriptions')
          .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email)')
          .eq('research_human_review', true)
          .not('research_classification', 'is', null);
        if (err) throw err;
        setMembers((data || []).map(mapRow));
        return;
      }

      // For keywords, reason_code, and full_report we fetch all completed records and filter
      const { data, error: err } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email, record_type, has_valid_conversation)')
        .eq('research_processing_status', 'completed')
        .not('research_classification', 'is', null);
      if (err) throw err;

      const rows = data || [];

      if (filter.type === 'full_report') {
        setMembers(rows.filter((r: any) => {
          const b = r.bookings as any;
          return b?.record_type === 'research' && b?.has_valid_conversation;
        }).map(mapRow));
        return;
      }

      if (filter.type === 'keywords') {
        setMembers(rows.filter((r: any) => matchesKeywords(r, filter.keywords)).map(mapRow));
        return;
      }

      if (filter.type === 'reason_code') {
        const kw = filter.reasonCode.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
        if (filter.includedCodes?.length) kw.push(...filter.includedCodes.map(c => c.toLowerCase()));
        setMembers(rows.filter((r: any) => matchesKeywords(r, kw)).map(mapRow));
        return;
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch members');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportCSV = useCallback((selectedMembers: ExportMember[], filename: string) => {
    downloadMembersCSV(selectedMembers, filename);
  }, []);

  return { members, isLoading, error, fetchMembers, exportCSV };
}
