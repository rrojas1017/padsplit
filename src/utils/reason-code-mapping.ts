// Shared cluster mapping for reason codes from research insights

export const CLUSTER_COLORS: Record<string, string> = {
  'Host Negligence / Property Condition': '#e53e3e',
  'Payment Friction / Financial Hardship': '#dd6b20',
  'Roommate Conflict / Safety Concern': '#d69e2e',
  'Communication Breakdown / Support Dissatisfaction': '#805ad5',
  'Policy Confusion / Lack of Flexibility': '#3182ce',
  'External Life Event / Positive Move-On': '#38a169',
  'Other / Unspecified': '#718096',
};

export const CLUSTER_ORDER = [
  'Host Negligence / Property Condition',
  'Payment Friction / Financial Hardship',
  'Roommate Conflict / Safety Concern',
  'Communication Breakdown / Support Dissatisfaction',
  'Policy Confusion / Lack of Flexibility',
  'External Life Event / Positive Move-On',
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

export function mapToCluster(primaryReasonCode: string): string {
  const code = primaryReasonCode.toLowerCase().replace(/[_\-\/]/g, ' ').trim();

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
