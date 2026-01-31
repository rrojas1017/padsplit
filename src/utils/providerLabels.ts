// Role-based provider and service label mapping
// Super admins see technical provider names; others see generic labels

export const SUPER_ADMIN_PROVIDER_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  deepgram: 'Deepgram',
  lovable_ai: 'Lovable AI (Gemini)',
  google_tts: 'Google Cloud TTS',
};

export const GENERIC_PROVIDER_LABELS: Record<string, string> = {
  elevenlabs: 'Voice Services',
  deepgram: 'Voice Services',
  lovable_ai: 'AI Services',
  google_tts: 'Voice Services',
};

export function getProviderLabel(provider: string, isSuperAdmin: boolean): string {
  const labels = isSuperAdmin ? SUPER_ADMIN_PROVIDER_LABELS : GENERIC_PROVIDER_LABELS;
  return labels[provider] || provider;
}

export const SUPER_ADMIN_SERVICE_LABELS: Record<string, string> = {
  stt_transcription: 'Speech-to-Text (ElevenLabs)',
  tts_coaching: 'Text-to-Speech (ElevenLabs)',
  tts_qa_coaching: 'Text-to-Speech (ElevenLabs)',
  ai_analysis: 'AI Analysis (Gemini)',
  ai_coaching: 'AI Coaching (Gemini)',
  ai_qa_scoring: 'AI QA Scoring (Gemini)',
  ai_member_insights: 'AI Member Insights (Gemini)',
  ai_reanalysis: 'AI Re-Analysis (Gemini)',
};

export const GENERIC_SERVICE_LABELS: Record<string, string> = {
  stt_transcription: 'Call Transcription',
  tts_coaching: 'Coaching Audio',
  tts_qa_coaching: 'QA Coaching Audio',
  ai_analysis: 'AI Analysis',
  ai_coaching: 'AI Coaching',
  ai_qa_scoring: 'AI QA Scoring',
  ai_member_insights: 'AI Member Insights',
  ai_reanalysis: 'AI Re-Analysis',
};

export function getServiceTypeLabel(serviceType: string, isSuperAdmin: boolean): string {
  const labels = isSuperAdmin ? SUPER_ADMIN_SERVICE_LABELS : GENERIC_SERVICE_LABELS;
  return labels[serviceType] || serviceType;
}

// Provider color classes for badges (role-agnostic)
export const PROVIDER_BADGE_COLORS: Record<string, string> = {
  elevenlabs: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  deepgram: 'bg-green-500/10 text-green-600 border-green-500/20',
  lovable_ai: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  voice_services: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  ai_services: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export function getProviderBadgeColor(provider: string): string {
  return PROVIDER_BADGE_COLORS[provider] || 'bg-muted text-muted-foreground';
}
