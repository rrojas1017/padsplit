// Same routing rule as submit-public-script / persist-research-raw-answers
// (resolveResearchCampaignType). Keep in sync with those functions.
const ROUTE_SCRIPT_ID_MAP: Record<string, string> = {
  '6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey',
  'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
};

export const BUILTIN_RESEARCH_TYPES = ['move_out_survey', 'payment_experience', 'audience_survey'] as const;

export function resolveResearchCampaignType(script: { id: string; slug?: string | null } | null): string | null {
  if (!script?.id) return null;
  if (ROUTE_SCRIPT_ID_MAP[script.id]) return ROUTE_SCRIPT_ID_MAP[script.id];
  if (script.slug && ['payment_experience', 'audience_survey'].includes(script.slug)) return script.slug;
  return script.slug || `script_${String(script.id).slice(0, 8)}`;
}

export function isBuiltinResearchType(type: string | null | undefined): boolean {
  return !!type && (BUILTIN_RESEARCH_TYPES as readonly string[]).includes(type);
}

const SHORT_LABELS: Record<string, string> = {
  move_out_survey: 'Move-Out',
  audience_survey: 'Audience',
  payment_experience: 'Payment',
};

const LONG_LABELS: Record<string, string> = {
  move_out_survey: 'Move-Out Survey',
  audience_survey: 'Audience Survey',
  payment_experience: 'Payment Experience',
};

/** Table label: short built-in names, script name for known scripts, else raw type. */
export function researchCampaignLabel(
  type: string | null | undefined,
  scriptLabels: Record<string, string>,
  variant: 'short' | 'long' = 'short',
): string {
  if (!type) return '';
  const builtin = (variant === 'long' ? LONG_LABELS : SHORT_LABELS)[type];
  if (builtin) return builtin;
  return scriptLabels[type] ?? type;
}
