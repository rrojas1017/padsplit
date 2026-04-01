// Shared cluster mapping for reason codes from research insights

export const CLUSTER_COLORS: Record<string, string> = {
  'Host Negligence / Property Condition': '#e53e3e',
  'Payment Friction / Financial Hardship': '#dd6b20',
  'Roommate Conflict / Safety Concern': '#d69e2e',
  'Communication Breakdown / Support Dissatisfaction': '#805ad5',
  'Policy Confusion / Lack of Flexibility': '#3182ce',
  'External Life Event / Positive Move-On': '#38a169',
  'Data Error / Invalid Record': '#a0aec0',
  'Other / Unspecified': '#718096',
};

export const CLUSTER_ORDER = [
  'Host Negligence / Property Condition',
  'Payment Friction / Financial Hardship',
  'Roommate Conflict / Safety Concern',
  'Communication Breakdown / Support Dissatisfaction',
  'Policy Confusion / Lack of Flexibility',
  'External Life Event / Positive Move-On',
  'Data Error / Invalid Record',
  'Other / Unspecified',
];

export const ADDRESSABILITY_COLORS: Record<string, string> = {
  'Addressable': '#e53e3e',
  'Partially Addressable': '#dd6b20',
  'Not Addressable': '#38a169',
};

export const ADDRESSABILITY_ORDER = ['Addressable', 'Partially Addressable', 'Not Addressable'];

export const ADDRESSABILITY_DESCRIPTIONS: Record<string, string> = {
  'Addressable': 'PadSplit could have prevented these move-outs with better processes or intervention',
  'Partially Addressable': 'Some opportunity to intervene — improved experience could have helped',
  'Not Addressable': 'Life events and positive moves — nothing PadSplit could have done differently',
};

export function normalizeAddressability(value: string): 'Addressable' | 'Partially Addressable' | 'Not Addressable' {
  if (!value) return 'Not Addressable';
  const v = value.toLowerCase().replace(/[_\-]/g, ' ').trim();

  if (v === 'addressable' || v === 'highly addressable' || v === 'high' ||
      v === 'true' || v.startsWith('addressable')) {
    return 'Addressable';
  }

  if (v.includes('partial')) {
    return 'Partially Addressable';
  }

  return 'Not Addressable';
}

const SUB_REASON_MAPS: Record<string, [string, string[]][]> = {
  'Host Negligence / Property Condition': [
    ['Mold / Pest Infestation', ['mold', 'pest', 'roach', 'mice', 'rat', 'bug', 'bedbug', 'bed bug', 'rodent', 'insect']],
    ['Maintenance / Repairs Ignored', ['broken', 'repair', 'maintenance', 'fix', 'leak', 'plumbing', 'hvac', 'air condition', 'heat', 'water']],
    ['Unsanitary / Dirty Conditions', ['dirty', 'filthy', 'clean', 'unsanitary', 'trash', 'garbage', 'smell', 'odor']],
    ['Host Unresponsive', ['host unresponsive', "host didn't", "host won't", 'host never', 'host refused', "couldn't reach host", 'no response from host', 'landlord']],
    ['Overcrowding / Illegal Conversion', ['overcrowd', 'too many', 'converted', 'illegal', 'capacity']],
    ['Eviction by Host', ['notice to vacate', 'kicked out', 'asked to leave', 'evict', 'told to leave']],
    ['Misrepresentation', ['misrepresent', 'not as advertised', 'false', 'misleading', 'different from', 'not what']],
  ],
  'Payment Friction / Financial Hardship': [
    ['Rent Too High / Increase', ['rent increase', 'too high', 'too expensive', 'rent went up', 'afford', 'price', 'cost', '$1']],
    ['Late Fees / Collections', ['late fee', 'collection', 'penalty', 'sent to collections']],
    ['Billing / Payment Issues', ['billing', 'charged', 'overcharge', 'payment issue', 'refund', 'double charge', 'autopay']],
  ],
  'Roommate Conflict / Safety Concern': [
    ['Noise / Cleanliness', ['noise', 'loud', 'dirty roommate', 'messy', 'clean up', 'dishes']],
    ['Harassment / Theft / Drugs', ['harass', 'theft', 'stole', 'drug', 'smoking', 'alcohol', 'substance']],
    ['Safety Fears', ['safety', 'unsafe', 'scared', 'threatened', 'assault', 'weapon', 'violent', 'fight']],
  ],
  'Communication Breakdown / Support Dissatisfaction': [
    ['Poor Customer Support', ['support', 'customer service', 'help desk', 'ticket', 'no help']],
    ['Platform / App Issues', ['app', 'platform', 'website', 'technology', 'glitch', 'bug', 'login']],
    ['Lack of Communication', ['no communication', 'never heard', 'no response', 'ignored', 'didn\'t respond']],
  ],
  'Policy Confusion / Lack of Flexibility': [
    ['House Rules Disputes', ['house rule', 'guest', 'visitor', 'curfew', 'quiet hours']],
    ['Lease / Policy Unclear', ['policy', 'lease', 'contract', 'terms', 'rules', 'flexibility']],
  ],
  'External Life Event / Positive Move-On': [
    ['Buying a Home', ['buying', 'purchased', 'own place', 'own apartment', 'homeowner', 'closing']],
    ['Job Relocation', ['relocat', 'new job', 'job transfer', 'moving for work', 'employment', 'work opportunity']],
    ['Family / Personal', ['family', 'personal', 'relationship', 'married', 'baby', 'spouse', 'partner', 'child']],
    ['Found Better Housing', ['found somewhere', 'better place', 'facebook marketplace', 'cheaper', 'better option', 'own space', 'needed space']],
  ],
  'Data Error / Invalid Record': [
    ['Wrong Person / Never Moved', ['wrong person', 'never moved', 'identity', 'not me', 'never lived']],
    ['Invalid / Incomplete Data', ['invalid', 'incomplete', 'no data', 'blank', 'test']],
  ],
};

export function extractSubReason(cluster: string, caseBrief: string): string {
  const map = SUB_REASON_MAPS[cluster];
  if (!map || !caseBrief) return cluster;
  const brief = caseBrief.toLowerCase();
  for (const [label, keywords] of map) {
    if (keywords.some(kw => brief.includes(kw))) return label;
  }
  return 'Other ' + cluster.split(' / ')[0];
}

export function mapToCluster(primaryReasonCode: string): string {
  const code = primaryReasonCode.toLowerCase().replace(/[_\-\/]/g, ' ').trim();

  // Data Error / Invalid Record — check first
  if (code.includes('data error') || code.includes('invalid') || code.includes('identity theft') ||
      code.includes('wrong person') || code.includes('never moved') || code.includes('never a member')) {
    return 'Data Error / Invalid Record';
  }

  if (code.includes('host') || code.includes('property') || code.includes('maintenance') ||
      code.includes('uninhabitable') || code.includes('mold') || code.includes('pest') ||
      code.includes('negligence') || code.includes('misrepresentation')) {
    return 'Host Negligence / Property Condition';
  }

  if (code.includes('payment') || code.includes('financial') || code.includes('collection') ||
      code.includes('billing') || code.includes('afford') || code.includes('pricing') ||
      code.includes('fee') || code.includes('refund') || code.includes('hardship')) {
    return 'Payment Friction / Financial Hardship';
  }

  if (code.includes('roommate') || code.includes('safety') || code.includes('noise') ||
      code.includes('cleanliness') || code.includes('conflict') || code.includes('assault') ||
      code.includes('member safety')) {
    return 'Roommate Conflict / Safety Concern';
  }

  if (code.includes('communication') || code.includes('support') || code.includes('dissatisfaction') ||
      code.includes('process') || code.includes('platform') || code.includes('product') ||
      code.includes('technology')) {
    return 'Communication Breakdown / Support Dissatisfaction';
  }

  if (code.includes('policy') || code.includes('flexibility') || code.includes('rules') ||
      code.includes('guest') || code.includes('house rules')) {
    return 'Policy Confusion / Lack of Flexibility';
  }

  if (code.includes('buying') || code.includes('home') || code.includes('relocation') ||
      code.includes('family') || code.includes('graduation') || code.includes('life event') ||
      code.includes('personal') || code.includes('employment') || code.includes('health') ||
      code.includes('military') || code.includes('positive') || code.includes('move on') ||
      code.includes('move up') || code.includes('planned') || code.includes('found') ||
      code.includes('better') || code.includes('external') || code.includes('life change') ||
      code.includes('preference') || code.includes('member life')) {
    return 'External Life Event / Positive Move-On';
  }

  return 'Other / Unspecified';
}
