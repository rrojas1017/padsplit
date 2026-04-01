import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExportRecord {
  memberName: string;
  phone: string;
  email: string;
  bookingId: string;
  primaryReasonCode: string;
  secondaryFactors: string;
  preventabilityScore: number | null;
  addressability: string;
  keyQuote: string;
  callDate: string;
  agentNotes: string;
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
    preventabilityScore: cls?.preventability_score ?? cls?.preventability ?? null,
    addressability: cls?.addressability || '',
    keyQuote: cls?.key_quote || cls?.supporting_quote || '',
    callDate: b?.booking_date || '',
    agentNotes: cls?.root_cause_summary || cls?.root_cause || cls?.summary || '',
  };
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?[\]:]/g, '').substring(0, 31);
}

function dateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addSummarySheet(wb: XLSX.WorkBook, title: string, context: string, records: ExportRecord[]) {
  const highPrev = records.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 7).length;
  const medPrev = records.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 4 && r.preventabilityScore < 7).length;
  const lowPrev = records.filter(r => r.preventabilityScore != null && r.preventabilityScore < 4).length;
  const avgPrev = records.filter(r => r.preventabilityScore != null).length > 0
    ? (records.reduce((s, r) => s + (r.preventabilityScore ?? 0), 0) / records.filter(r => r.preventabilityScore != null).length).toFixed(1)
    : 'N/A';
  const dateRange = records.length > 0
    ? `${records.reduce((min, r) => r.callDate < min ? r.callDate : min, records[0].callDate)} to ${records.reduce((max, r) => r.callDate > max ? r.callDate : max, records[0].callDate)}`
    : 'N/A';

  const reasonCounts: Record<string, number> = {};
  records.forEach(r => {
    if (r.primaryReasonCode) {
      reasonCounts[r.primaryReasonCode] = (reasonCounts[r.primaryReasonCode] || 0) + 1;
    }
  });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  const rows = [
    ['PadSplit Research Insights Export'],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    [context],
    [],
    ['Key Statistics'],
    ['Total Members', records.length],
    ['Avg Preventability Score', avgPrev],
    ['High Risk (7-10)', highPrev],
    ['Medium Risk (4-6)', medPrev],
    ['Low Risk (1-3)', lowPrev],
    ['Date Range', dateRange],
    ['Most Common Reason', topReason ? `${topReason[0]} (${topReason[1]} cases)` : 'N/A'],
    [],
    ['Description'],
    [title],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
}

function addMemberSheet(wb: XLSX.WorkBook, records: ExportRecord[], sheetName = 'Member Details') {
  const headers = ['#', 'Member Name', 'Phone Number', 'Email', 'Booking ID', 'Primary Reason Code',
    'Secondary Factors', 'Preventability Score', 'Addressability', 'Key Quote', 'Call Date', 'Agent Notes'];

  const rows = records.map((r, i) => [
    i + 1, r.memberName, r.phone, r.email, r.bookingId, r.primaryReasonCode,
    r.secondaryFactors, r.preventabilityScore ?? '', r.addressability,
    r.keyQuote, r.callDate, r.agentNotes,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 16 }, { wch: 25 }, { wch: 12 }, { wch: 25 },
    { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 35 },
  ];
  ws['!autofilter'] = { ref: `A1:L${rows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
}

function addStatsSheet(wb: XLSX.WorkBook, records: ExportRecord[]) {
  const reasonCounts: Record<string, number> = {};
  records.forEach(r => {
    if (r.primaryReasonCode) reasonCounts[r.primaryReasonCode] = (reasonCounts[r.primaryReasonCode] || 0) + 1;
  });
  const sorted = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

  const rows: any[][] = [
    ['Reason Code Breakdown'],
    ['Reason Code', 'Count', 'Percentage'],
    ...sorted.map(([code, cnt]) => [code, cnt, `${((cnt / records.length) * 100).toFixed(1)}%`]),
    [],
    ['Preventability Distribution'],
    ['Bucket', 'Count'],
    ['High (7-10)', records.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 7).length],
    ['Medium (4-6)', records.filter(r => r.preventabilityScore != null && r.preventabilityScore >= 4 && r.preventabilityScore < 7).length],
    ['Low (1-3)', records.filter(r => r.preventabilityScore != null && r.preventabilityScore < 4).length],
    ['Unknown', records.filter(r => r.preventabilityScore == null).length],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Statistics');
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchRecords(filter: { type: string; keywords?: string[]; bookingIds?: string[]; reasonCode?: string; includedCodes?: string[] }): Promise<ExportRecord[]> {
  const selectStr = 'booking_id, research_classification, research_extraction, bookings!inner(member_name, booking_date, contact_phone, contact_email, record_type, has_valid_conversation)';

  if (filter.type === 'booking_ids' && filter.bookingIds?.length) {
    const { data } = await supabase.from('booking_transcriptions').select(selectStr).in('booking_id', filter.bookingIds);
    return (data || []).map(mapRow);
  }

  if (filter.type === 'human_review') {
    const { data } = await supabase.from('booking_transcriptions')
      .select(selectStr).eq('research_human_review', true).not('research_classification', 'is', null);
    return (data || []).map(mapRow);
  }

  const { data } = await supabase.from('booking_transcriptions')
    .select(selectStr).eq('research_processing_status', 'completed').not('research_classification', 'is', null);
  const rows = (data || []).filter((r: any) => {
    const b = r.bookings as any;
    return b?.record_type === 'research' && b?.has_valid_conversation;
  });

  if (filter.type === 'full_report') return rows.map(mapRow);

  if (filter.type === 'keywords' && filter.keywords?.length) {
    const kw = filter.keywords.map(k => k.toLowerCase());
    return rows.filter((r: any) => {
      const cls = r.research_classification as any;
      if (!cls) return false;
      const text = [cls.primary_reason_code, cls.reason_code, cls.root_cause_summary, cls.root_cause, cls.summary, ...(cls.sub_reasons || [])].filter(Boolean).join(' ').toLowerCase();
      return kw.some(k => text.includes(k));
    }).map(mapRow);
  }

  if (filter.type === 'reason_code' && filter.reasonCode) {
    const kw = filter.reasonCode.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    if (filter.includedCodes?.length) kw.push(...filter.includedCodes.map(c => c.toLowerCase()));
    return rows.filter((r: any) => {
      const cls = r.research_classification as any;
      if (!cls) return false;
      const text = [cls.primary_reason_code, cls.reason_code, cls.root_cause_summary, cls.root_cause, cls.summary, ...(cls.sub_reasons || [])].filter(Boolean).join(' ').toLowerCase();
      return kw.some(k => text.includes(k));
    }).map(mapRow);
  }

  return rows.map(mapRow);
}

export async function exportMemberList(
  filter: { type: string; keywords?: string[]; bookingIds?: string[]; reasonCode?: string; includedCodes?: string[] },
  title: string,
  context: string,
  filenameBase?: string
) {
  const toastId = toast.loading('Generating export...');
  try {
    const records = await fetchRecords(filter);
    if (records.length === 0) {
      toast.dismiss(toastId);
      toast.warning('No matching records found');
      return;
    }

    const wb = XLSX.utils.book_new();
    addSummarySheet(wb, title, context, records);
    addMemberSheet(wb, records);
    if (records.length >= 20) addStatsSheet(wb, records);

    const filename = `PadSplit-${(filenameBase || title).replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)}-${dateStr()}.xlsx`;
    downloadWorkbook(wb, filename);
    toast.dismiss(toastId);
    toast.success(`Exported ${records.length} records`);
  } catch (err: any) {
    toast.dismiss(toastId);
    toast.error('Export failed: ' + (err.message || 'Unknown error'));
  }
}

export async function exportFullReport(reportData: any) {
  const toastId = toast.loading('Generating full report...');
  try {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Summary
    const es = reportData?.executive_summary;
    const esRows: any[][] = [
      ['PadSplit Research Insights — Full Report'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
    ];
    if (es) {
      const headline = es.headline || es.title || '';
      if (headline) esRows.push(['Headline', headline]);
      const findings = Array.isArray(es.key_findings) ? es.key_findings : [];
      findings.forEach((f: string, i: number) => esRows.push([`Finding ${i + 1}`, f]));
      const rec = es.recommendation_summary || es.urgent_recommendation || es.top_recommendation || '';
      if (rec) esRows.push([], ['Top Recommendation', rec]);
      if (es.urgent_quote) esRows.push([], ['Key Quote', `"${es.urgent_quote}"`]);
    }
    const esWs = XLSX.utils.aoa_to_sheet(esRows);
    esWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, esWs, 'Executive Summary');

    // Sheet 2: Reason Codes
    const dist = reportData?.reason_code_distribution;
    if (Array.isArray(dist) && dist.length > 0) {
      const rcHeaders = ['Reason Code', 'Count', 'Percentage', 'Severity', 'Addressability'];
      const rcRows = dist.map((d: any) => [
        d.code || d.reason_group || d.category || '',
        d.count || '',
        d.percentage || d.pct || '',
        d.severity || '',
        d.addressability || '',
      ]);
      const rcWs = XLSX.utils.aoa_to_sheet([rcHeaders, ...rcRows]);
      rcWs['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, rcWs, 'Reason Codes');
    }

    // Sheet 3: All Members
    const records = await fetchRecords({ type: 'full_report' });
    addMemberSheet(wb, records, 'All Members');

    // Sheet 4: Issue Clusters
    const clusters = reportData?.issue_clusters;
    if (Array.isArray(clusters) && clusters.length > 0) {
      const clHeaders = ['Cluster', 'Priority', 'Member Count', 'Root Cause', 'Action'];
      const clRows = clusters.map((c: any) => [
        c.cluster_name || c.name || '',
        c.priority || '',
        c.member_count || c.case_count || '',
        c.root_cause || '',
        c.action || c.recommended_action || '',
      ]);
      const clWs = XLSX.utils.aoa_to_sheet([clHeaders, ...clRows]);
      clWs['!cols'] = [{ wch: 35 }, { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, clWs, 'Issue Clusters');
    }

    // Sheet 5: Host Flags
    const flags = reportData?.host_accountability_flags;
    if (Array.isArray(flags) && flags.length > 0) {
      const fHeaders = ['Flag', 'Severity', 'Member Count'];
      const fRows = flags.map((f: any) => {
        const flag = typeof f === 'string' ? f : f.flag || f.issue || f.description || '';
        const sev = typeof f === 'object' ? (f.severity || '') : '';
        const cnt = typeof f === 'object' ? (f.member_count || f.count || '') : '';
        return [flag, sev, cnt];
      });
      const fWs = XLSX.utils.aoa_to_sheet([fHeaders, ...fRows]);
      fWs['!cols'] = [{ wch: 60 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, fWs, 'Host Flags');
    }

    // Sheet 6: Actions
    const actions = reportData?.top_actions;
    if (actions) {
      const aHeaders = ['Priority', 'Action', 'Impact', 'Owner', 'Effort'];
      const aRows: any[][] = [];
      const flattenActions = (obj: any): any[] => {
        if (Array.isArray(obj)) return obj;
        if (typeof obj === 'object') return Object.values(obj).flat();
        return [];
      };
      flattenActions(actions).forEach((a: any) => {
        aRows.push([a.priority || '', a.action || '', a.impact || '', a.owner || '', a.effort || '']);
      });
      if (aRows.length > 0) {
        const aWs = XLSX.utils.aoa_to_sheet([aHeaders, ...aRows]);
        aWs['!cols'] = [{ wch: 8 }, { wch: 50 }, { wch: 30 }, { wch: 20 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, aWs, 'Actions');
      }
    }

    if (records.length >= 20) addStatsSheet(wb, records);

    const filename = `PadSplit-FullReport-${dateStr()}.xlsx`;
    downloadWorkbook(wb, filename);
    toast.dismiss(toastId);
    toast.success(`Full report exported (${records.length} members)`);
  } catch (err: any) {
    toast.dismiss(toastId);
    toast.error('Export failed: ' + (err.message || 'Unknown error'));
  }
}

export async function exportSelectedRecords(records: ExportRecord[], title: string) {
  const toastId = toast.loading('Generating export...');
  try {
    const wb = XLSX.utils.book_new();
    addSummarySheet(wb, title, title, records);
    addMemberSheet(wb, records);
    if (records.length >= 20) addStatsSheet(wb, records);
    const filename = `PadSplit-${title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)}-${dateStr()}.xlsx`;
    downloadWorkbook(wb, filename);
    toast.dismiss(toastId);
    toast.success(`Exported ${records.length} records`);
  } catch (err: any) {
    toast.dismiss(toastId);
    toast.error('Export failed');
  }
}
