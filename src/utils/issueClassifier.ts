// Standardized pain point issue categories and keyword-based classifier

export const ISSUE_CATEGORIES = [
  'Payment & Pricing Confusion',
  'Booking Process Issues',
  'Host & Approval Concerns',
  'Trust & Legitimacy',
  'Transportation Barriers',
  'Move-In Barriers',
  'Property & Amenity Mismatch',
  'Financial Constraints',
] as const;

export type IssueCategory = typeof ISSUE_CATEGORIES[number];

// Icon and color mapping for issue badges
export const ISSUE_BADGE_CONFIG: Record<string, { color: string; icon: string }> = {
  'Payment & Pricing Confusion': { color: 'bg-amber-500/15 text-amber-600 border-amber-500/20', icon: 'CreditCard' },
  'Booking Process Issues': { color: 'bg-blue-500/15 text-blue-600 border-blue-500/20', icon: 'MousePointerClick' },
  'Host & Approval Concerns': { color: 'bg-orange-500/15 text-orange-600 border-orange-500/20', icon: 'Home' },
  'Trust & Legitimacy': { color: 'bg-red-500/15 text-red-600 border-red-500/20', icon: 'ShieldAlert' },
  'Transportation Barriers': { color: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/20', icon: 'Car' },
  'Move-In Barriers': { color: 'bg-violet-500/15 text-violet-600 border-violet-500/20', icon: 'Calendar' },
  'Property & Amenity Mismatch': { color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20', icon: 'Building2' },
  'Financial Constraints': { color: 'bg-rose-500/15 text-rose-600 border-rose-500/20', icon: 'DollarSign' },
};

// Keyword patterns for each category
const ISSUE_KEYWORDS: Record<IssueCategory, string[]> = {
  'Payment & Pricing Confusion': [
    'payment', 'promo', 'deposit', 'weekly rate', 'cost', 'price', 'fee', 'afford',
    'promo code', 'coupon', 'discount', 'billing', 'charge', 'pay', 'pricing',
    'weekly payment', 'first week', 'move-in cost', 'how much',
  ],
  'Booking Process Issues': [
    'booking', 'navigate', 'website', 'platform', 'listing', 'process', 'confus',
    'sign up', 'signup', 'register', 'account', 'app', 'application', 'apply',
    'how to book', 'book a room', 'reserve',
  ],
  'Host & Approval Concerns': [
    'host', 'approval', 'approv', 'reject', 'landlord', 'response', 'wait',
    'accepted', 'denied', 'pending approval', 'owner', 'property manager',
  ],
  'Trust & Legitimacy': [
    'scam', 'legit', 'trust', 'safe', 'real', 'fraud', 'concern about company',
    'suspicious', 'legitimate', 'verify', 'too good to be true', 'sketchy',
    'is this real', 'reviews', 'reputation',
  ],
  'Transportation Barriers': [
    'transport', 'drive', 'car', 'bus', 'transit', 'distance', 'commute', 'far from',
    'uber', 'lyft', 'ride', 'walk', 'bike', 'train', 'subway', 'public transit',
    'too far', 'close to work', 'near work',
  ],
  'Move-In Barriers': [
    'move-in', 'move in', 'background check', 'document', 'timing', 'ready', 'schedule',
    'when can i move', 'available', 'id', 'identification', 'credit check',
    'criminal', 'eviction', 'screening',
  ],
  'Property & Amenity Mismatch': [
    'room', 'amenity', 'size', 'location', 'neighborhood', 'noisy', 'space',
    'bathroom', 'kitchen', 'parking', 'furnished', 'utilities', 'wifi', 'laundry',
    'shared', 'private', 'small', 'condition', 'clean',
  ],
  'Financial Constraints': [
    'budget', 'income', 'afford', 'expensive', 'money', 'unemploy', 'verification',
    'job', 'employment', 'paycheck', 'financial', 'can\'t afford', 'too expensive',
    'cheaper', 'low income', 'fixed income', 'disability', 'ssi', 'ssdi',
  ],
};

/**
 * Classify text into standardized issue categories using keyword matching.
 * Scans memberConcerns, objections, summary, and memberPreferences.
 */
export function classifyIssues(params: {
  memberConcerns?: string[];
  objections?: string[];
  summary?: string;
  memberPreferences?: string[];
}): string[] {
  const { memberConcerns = [], objections = [], summary = '', memberPreferences = [] } = params;

  // Combine all text sources into a single searchable string
  const allText = [
    ...memberConcerns,
    ...objections,
    summary,
    ...memberPreferences,
  ].join(' ').toLowerCase();

  if (!allText.trim()) return [];

  const detected: string[] = [];

  for (const [category, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    const matched = keywords.some(keyword => allText.includes(keyword.toLowerCase()));
    if (matched) {
      detected.push(category);
    }
  }

  return detected;
}
