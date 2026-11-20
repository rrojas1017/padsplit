// CR-020: build the call panel's Booking from an already-loaded survey record.
// Pure — no I/O, no logging. No new reads.
import type { Booking } from '@/types';
import type { ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { callerIdentity, isRealCallerName } from '@/utils/callerIdentity';
import { maskPhone } from '@/utils/contactPrivacy';

const STATUSES = ['pending', 'processing', 'completed', 'failed', 'unavailable'] as const;

/** Header identity text (R1 + masking), same rule as ResearchCallPanel / RespondentsSheet. */
export function recordIdentityText(r: Pick<ScriptSurveyRecord, 'member_name' | 'contact_phone'>, maskContact: boolean): string {
  if (isRealCallerName(r.member_name)) return (r.member_name as string).trim();
  if (maskContact) return r.contact_phone ? maskPhone(r.contact_phone) : 'Unknown caller';
  return callerIdentity({ name: null, phone: r.contact_phone }).primary;
}

/** Booking for ResearchCallPanel: memberName is the real name only (panel applies R1 itself). */
export function recordToPanelBooking(r: ScriptSurveyRecord): Booking {
  const status = (STATUSES as readonly string[]).includes(r.transcription_status ?? '')
    ? (r.transcription_status as Booking['transcriptionStatus']) : undefined;
  return {
    id: r.booking_id,
    moveInDate: null,
    bookingDate: new Date(`${r.booking_date}T00:00:00`),
    memberName: isRealCallerName(r.member_name) ? (r.member_name as string).trim() : '',
    bookingType: 'Research',
    agentId: r.agent_id ?? '',
    agentName: '',
    marketCity: '',
    marketState: '',
    communicationMethod: 'Phone',
    status: 'Research',
    recordType: 'research',
    researchCallId: r.research_call_id ?? undefined,
    contactPhone: r.contact_phone,
    callDurationSeconds: r.call_duration_seconds ?? undefined,
    kixieLink: r.kixie_link ?? undefined,
    transcriptionStatus: status,
  } as Booking;
}

/** Booking for TranscriptionModal: memberName = header identity text (never a placeholder). */
export function recordToTranscriptBooking(r: ScriptSurveyRecord, maskContact: boolean): Booking {
  return { ...recordToPanelBooking(r), memberName: recordIdentityText(r, maskContact) };
}
