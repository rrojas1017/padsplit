export type CampaignType = 'move_out_survey' | 'audience_survey' | 'unknown';

const SCRIPT_MAP: Record<string, CampaignType> = {
  '6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey',
  '12fd2184-68af-4502-9f8e-9fc9fcef1214': 'audience_survey',
};

const CAMPAIGN_TYPE_MAP: Record<string, CampaignType> = {
  satisfaction: 'move_out_survey',
  move_out_survey: 'move_out_survey',
  audience_survey: 'audience_survey',
};

const AUDIENCE_MAP: Record<string, CampaignType> = {
  existing_member: 'move_out_survey',
  active_member: 'audience_survey',
};

const MOVE_OUT_KEYWORDS = [
  'reason you decided to move out',
  'move-out',
  'move out',
  'leaving padsplit',
  'decided to leave',
];

const AUDIENCE_KEYWORDS = [
  'social media platforms',
  'padsplit ads',
  'scroll through social media',
  'standout ads',
  'influencer',
];

interface DetectOptions {
  script_id?: string | null;
  campaign_type?: string | null;
  audience?: string | null;
  transcript?: string | null;
}

export function detectCampaignType(opts: DetectOptions): CampaignType {
  if (opts.script_id && SCRIPT_MAP[opts.script_id]) {
    return SCRIPT_MAP[opts.script_id];
  }

  if (opts.campaign_type && CAMPAIGN_TYPE_MAP[opts.campaign_type]) {
    return CAMPAIGN_TYPE_MAP[opts.campaign_type];
  }

  if (opts.audience && AUDIENCE_MAP[opts.audience]) {
    return AUDIENCE_MAP[opts.audience];
  }

  if (opts.transcript) {
    const lower = opts.transcript.toLowerCase();
    if (MOVE_OUT_KEYWORDS.some((kw) => lower.includes(kw))) return 'move_out_survey';
    if (AUDIENCE_KEYWORDS.some((kw) => lower.includes(kw))) return 'audience_survey';
  }

  return 'unknown';
}

const LABELS: Record<CampaignType, string> = {
  move_out_survey: 'Move-Out Research',
  audience_survey: 'Audience Survey',
  unknown: 'Unknown',
};

export function getCampaignLabel(type: CampaignType): string {
  return LABELS[type] ?? 'Unknown';
}

export function isQualitativeCampaign(type: CampaignType): boolean {
  return type === 'move_out_survey';
}
