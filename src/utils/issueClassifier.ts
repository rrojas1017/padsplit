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

// Keyword patterns for each category (tightened to reduce false positives)
const ISSUE_KEYWORDS: Record<IssueCategory, string[]> = {
  'Payment & Pricing Confusion': [
    'promo code', 'deposit', 'weekly rate', 'how much', 'move-in cost',
    'coupon', 'discount', 'billing', 'pricing', 'overcharged', 'hidden fee',
    'price confused', 'not sure about the price', 'weekly payment', 'first week',
  ],
  'Booking Process Issues': [
    'how to book', 'confus', 'trouble booking', "can't figure out",
    'hard to navigate', 'stuck on', 'book a room', 'reserve',
  ],
  'Host & Approval Concerns': [
    'approval', 'approv', 'reject', 'landlord', 'denied', 'pending approval',
    "haven't heard back", 'no response', 'still waiting', 'property manager',
  ],
  'Trust & Legitimacy': [
    'scam', 'legit', 'trust', 'fraud', 'concern about company', 'suspicious',
    'legitimate', 'sketchy', 'too good to be true', 'is this a scam',
    'can i trust', 'is this real', 'reviews', 'reputation',
  ],
  'Transportation Barriers': [
    'transport', 'bus', 'transit', 'commute', 'far from', 'too far',
    'close to work', 'near work', 'no transportation', "can't get there", 'public transit',
  ],
  'Move-In Barriers': [
    'background check', 'credit check', 'screening', 'eviction',
    'when can i move', 'criminal', 'failed background', 'denied screening',
    'move-in', 'move in',
  ],
  'Property & Amenity Mismatch': [
    'noisy', 'neighborhood', 'too small', "doesn't have", 'no parking',
    'not what i expected', 'wrong room', 'amenity',
  ],
  'Financial Constraints': [
    'budget', "can't afford", 'too expensive', 'unemploy', 'cheaper',
    'low income', 'fixed income', 'disability', 'ssi', 'ssdi',
    'not enough money', "can't pay",
  ],
};

/**
 * Classify text into standardized issue categories using keyword matching.
 * Only scans memberConcerns and objections (not summary/preferences).
 * Requires 2+ keyword matches per category to reduce false positives.
 */
export function classifyIssues(params: {
  memberConcerns?: string[];
  objections?: string[];
  summary?: string;
  memberPreferences?: string[];
}): string[] {
  const { memberConcerns = [], objections = [] } = params;

  const allText = [...memberConcerns, ...objections].join(' ').toLowerCase();

  if (!allText.trim()) return [];

  const detected: string[] = [];

  for (const [category, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    const matchCount = keywords.filter(keyword => allText.includes(keyword.toLowerCase())).length;
    if (matchCount >= 2) {
      detected.push(category);
    }
  }

  return detected;
}
