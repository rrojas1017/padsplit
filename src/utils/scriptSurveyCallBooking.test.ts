// @ts-nocheck — run with `bun test src/utils/scriptSurveyCallBooking.test.ts`
import { describe, expect, test } from 'bun:test';
import { recordToPanelBooking, recordToTranscriptBooking, recordIdentityText } from './scriptSurveyCallBooking';
import { maskPhone } from './contactPrivacy';

const base = {
  id: 'bt1', booking_id: 'b1', booking_date: '2026-10-05', call_duration_seconds: 125, has_valid_conversation: true,
  transcription_status: 'completed', kixie_link: 'https://rec/x.mp3', research_call_id: 'rc1', research_processing_status: null,
  survey_progress: null, answers: {}, answeredCount: 1, isForm: false, hasRecording: true, campaign_id: null, list_id: null,
  member_name: 'Jane Doe', contact_phone: '+119569541807', agent_id: 'a1',
};

describe('CR-020 record → call panel booking', () => {
  test('maps fields', () => {
    const b = recordToPanelBooking(base);
    expect(b.id).toBe('b1');
    expect(b.bookingDate.getFullYear()).toBe(2026);
    expect(b.bookingDate.getMonth()).toBe(9);
    expect(b.bookingDate.getDate()).toBe(5);
    expect(b.memberName).toBe('Jane Doe');
    expect(b.agentId).toBe('a1');
    expect(b.callDurationSeconds).toBe(125);
    expect(b.kixieLink).toBe('https://rec/x.mp3');
    expect(b.transcriptionStatus).toBe('completed');
    expect(b.researchCallId).toBe('rc1');
    expect(b.contactPhone).toBe('+119569541807');
  });
  test('placeholder name → formatted phone (never the placeholder)', () => {
    const r = { ...base, member_name: 'API Submission 2026-10-05' };
    expect(recordToPanelBooking(r).memberName).toBe('');
    expect(recordToTranscriptBooking(r, false).memberName).toBe('(956) 954-1807');
  });
  test('masked user → masked phone', () => {
    const r = { ...base, member_name: 'Public Submission' };
    expect(recordToTranscriptBooking(r, true).memberName).toBe(maskPhone('+119569541807'));
    expect(recordToTranscriptBooking(r, true).memberName).not.toContain('9541807');
  });
  test('no name, no phone → Unknown caller', () => {
    expect(recordIdentityText({ member_name: null, contact_phone: null }, false)).toBe('Unknown caller');
    expect(recordIdentityText({ member_name: null, contact_phone: null }, true)).toBe('Unknown caller');
  });
});
