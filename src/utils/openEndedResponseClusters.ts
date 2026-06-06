// Deterministic keyword-based clustering for open-ended Payment Experience
// responses. No AI, no backend calls. Pure client-side helper.

export interface OpenEndedCluster {
  id: string;
  label: string;
  count: number;
  percentage: number;
  summary?: string;
  examples: string[];
}

interface ClusterRule {
  id: string;
  label: string;
  summary?: string;
  exactMatches?: string[]; // lowercased, trimmed
  keywords?: string[]; // lowercased substrings
}

const NO_ISSUE_EXACT = new Set([
  'no',
  'none',
  'nothing',
  'n/a',
  'na',
  'all good',
  'fine',
  'good',
  'nope',
  'no issues',
  'no issue',
  'nothing really',
  'no, nothing',
]);

const RULES: ClusterRule[] = [
  {
    id: 'no_issue',
    label: 'No issue reported',
    summary: 'Respondent indicated no problems with their payment experience.',
    exactMatches: Array.from(NO_ISSUE_EXACT),
  },
  {
    id: 'payment_reminders',
    label: 'Payment reminders & notifications',
    keywords: ['remind', 'notification', 'notif', 'alert', 'text me', 'email me'],
  },
  {
    id: 'app_confusion',
    label: 'App or website confusion',
    keywords: ['app', 'website', 'portal', 'dashboard', 'confus', 'hard to find', 'navigat'],
  },
  {
    id: 'due_date_flex',
    label: 'Due-date flexibility',
    keywords: ['due date', 'extension', 'more time', 'grace', 'flexible', 'weekly', 'biweekly', 'bi-weekly', 'monthly'],
  },
  {
    id: 'payment_methods',
    label: 'Payment method requests',
    keywords: ['cash app', 'cashapp', 'venmo', 'zelle', 'paypal', 'apple pay', 'google pay', 'card', 'debit', 'credit', 'bank', 'ach'],
  },
  {
    id: 'fees_charges',
    label: 'Fees or unexpected charges',
    keywords: ['fee', 'charge', 'surcharge', 'hidden', 'extra cost'],
  },
  {
    id: 'autopay',
    label: 'Autopay',
    keywords: ['autopay', 'auto pay', 'auto-pay', 'automatic'],
  },
  {
    id: 'host_support',
    label: 'Host support',
    keywords: ['host', 'landlord', 'owner'],
  },
  {
    id: 'hardship',
    label: 'Hardship assistance',
    keywords: ['hardship', 'lost job', 'unemploy', 'medical', 'emergency', 'help', 'assist'],
  },
];

const OTHER_ID = 'other';
const OTHER_LABEL = 'Other responses';

function classify(response: string): string {
  const lower = response.toLowerCase().trim();
  for (const rule of RULES) {
    if (rule.exactMatches && rule.exactMatches.includes(lower)) {
      return rule.id;
    }
  }
  for (const rule of RULES) {
    if (rule.keywords && rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.id;
    }
  }
  return OTHER_ID;
}

/**
 * Shared trim + case-insensitive dedupe for open-ended responses.
 * Preserves first-seen casing and order.
 */
export function normalizeOpenEndedResponses(responses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of responses || []) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function clusterOpenEndedResponses(
  responses: string[],
  options?: {
    maxExamplesPerCluster?: number;
  },
): OpenEndedCluster[] {
  const maxExamples = options?.maxExamplesPerCluster ?? 5;

  // Trim + drop empties; keep duplicates so cluster counts reflect the raw
  // written-response population.
  const cleaned: string[] = [];
  for (const raw of responses || []) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (!s) continue;
    cleaned.push(s);
  }
  const total = cleaned.length;
  if (total === 0) return [];

  const buckets = new Map<
    string,
    {
      label: string;
      summary?: string;
      examples: string[];
      exampleKeys: Set<string>;
      count: number;
    }
  >();
  for (const resp of cleaned) {
    const id = classify(resp);
    const rule = RULES.find((r) => r.id === id);
    const label = rule?.label ?? OTHER_LABEL;
    const summary = rule?.summary;
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { label, summary, examples: [], exampleKeys: new Set(), count: 0 };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    // Examples: dedupe case-insensitively for readability, cap at maxExamples.
    const key = resp.toLowerCase();
    if (bucket.examples.length < maxExamples && !bucket.exampleKeys.has(key)) {
      bucket.exampleKeys.add(key);
      bucket.examples.push(resp);
    }
  }

  const clusters: OpenEndedCluster[] = Array.from(buckets.entries()).map(
    ([id, b]) => ({
      id,
      label: b.label,
      summary: b.summary,
      examples: b.examples,
      count: b.count,
      percentage: 0,
    }),
  );

  // Sort: named clusters by count desc (tie-break label asc); Other always last.
  clusters.sort((a, b) => {
    const aOther = a.id === OTHER_ID;
    const bOther = b.id === OTHER_ID;
    if (aOther && !bOther) return 1;
    if (!aOther && bOther) return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  });

  for (const c of clusters) {
    if (c.count <= 0) {
      c.percentage = 0;
      continue;
    }
    const pct = (c.count / total) * 100;
    c.percentage = pct < 1 ? 1 : Math.round(pct);
  }

  return clusters;
}
