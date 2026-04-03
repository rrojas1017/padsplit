import type { AggResult } from '@/hooks/useAudienceSurveyResponses';

/**
 * Convert raw database values (snake_case, camelCase, or raw strings)
 * into human-readable labels for charts and tables.
 */
export function formatLabel(raw: string): string {
  if (!raw) return 'Unknown';

  const LABEL_MAP: Record<string, string> = {
    'short_video': 'Short Video',
    'long_video': 'Long Video',
    'static_image': 'Static Image',
    'carousel': 'Carousel',
    'story_ad': 'Story Ad',
    'reel': 'Reel',
    'ugc': 'User-Generated Content',
    'influencer_content': 'Influencer Content',
    'testimonial': 'Testimonial',
    'price_comparison': 'Price Comparison',
    'room_walkthrough': 'Room Walkthrough',
    'member_story': 'Member Story',
    'how_it_works': 'How It Works',
    'clear_explanation_how_it_works': 'Clear Explanation of How It Works',
    'safety_security': 'Safety & Security',
    'safety/security': 'Safety & Security',
    'price_fees': 'Price & Fees',
    'price/fees': 'Price & Fees',
    'affordable_rent': 'Affordable Rent',
    'utilities_included': 'Utilities Included',
    'no_long_term_lease': 'No Long-Term Lease',
    'move_in_quickly': 'Quick Move-In',
    'location_options': 'Location Options',
    'community_roommates': 'Community of Roommates',
    'roommate_matching': 'Roommate Matching',
    'lease_flexibility': 'Lease Flexibility',
    'lease_rules': 'Lease Rules & Policies',
    'payment_process': 'Payment Process',
    'how_payments_work': 'How Payments Work',
    'what_included_rent': "What's Included in Rent",
    'nothing_confusing': 'Nothing Was Confusing',
    'special_offer': 'Special Offer or Discount',
    'relatable_story': 'Relatable Story',
    'humor_entertainment': 'Humor or Entertainment',
    'clear_pricing': 'Clear Pricing',
    'recommendation_testimonial': 'Recommendation/Testimonial',
    'high_quality_visuals': 'High-Quality Visuals',
    'strong_headline': 'Strong Headline',
    'first_month_discount': 'First Month Discount',
    'lower_move_in_fees': 'Lower Move-In Fees',
    'referral_bonuses': 'Referral Bonuses',
    'limited_time_offer': 'Limited-Time Offer',
    'member_experience': 'Member Experience Content',
    'real_member_stories': 'Real Member Stories',
    'video_walkthrough': 'Video Walkthrough of Rooms',
    'short_entertaining': 'Short & Entertaining Content',
    'rooms_prices_area': 'Rooms & Prices in Your Area',
    'give_more_detail': 'Give More Detail',
    'keep_short_simple': 'Keep It Short & Simple',
    'depends_platform': 'Depends on Platform',
    'not_sure': 'Not Sure',
    'facebook_groups': 'Facebook Groups',
    'facebook_groups_to_find_housing': 'Facebook Groups (Housing)',
    'x_twitter': 'X (Twitter)',
  };

  const lower = raw.toLowerCase().trim();
  if (LABEL_MAP[lower]) return LABEL_MAP[lower];

  // Already human-readable
  if (raw.includes(' ') && raw[0] === raw[0].toUpperCase()) return raw;

  // Convert snake_case/camelCase to Title Case
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Normalize raw survey response values into canonical labels.
 * Merges synonyms, fixes plural/singular, and combines split concepts.
 * Run this on every value BEFORE aggregation.
 */
export function normalizeLabel(raw: string): string {
  if (!raw) return 'Unknown';

  const trimmed = raw.trim();

  const SYNONYMS: Record<string, string> = {
    // Safety & Security (one concept in original survey)
    'safety': 'Safety & Security',
    'security': 'Safety & Security',
    'safety/security': 'Safety & Security',
    'safety / security': 'Safety & Security',
    'safety_security': 'Safety & Security',
    'safety and security': 'Safety & Security',
    'safety/security emphasis': 'Safety & Security',
    'security issues': 'Safety & Security',
    'security concern': 'Safety & Security',
    'safety concern': 'Safety & Security',
    'safety concerns': 'Safety & Security',
    'security concerns': 'Safety & Security',

    // Quality
    'quality of the rooms': 'Quality of Rooms/Houses',
    'quality of the room': 'Quality of Rooms/Houses',
    'quality of rooms': 'Quality of Rooms/Houses',
    'quality of the rooms/houses': 'Quality of Rooms/Houses',
    'quality of rooms/houses': 'Quality of Rooms/Houses',
    'quality': 'Quality of Rooms/Houses',
    'room quality': 'Quality of Rooms/Houses',

    // Roommates
    'who my roommates would be': 'Roommate Concerns',
    'roommate concerns': 'Roommate Concerns',
    'roommates': 'Roommate Concerns',
    'roommate': 'Roommate Concerns',
    'how roommates are matched': 'Roommate Matching',
    'roommate matching': 'Roommate Matching',

    // Pricing
    'price/fees': 'Price & Fees',
    'price / fees': 'Price & Fees',
    'price_fees': 'Price & Fees',
    'pricing': 'Price & Fees',
    'price': 'Price & Fees',
    'fees': 'Price & Fees',
    'cost': 'Price & Fees',
    'costs': 'Price & Fees',
    'expensive': 'Price & Fees',

    // How it works
    'how it actually works': 'How It Works',
    'how it works': 'How It Works',
    'how does it work': 'How It Works',
    'how_it_works': 'How It Works',

    // Location
    'location': 'Location Options',
    'locations': 'Location Options',
    'location options': 'Location Options',

    // Lease
    'lease flexibility': 'Lease Flexibility',
    'lease': 'Lease Flexibility',
    'lease terms': 'Lease Flexibility',
    'lease rules and policies': 'Lease Rules & Policies',
    'lease rules': 'Lease Rules & Policies',
    'lease_rules': 'Lease Rules & Policies',

    // Payments
    'how payments work': 'How Payments Work',
    'how the payment works': 'How Payments Work',
    'payment process': 'How Payments Work',
    'payment-wise': 'How Payments Work',
    'payments': 'How Payments Work',
    'payment': 'How Payments Work',

    // Rent inclusions
    'what is included in the rent': "What's Included in Rent",
    "what's included in rent": "What's Included in Rent",
    'what included in rent': "What's Included in Rent",
    'lack of clarity on utilities included': "What's Included in Rent",

    // Interest drivers (Q9)
    'affordable rent': 'Affordable Rent',
    'flexibility': 'Flexibility',
    'ability to move in quickly': 'Quick Move-In',
    'move in quickly': 'Quick Move-In',
    'utilities included': 'Utilities Included',
    'joining a community of roommates': 'Community of Roommates',
    'community of roommates': 'Community of Roommates',

    // Nothing confusing (Q10)
    'nothing was confusing': 'Nothing Was Confusing',
    'nothing confusing': 'Nothing Was Confusing',
    'nothing': 'Nothing Was Confusing',

    // Ad attention triggers (Q6)
    'a special offer or discount': 'Special Offer/Discount',
    'special offer or discount': 'Special Offer/Discount',
    'special offer': 'Special Offer/Discount',
    'discount': 'Special Offer/Discount',
    'a relatable story or situation': 'Relatable Story',
    'relatable story': 'Relatable Story',
    'humor or entertainment': 'Humor/Entertainment',
    'humor': 'Humor/Entertainment',
    'clear pricing': 'Clear Pricing',
    'a recommendation or testimonial': 'Testimonial/Recommendation',
    'recommendation or testimonial': 'Testimonial/Recommendation',
    'high-quality visuals': 'High-Quality Visuals',
    'high_quality_visuals': 'High-Quality Visuals',
    'a strong headline': 'Strong Headline',
    'strong headline': 'Strong Headline',

    // Click motivators (Q7)
    'first month discount': 'First Month Discount',
    'first-month discount': 'First Month Discount',
    '1st month discount': 'First Month Discount',
    'lower move-in fees': 'Lower Move-In Fees',
    'lower move-in fee': 'Lower Move-In Fees',
    'lower move in fees': 'Lower Move-In Fees',
    'lower moving fees': 'Lower Move-In Fees',
    'lower moving fee': 'Lower Move-In Fees',
    'referral bonuses': 'Referral Bonuses',
    'referral bonus': 'Referral Bonuses',
    'no long-term lease message': 'No Long-Term Lease',
    'no long-term lease': 'No Long-Term Lease',
    'no long term lease': 'No Long-Term Lease',
    'all utilities included message': 'All Utilities Included',
    'all utilities included': 'All Utilities Included',
    'limited-time offer': 'Limited-Time Offer',
    "content about a padsplit member's experience": 'Member Experience Content',

    // Affordability (Q7/Q9 crossover)
    'affordability': 'Affordable Rent',

    // Ad content preferences (Q12)
    'real member stories/testimonials': 'Real Member Stories',
    'real member stories': 'Real Member Stories',
    'price comparisons vs. renting an apartment': 'Price Comparison vs Apartment',
    'price comparisons': 'Price Comparison vs Apartment',
    'clear explanation of how it works': 'Clear Explanation of How It Works',
    'clear explanations': 'Clear Explanation of How It Works',
    'clear explanation': 'Clear Explanation of How It Works',
    'focus on safety and security': 'Safety & Security Focus',
    'video walkthrough of actual rooms/houses': 'Video Room Walkthrough',
    'video walkthrough of rooms': 'Video Room Walkthrough',
    'video walkthrough': 'Video Room Walkthrough',
    'short and entertaining content': 'Short & Entertaining',
    'showcase of rooms and prices in your area': 'Local Rooms & Prices',

    // Detail preferences (Q11)
    'give more detail': 'Give More Detail',
    'keep it short and simple': 'Keep It Short & Simple',
    'depends on the platform (tiktok short, youtube more detail)': 'Depends on Platform',
    'depends on the platform': 'Depends on Platform',
    'not sure': 'Not Sure',

    // Misc
    'photos': 'Photos',
    'move-in process': 'Move-In Process',
    'pictures of the resident': 'Resident Photos',
    'reviews': 'Reviews',
    'updated videos': 'Updated Videos',
    'flat rates': 'Flat Rates',
    'house rules': 'House Rules',
    'cleaning supplies': 'Cleaning Supplies',
    'entertainment': 'Entertainment',
    'testimonies': 'Testimonial',
    'testimonial': 'Testimonial',
    'other': 'Other',

    // Platforms
    'facebook groups to find housing': 'Facebook Groups (Housing)',
    'x (twitter)': 'X (Twitter)',

    // Free-text oddball values
    'advertised as a home but was a hotel': 'Misleading Listing',
    'how the living situation would be': 'Roommate Matching',
    'where places will be rented at': 'Location Options',
  };

  const key = trimmed.toLowerCase();
  if (SYNONYMS[key]) return SYNONYMS[key];

  // Fallback: apply formatLabel() for unknown values
  return formatLabel(trimmed);
}

/**
 * Format an array of AggResults by applying normalizeLabel to each label,
 * then re-merging any duplicates that result from normalization.
 */
export function formatAggLabels(data: AggResult[]): AggResult[] {
  const merged: Record<string, { count: number; pct: number }> = {};
  data.forEach(d => {
    const label = normalizeLabel(d.label);
    if (merged[label]) {
      merged[label].count += d.count;
      merged[label].pct += d.pct;
    } else {
      merged[label] = { count: d.count, pct: d.pct };
    }
  });
  return Object.entries(merged)
    .map(([label, { count, pct }]) => ({ label, count, pct: Math.round(pct) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Cap chart slices to top N + "Other" bucket.
 */
export function capSlices(data: AggResult[], maxSlices: number = 6): AggResult[] {
  if (data.length <= maxSlices) return data;
  const top = data.slice(0, maxSlices);
  const rest = data.slice(maxSlices);
  const otherCount = rest.reduce((sum, d) => sum + d.count, 0);
  const otherPct = rest.reduce((sum, d) => sum + d.pct, 0);
  return [...top, { label: 'Other', count: otherCount, pct: Math.round(otherPct) }];
}

export function generatePlatformInsight(platformData: AggResult[], adPrefData: AggResult[]): string {
  if (!platformData.length) return 'No platform data available yet.';
  const top = platformData[0];
  const adMatch = adPrefData.find(a => a.label === top.label);
  const adPct = adMatch?.pct || 0;
  const gap = adPrefData.find(p => {
    const usage = platformData.find(u => u.label === p.label);
    return usage && p.pct - usage.pct > 5;
  });
  let text = `${top.pct}% of members use ${top.label}`;
  if (adPct > 0) text += ` but only ${adPct}% want to see PadSplit ads there`;
  text += '.';
  if (gap) text += ` The biggest opportunity is ${gap.label}.`;
  return text;
}

export function generateAdAwarenessInsight(recallPct: number, influencerPct: number, likedPct: number): string {
  return `${recallPct}% of members recall seeing PadSplit ads. Of those who saw them, ${likedPct}% liked them. ${influencerPct}% follow influencers, suggesting influencer partnerships could expand reach.`;
}

export function generateMessagingInsight(triggers: AggResult[], motivators: AggResult[], topPlatform: string): string {
  if (!triggers.length && !motivators.length) return 'No messaging data available yet.';
  const topTrigger = triggers[0];
  const topMotivator = motivators[0];
  let text = '';
  if (topTrigger) text += `The #1 scroll-stopper is "${topTrigger.label}" (${topTrigger.pct}%). `;
  if (topMotivator) text += `The #1 click motivator is "${topMotivator.label}" (${topMotivator.pct}%). `;
  if (topPlatform && topMotivator) text += `For ${topPlatform} users, focus on ${topMotivator.label} messaging.`;
  return text;
}

export function generateBarrierInsight(concerns: AggResult[], interests: AggResult[], confusion: AggResult[]): string {
  const topConcern = concerns[0];
  const topInterest = interests[0];
  const nothingConfusing = confusion.find(c => c.label === 'Nothing Was Confusing');
  const topConfusion = confusion.filter(c => c.label !== 'Nothing Was Confusing')[0];

  let text = '';
  if (topConcern) text += `The #1 concern is "${topConcern.label}" (${topConcern.pct}%). `;
  if (topInterest) text += `The #1 attraction is "${topInterest.label}" (${topInterest.pct}%). `;

  if (nothingConfusing && nothingConfusing.pct > 50) {
    text += `${nothingConfusing.pct}% found nothing confusing about PadSplit.`;
  } else if (topConfusion && topConfusion.pct > 5) {
    text += `${topConfusion.pct}% were confused about "${topConfusion.label}".`;
  }

  return text;
}

export function generateCreativeBrief(
  topMotivator: string,
  topInterest: string,
  topConcern: string,
  topContent: string,
  detailPref: AggResult[]
): string {
  const shortPref = detailPref.find(d => d.label.toLowerCase().includes('short'));
  const detailStr = shortPref ? 'short and simple' : 'detailed';
  return `Recommended: Lead with "${topMotivator}" + "${topInterest}" messaging. Address "${topConcern}" fears upfront. Use ${detailStr} format. Feature ${topContent} content.`;
}

export const SURVEY_COLORS = [
  'hsl(var(--primary))',
  '#ea580c', '#d97706', '#65a30d', '#0891b2',
  '#7c3aed', '#db2777', '#059669', '#2563eb',
  '#6d28d9', '#0d9488', '#c026d3',
];

export const DISTINCT_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#65a30d', '#0891b2',
  '#7c3aed', '#db2777', '#059669', '#2563eb', '#6d28d9',
  '#0d9488', '#c026d3',
];
