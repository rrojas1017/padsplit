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
