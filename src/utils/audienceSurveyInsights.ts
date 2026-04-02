import type { AggResult } from '@/hooks/useAudienceSurveyResponses';

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
  const notConfused = confusion.find(c => c.label.toLowerCase().includes('nothing'));
  const topConfusion = confusion.find(c => !c.label.toLowerCase().includes('nothing'));
  let text = '';
  if (topConcern) text += `The #1 concern is "${topConcern.label}" (${topConcern.pct}%). `;
  if (topInterest) text += `The #1 attraction is "${topInterest.label}" (${topInterest.pct}%). `;
  if (notConfused) text += `${notConfused.pct}% found nothing confusing. `;
  if (topConfusion) text += `${topConfusion.pct}% were confused about "${topConfusion.label}".`;
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
