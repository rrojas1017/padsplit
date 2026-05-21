/**
 * Payment Experience — derived analytics.
 *
 * Pure, client-side, deterministic. Operates on PaymentExperienceRecord[]
 * already returned by usePaymentExperienceResponses(). No new queries, no AI,
 * no fabricated precision.
 */
import {
  CADENCE_NORMALIZATION_MAP,
  AUTOPAY_BARRIER_MAP,
  AUTOPAY_BARRIER_LABELS,
  FRICTION_THEME_MAP,
  FRICTION_THEME_LABELS,
  NO_FRICTION_KEY,
  CADENCE_LABELS,
  type CadenceBucket,
  type PaymentExperienceRecord,
} from '@/hooks/usePaymentExperienceResponses';

// ── Confidence ──────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'moderate' | 'limited' | 'insufficient';

export function confidenceLevel(n: number): ConfidenceLevel {
  if (n >= 50) return 'high';
  if (n >= 20) return 'moderate';
  if (n >= 5) return 'limited';
  return 'insufficient';
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  moderate: 'Moderate confidence',
  limited: 'Limited sample',
  insufficient: 'Insufficient',
};

// ── Local normalization helpers (mirror hook internals) ─────────────────────

function normalizeKey(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[_/]/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookup<T extends string>(
  map: Record<string, T>,
  raw: unknown,
  fallback: T | null,
): T | null {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  if (map[key]) return map[key];
  for (const mapKey of Object.keys(map)) {
    if (key.includes(mapKey)) return map[mapKey];
  }
  return fallback;
}

function normalizeCadence(raw: unknown): CadenceBucket {
  if (!normalizeKey(raw)) return 'unknown';
  return lookup(CADENCE_NORMALIZATION_MAP, raw, 'other' as CadenceBucket) ?? 'unknown';
}

function normalizeFriction(raw: unknown): string | null {
  if (!normalizeKey(raw)) return null;
  return lookup(FRICTION_THEME_MAP, raw, 'other');
}

function normalizeBarrier(raw: unknown): string | null {
  if (!normalizeKey(raw)) return null;
  return lookup(AUTOPAY_BARRIER_MAP, raw, 'other');
}

function deviceBucket(raw: unknown): string | null {
  const k = normalizeKey(raw);
  if (!k) return null;
  if (k.includes('mobile') || k.includes('app')) return 'Mobile app';
  if (k.includes('desktop') || k.includes('web') || k.includes('computer') || k.includes('laptop')) return 'Web / desktop';
  if (k.includes('phone') || k.includes('call') || k.includes('support')) return 'Phone support';
  return null;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(num: number, den: number): number | null {
  return den ? (num / den) * 100 : null;
}

// ── Segmented Insights ──────────────────────────────────────────────────────

export interface SegmentRow {
  label: string;
  display: string;
  value: number | null;
  /** Optional 0–100 percent for visualizations. Populated only for percent-based segments. */
  percent?: number;
  n: number;
  confidence: ConfidenceLevel;
}

export interface SegmentCard {
  id: string;
  title: string;
  metricLabel: string;
  rows: SegmentRow[];
}

const MIN_SEGMENT_N = 5;

export function computeSegmentedInsights(eligible: PaymentExperienceRecord[]): SegmentCard[] {
  const cards: SegmentCard[] = [];

  // 1. Auto-pay enrollment by pay cadence
  {
    const groups: Partial<Record<CadenceBucket, { enrolled: number; answered: number }>> = {};
    for (const r of eligible) {
      const cadence = normalizeCadence(r.extraction?.pay_cadence);
      if (cadence === 'unknown' || cadence === 'other') continue;
      const status = r.extraction?.autopay_status;
      if (!status) continue;
      const g = (groups[cadence] ||= { enrolled: 0, answered: 0 });
      g.answered++;
      if (status === 'enrolled') g.enrolled++;
    }
    const rows: SegmentRow[] = (Object.keys(groups) as CadenceBucket[])
      .map((b) => {
        const { enrolled, answered } = groups[b]!;
        const v = pct(enrolled, answered);
        return {
          label: CADENCE_LABELS[b] ?? b,
          display: v == null ? '—' : `${Math.round(v)}% enrolled`,
          value: v,
          n: answered,
          confidence: confidenceLevel(answered),
        };
      })
      .filter((r) => r.n >= MIN_SEGMENT_N)
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    if (rows.length >= 2) {
      cards.push({
        id: 'autopay-by-cadence',
        title: 'Auto-pay by pay cadence',
        metricLabel: '% enrolled',
        rows,
      });
    }
  }

  // 2. Literacy by channel / device
  {
    const groups: Record<string, number[]> = {};
    for (const r of eligible) {
      const dev = deviceBucket(r.extraction?.channel_method?.device);
      const score = r.extraction?.payment_literacy_score;
      if (!dev || typeof score !== 'number') continue;
      (groups[dev] ||= []).push(score);
    }
    const rows: SegmentRow[] = Object.entries(groups)
      .map(([label, scores]) => {
        const v = avg(scores);
        return {
          label,
          display: v == null ? '—' : `${v.toFixed(0)}/100 literacy`,
          value: v,
          n: scores.length,
          confidence: confidenceLevel(scores.length),
        };
      })
      .filter((r) => r.n >= MIN_SEGMENT_N)
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    if (rows.length >= 2) {
      cards.push({
        id: 'literacy-by-channel',
        title: 'Literacy by payment channel',
        metricLabel: 'Avg literacy',
        rows,
      });
    }
  }

  // 3. Hardship awareness by auto-pay enrollment
  {
    const groups: Record<'Enrolled' | 'Not enrolled', { aware: number; answered: number }> = {
      Enrolled: { aware: 0, answered: 0 },
      'Not enrolled': { aware: 0, answered: 0 },
    };
    for (const r of eligible) {
      const status = r.extraction?.autopay_status;
      const gap = r.extraction?.hardship_awareness_gap;
      if (typeof gap !== 'boolean') continue;
      if (status === 'enrolled') {
        groups.Enrolled.answered++;
        if (gap === false) groups.Enrolled.aware++;
      } else if (status === 'not_enrolled') {
        groups['Not enrolled'].answered++;
        if (gap === false) groups['Not enrolled'].aware++;
      }
    }
    const rows: SegmentRow[] = (Object.keys(groups) as Array<keyof typeof groups>)
      .map((label) => {
        const { aware, answered } = groups[label];
        const v = pct(aware, answered);
        return {
          label,
          display: v == null ? '—' : `${Math.round(v)}% aware`,
          value: v,
          n: answered,
          confidence: confidenceLevel(answered),
        };
      })
      .filter((r) => r.n >= MIN_SEGMENT_N);
    if (rows.length >= 2) {
      cards.push({
        id: 'hardship-by-autopay',
        title: 'Hardship awareness by auto-pay',
        metricLabel: '% hardship-aware',
        rows,
      });
    }
  }

  // 4. Friction rate by auto-pay enrollment
  {
    const groups: Record<'Enrolled' | 'Not enrolled', { friction: number; answered: number }> = {
      Enrolled: { friction: 0, answered: 0 },
      'Not enrolled': { friction: 0, answered: 0 },
    };
    for (const r of eligible) {
      const status = r.extraction?.autopay_status;
      const themeKey = normalizeFriction(r.extraction?.top_friction_theme);
      if (!themeKey) continue;
      if (status === 'enrolled') {
        groups.Enrolled.answered++;
        if (themeKey !== NO_FRICTION_KEY) groups.Enrolled.friction++;
      } else if (status === 'not_enrolled') {
        groups['Not enrolled'].answered++;
        if (themeKey !== NO_FRICTION_KEY) groups['Not enrolled'].friction++;
      }
    }
    const rows: SegmentRow[] = (Object.keys(groups) as Array<keyof typeof groups>)
      .map((label) => {
        const { friction, answered } = groups[label];
        const v = pct(friction, answered);
        return {
          label,
          display: v == null ? '—' : `${Math.round(v)}% report friction`,
          value: v,
          n: answered,
          confidence: confidenceLevel(answered),
        };
      })
      .filter((r) => r.n >= MIN_SEGMENT_N);
    if (rows.length >= 2) {
      cards.push({
        id: 'friction-by-autopay',
        title: 'Friction by auto-pay enrollment',
        metricLabel: '% with friction',
        rows,
      });
    }
  }

  return cards;
}

// ── Key Drivers ─────────────────────────────────────────────────────────────

export interface DriverInsight {
  id: string;
  headline: string;
  detail: string;
  n: number;
  confidence: ConfidenceLevel;
}

const MIN_DRIVER_SIDE = 10;

export function computeKeyDrivers(eligible: PaymentExperienceRecord[]): DriverInsight[] {
  const out: DriverInsight[] = [];

  // Literacy ↔ auto-pay enrollment
  {
    let lowEnrolled = 0, lowAns = 0, highEnrolled = 0, highAns = 0;
    for (const r of eligible) {
      const s = r.extraction?.payment_literacy_score;
      const status = r.extraction?.autopay_status;
      if (typeof s !== 'number' || !status) continue;
      const enrolled = status === 'enrolled' ? 1 : 0;
      if (s < 60) { lowAns++; lowEnrolled += enrolled; }
      else { highAns++; highEnrolled += enrolled; }
    }
    if (lowAns >= MIN_DRIVER_SIDE && highAns >= MIN_DRIVER_SIDE) {
      const lowRate = lowEnrolled / lowAns;
      const highRate = highEnrolled / highAns;
      if (highRate > 0 && lowRate > 0) {
        const lift = highRate / lowRate;
        if (lift >= 1.3) {
          out.push({
            id: 'literacy-drives-autopay',
            headline: 'Lower payment literacy correlates with lower auto-pay enrollment.',
            detail: `Members scoring below 60/100 were ${lift.toFixed(1)}× less likely to enroll (${Math.round(lowRate * 100)}% vs ${Math.round(highRate * 100)}%).`,
            n: lowAns + highAns,
            confidence: confidenceLevel(lowAns + highAns),
          });
        }
      }
    }
  }

  // Cadence ↔ cash-flow constraint
  {
    let weeklyAns = 0, weeklyCash = 0, nonWeeklyAns = 0, nonWeeklyCash = 0;
    for (const r of eligible) {
      const cadence = normalizeCadence(r.extraction?.pay_cadence);
      if (cadence === 'unknown') continue;
      const friction = normalizeFriction(r.extraction?.top_friction_theme);
      const barrier = normalizeBarrier(r.extraction?.autopay_barrier_category);
      const cash = friction === 'pay_cycle_mismatch' || barrier === 'cashflow_constraint' || barrier === 'income_irregularity';
      if (cadence === 'weekly') { weeklyAns++; if (cash) weeklyCash++; }
      else { nonWeeklyAns++; if (cash) nonWeeklyCash++; }
    }
    if (weeklyAns >= MIN_DRIVER_SIDE && nonWeeklyAns >= MIN_DRIVER_SIDE) {
      const w = (weeklyCash / weeklyAns) * 100;
      const nw = (nonWeeklyCash / nonWeeklyAns) * 100;
      if (nw - w >= 10) {
        out.push({
          id: 'cadence-cashflow',
          headline: 'Non-weekly pay cadence is linked to higher cash-flow strain.',
          detail: `${Math.round(nw)}% of non-weekly members cite cash-flow or cycle issues, vs ${Math.round(w)}% of weekly members.`,
          n: weeklyAns + nonWeeklyAns,
          confidence: confidenceLevel(weeklyAns + nonWeeklyAns),
        });
      }
    }
  }

  // Hardship awareness ↔ friction rate
  {
    let awareAns = 0, awareFric = 0, unawareAns = 0, unawareFric = 0;
    for (const r of eligible) {
      const gap = r.extraction?.hardship_awareness_gap;
      const themeKey = normalizeFriction(r.extraction?.top_friction_theme);
      if (typeof gap !== 'boolean' || !themeKey) continue;
      const f = themeKey !== NO_FRICTION_KEY ? 1 : 0;
      if (gap === false) { awareAns++; awareFric += f; }
      else { unawareAns++; unawareFric += f; }
    }
    if (awareAns >= MIN_DRIVER_SIDE && unawareAns >= MIN_DRIVER_SIDE) {
      const a = (awareFric / awareAns) * 100;
      const u = (unawareFric / unawareAns) * 100;
      if (u - a >= 10) {
        out.push({
          id: 'hardship-friction',
          headline: 'Members unaware of hardship options report more payment friction.',
          detail: `${Math.round(u)}% of hardship-unaware members report friction, vs ${Math.round(a)}% of hardship-aware members.`,
          n: awareAns + unawareAns,
          confidence: confidenceLevel(awareAns + unawareAns),
        });
      }
    }
  }

  return out;
}

// ── Top Emerging Risks ──────────────────────────────────────────────────────

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface EmergingRisk {
  id: string;
  title: string;
  detail: string;
  severity: RiskSeverity;
  impact: number;
}

export function computeEmergingRisks(eligible: PaymentExperienceRecord[]): EmergingRisk[] {
  const risks: EmergingRisk[] = [];
  if (eligible.length < 10) return risks;

  const notEnrolled = eligible.filter((r) => r.extraction?.autopay_status === 'not_enrolled');
  const barrierCounts = new Map<string, number>();
  for (const r of notEnrolled) {
    const k = normalizeBarrier(r.extraction?.autopay_barrier_category);
    if (!k) continue;
    barrierCounts.set(k, (barrierCounts.get(k) || 0) + 1);
  }

  // R1: Distrust of recurring charges
  const distrust = barrierCounts.get('distrust_recurring_charges') ?? 0;
  if (notEnrolled.length >= 10 && distrust / notEnrolled.length >= 0.15) {
    const share = Math.round((distrust / notEnrolled.length) * 100);
    risks.push({
      id: 'distrust-recurring',
      title: 'Distrust of recurring charges is the leading auto-pay blocker',
      detail: `${share}% of non-enrolled members (${distrust}) cite distrust of recurring charges.`,
      severity: share >= 30 ? 'high' : 'medium',
      impact: distrust,
    });
  }

  // R2: Hardship-unaware among non-autopay
  if (notEnrolled.length >= 10) {
    const unaware = notEnrolled.filter((r) => r.extraction?.hardship_awareness_gap === true).length;
    const answered = notEnrolled.filter(
      (r) => typeof r.extraction?.hardship_awareness_gap === 'boolean',
    ).length;
    if (answered >= 10) {
      const share = unaware / answered;
      if (share >= 0.4) {
        risks.push({
          id: 'hardship-unaware-notautopay',
          title: 'Hardship options are unknown to most non-autopay members',
          detail: `${Math.round(share * 100)}% of non-enrolled members (${unaware}/${answered}) are unaware of hardship assistance.`,
          severity: share >= 0.6 ? 'high' : 'medium',
          impact: unaware,
        });
      }
    }
  }

  // R3: Non-weekly earners report friction
  const irregular = eligible.filter((r) => {
    const cadence = normalizeCadence(r.extraction?.pay_cadence);
    return cadence === 'biweekly' || cadence === 'semi_monthly' || cadence === 'monthly' || cadence === 'other';
  });
  if (irregular.length >= 10) {
    const withFriction = irregular.filter((r) => {
      const t = normalizeFriction(r.extraction?.top_friction_theme);
      return t && t !== NO_FRICTION_KEY;
    }).length;
    const share = withFriction / irregular.length;
    if (share >= 0.4) {
      risks.push({
        id: 'irregular-friction',
        title: 'Non-weekly earners report disproportionate friction',
        detail: `${Math.round(share * 100)}% of non-weekly members (${withFriction}/${irregular.length}) report payment friction.`,
        severity: share >= 0.55 ? 'high' : 'medium',
        impact: withFriction,
      });
    }
  }

  // R4: Method failures recurring
  let methodFails = 0;
  for (const r of eligible) {
    if (normalizeFriction(r.extraction?.top_friction_theme) === 'method_failure') methodFails++;
  }
  if (methodFails >= 5 && methodFails / eligible.length >= 0.1) {
    risks.push({
      id: 'method-failure',
      title: 'Payment-method failures recur across the base',
      detail: `${methodFails} members (${Math.round((methodFails / eligible.length) * 100)}%) cite card declines or method failures.`,
      severity: methodFails / eligible.length >= 0.2 ? 'high' : 'medium',
      impact: methodFails,
    });
  }

  // R5: Low move-in clarity
  const clarityScores = eligible
    .map((r) => r.extraction?.move_in_cost_clarity_1to5)
    .filter((v): v is number => typeof v === 'number');
  if (clarityScores.length >= 10) {
    const avgClarity = clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length;
    if (avgClarity < 3.2) {
      const lowCount = clarityScores.filter((v) => v <= 2).length;
      risks.push({
        id: 'low-clarity',
        title: 'Move-in cost clarity is trending low',
        detail: `Avg clarity ${avgClarity.toFixed(1)}/5 across ${clarityScores.length} members; ${lowCount} rated ≤2.`,
        severity: avgClarity < 2.5 ? 'high' : 'medium',
        impact: lowCount,
      });
    }
  }

  const sevRank: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
  return risks
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.impact - a.impact)
    .slice(0, 5);
}

// ── Suggested Actions ───────────────────────────────────────────────────────

export interface SuggestedAction {
  id: string;
  title: string;
  detail: string;
  basedOn: string;
  impact: number;
}

export function computeSuggestedActions(eligible: PaymentExperienceRecord[]): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  if (eligible.length < 10) return actions;

  const notEnrolled = eligible.filter((r) => r.extraction?.autopay_status === 'not_enrolled');
  const unaware = notEnrolled.filter(
    (r) => normalizeBarrier(r.extraction?.autopay_barrier_category) === 'unaware',
  ).length;
  if (notEnrolled.length >= 10 && unaware / notEnrolled.length >= 0.1) {
    actions.push({
      id: 'autopay-education',
      title: 'Add auto-pay education to payment reminder flows',
      detail: 'Embed a short auto-pay primer in reminder SMS and email for members who have not enrolled.',
      basedOn: `${Math.round((unaware / notEnrolled.length) * 100)}% of non-enrolled members are unaware auto-pay exists.`,
      impact: unaware * 3,
    });
  }

  const cadenceCounts: Record<CadenceBucket, number> = {
    weekly: 0, biweekly: 0, semi_monthly: 0, monthly: 0, other: 0, unknown: 0,
  };
  for (const r of eligible) cadenceCounts[normalizeCadence(r.extraction?.pay_cadence)]++;
  const cadenceDen = eligible.length - cadenceCounts.unknown;
  const misaligned = cadenceDen - cadenceCounts.weekly;
  if (cadenceDen >= 10 && misaligned / cadenceDen >= 0.4) {
    actions.push({
      id: 'flexible-due-dates',
      title: 'Pilot flexible due-date alignment for bi-weekly and gig earners',
      detail: 'Offer opt-in due-date shifts that match member pay cycles to reduce missed-payment risk.',
      basedOn: `${Math.round((misaligned / cadenceDen) * 100)}% of members are on a non-weekly pay cadence.`,
      impact: misaligned * 2,
    });
  }

  const hardAns = eligible.filter((r) => typeof r.extraction?.hardship_awareness_gap === 'boolean');
  const hardUnaware = hardAns.filter((r) => r.extraction?.hardship_awareness_gap === true).length;
  if (hardAns.length >= 10 && hardUnaware / hardAns.length >= 0.4) {
    actions.push({
      id: 'hardship-onboarding',
      title: 'Surface hardship-assistance options during onboarding',
      detail: 'Add a dedicated hardship explainer to onboarding and the post-booking confirmation email.',
      basedOn: `${hardUnaware} of ${hardAns.length} members are unaware of hardship support.`,
      impact: hardUnaware * 2,
    });
  }

  const clarityScores = eligible
    .map((r) => r.extraction?.move_in_cost_clarity_1to5)
    .filter((v): v is number => typeof v === 'number');
  if (clarityScores.length >= 10) {
    const avgC = clarityScores.reduce((a, b) => a + b, 0) / clarityScores.length;
    if (avgC < 3.5) {
      const low = clarityScores.filter((v) => v <= 3).length;
      actions.push({
        id: 'movein-clarity',
        title: 'Clarify the move-in cost breakdown pre-booking',
        detail: 'Itemize first-month dues, fees, and deposits in the booking confirmation and pre-call brief.',
        basedOn: `Avg move-in cost clarity is ${avgC.toFixed(1)}/5 across ${clarityScores.length} members.`,
        impact: low,
      });
    }
  }

  let mf = 0;
  for (const r of eligible) {
    if (normalizeFriction(r.extraction?.top_friction_theme) === 'method_failure') mf++;
  }
  if (mf >= 5 && mf / eligible.length >= 0.08) {
    actions.push({
      id: 'method-audit',
      title: 'Audit payment-method failure paths',
      detail: 'Review declined-card flows and add retry and alternate-method prompts to reduce repeat failures.',
      basedOn: `${mf} members cite card declines or method failures.`,
      impact: mf * 2,
    });
  }

  return actions.sort((a, b) => b.impact - a.impact).slice(0, 5);
}

// ── Survey Funnel ───────────────────────────────────────────────────────────

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
}

export function computeSurveyFunnel(
  allRecords: PaymentExperienceRecord[],
  eligible: PaymentExperienceRecord[],
): FunnelStep[] {
  const notEnrolled = eligible.filter((r) => r.extraction?.autopay_status === 'not_enrolled');
  let cashflow = 0;
  let trust = 0;
  for (const r of notEnrolled) {
    const b = normalizeBarrier(r.extraction?.autopay_barrier_category);
    if (b === 'cashflow_constraint' || b === 'income_irregularity') cashflow++;
    else if (b === 'distrust_recurring_charges' || b === 'wants_manual_control') trust++;
  }
  const steps: FunnelStep[] = [
    { id: 'surveyed', label: 'Surveyed', count: allRecords.length },
    { id: 'eligible', label: 'Eligible', count: eligible.length },
    { id: 'non-autopay', label: 'Not on auto-pay', count: notEnrolled.length },
    { id: 'cashflow', label: 'Cash-flow constraints', count: cashflow },
    { id: 'trust', label: 'Trust / control concerns', count: trust },
  ];
  while (steps.length > 2 && steps[steps.length - 1].count === 0) steps.pop();
  return steps;
}

export { AUTOPAY_BARRIER_LABELS, FRICTION_THEME_LABELS, CADENCE_LABELS };

// ── KPI Contextual Captions ─────────────────────────────────────────────────
// Deterministic, suppressed when sample is too small. Pure derivation helper.

export interface KpiCaptions {
  payCycle?: string;
  autopay?: string;
  hardship?: string;
}

export function computeKpiCaptions(eligible: PaymentExperienceRecord[]): KpiCaptions {
  const out: KpiCaptions = {};

  // payCycle: most common non-weekly cadence
  {
    const counts: Partial<Record<CadenceBucket, number>> = {};
    for (const r of eligible) {
      const c = normalizeCadence(r.extraction?.pay_cadence);
      if (c === 'unknown' || c === 'other' || c === 'weekly') continue;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    const top = (Object.entries(counts) as [CadenceBucket, number][])
      .sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 5) {
      const label = (CADENCE_LABELS[top[0]] ?? top[0]).toLowerCase();
      out.payCycle = `Most common among ${label} earners`;
    }
  }

  // autopay: cadence bucket with lowest enrollment rate
  {
    const groups: Partial<Record<CadenceBucket, { enrolled: number; n: number }>> = {};
    for (const r of eligible) {
      const c = normalizeCadence(r.extraction?.pay_cadence);
      if (c === 'unknown' || c === 'other') continue;
      const s = r.extraction?.autopay_status;
      if (!s) continue;
      const g = (groups[c] ||= { enrolled: 0, n: 0 });
      g.n++;
      if (s === 'enrolled') g.enrolled++;
    }
    const rows = (Object.entries(groups) as [CadenceBucket, { enrolled: number; n: number }][])
      .filter(([, v]) => v.n >= 10)
      .map(([k, v]) => ({ k, rate: v.enrolled / v.n }));
    if (rows.length >= 2) {
      rows.sort((a, b) => a.rate - b.rate);
      const label = (CADENCE_LABELS[rows[0].k] ?? rows[0].k).toLowerCase();
      out.autopay = `Enrollment lowest among ${label} members`;
    }
  }

  // hardship: awareness lower among non-autopay (≥10pp gap, ≥10 per side)
  {
    let eA = 0, eAware = 0, nA = 0, nAware = 0;
    for (const r of eligible) {
      const s = r.extraction?.autopay_status;
      const gap = r.extraction?.hardship_awareness_gap;
      if (typeof gap !== 'boolean') continue;
      if (s === 'enrolled') { eA++; if (gap === false) eAware++; }
      else if (s === 'not_enrolled') { nA++; if (gap === false) nAware++; }
    }
    if (eA >= 10 && nA >= 10) {
      const eRate = (eAware / eA) * 100;
      const nRate = (nAware / nA) * 100;
      if (eRate - nRate >= 10) {
        out.hardship = 'Awareness lower among non-autopay members';
      }
    }
  }

  return out;
}
