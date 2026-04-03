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
 * Format an array of AggResults by applying formatLabel to each label.
 */
export function formatAggLabels(data: AggResult[]): AggResult[] {
  return data.map(d => ({ ...d, label: formatLabel(d.label) }));
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
  let text = `${top.pct}% of members use ${formatLabel(top.label)}`;
  if (adPct > 0) text += ` but only ${adPct}% want to see PadSplit ads there`;
  text += '.';
  if (gap) text += ` The biggest opportunity is ${formatLabel(gap.label)}.`;
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
  if (topTrigger) text += `The #1 scroll-stopper is "${formatLabel(topTrigger.label)}" (${topTrigger.pct}%). `;
  if (topMotivator) text += `The #1 click motivator is "${formatLabel(topMotivator.label)}" (${topMotivator.pct}%). `;
  if (topPlatform && topMotivator) text += `For ${formatLabel(topPlatform)} users, focus on ${formatLabel(topMotivator.label)} messaging.`;
  return text;
}

export function generateBarrierInsight(concerns: AggResult[], interests: AggResult[], confusion: AggResult[]): string {
  const topConcern = concerns[0];
  const topInterest = interests[0];
  const notConfused = confusion.find(c => c.label.toLowerCase().includes('nothing'));
  const topConfusion = confusion.find(c => !c.label.toLowerCase().includes('nothing'));
  let text = '';
  if (topConcern) text += `The #1 concern is "${formatLabel(topConcern.label)}" (${topConcern.pct}%). `;
  if (topInterest) text += `The #1 attraction is "${formatLabel(topInterest.label)}" (${topInterest.pct}%). `;
  if (notConfused) text += `${notConfused.pct}% found nothing confusing. `;
  if (topConfusion) text += `${topConfusion.pct}% were confused about "${formatLabel(topConfusion.label)}".`;
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
  return `Recommended: Lead with "${formatLabel(topMotivator)}" + "${formatLabel(topInterest)}" messaging. Address "${formatLabel(topConcern)}" fears upfront. Use ${detailStr} format. Feature ${formatLabel(topContent)} content.`;
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
