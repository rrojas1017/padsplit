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
  "no, nothing",
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
  // exact matches first (the no_issue cluster has only exactMatches)
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

export function clusterOpenEndedResponses(
  responses: string[],
  options?: {
    maxExamplesPerCluster?: number;
    maxClusters?: number;
  },
): OpenEndedCluster[] {
  const maxExamples = options?.maxExamplesPerCluster ?? 5;
  const maxClusters = options?.maxClusters ?? 8;

  // 1. Trim + drop truly empty.
  const trimmed: string[] = [];
  for (const raw of responses || []) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (!s) continue;
    trimmed.push(s);
  }

  // 2. Case-insensitive dedupe, preserving first-seen casing.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of trimmed) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  const total = deduped.length;
  if (total === 0) return [];

  // 3. Bucket.
  const buckets = new Map<string, { label: string; summary?: string; examples: string[]; count: number }>();
  for (const resp of deduped) {
    const id = classify(resp);
    const rule = RULES.find((r) => r.id === id);
    const label = rule?.label ?? OTHER_LABEL;
    const summary = rule?.summary;
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { label, summary, examples: [], count: 0 };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    if (bucket.examples.length < maxExamples) bucket.examples.push(resp);
  }

  // 4. To list, sort by count desc (stable-ish), tie-break by label.
  let clusters: OpenEndedCluster[] = Array.from(buckets.entries()).map(([id, b]) => ({
    id,
    label: b.label,
    summary: b.summary,
    examples: b.examples,
    count: b.count,
    percentage: 0,
  }));
  clusters.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // 5. Cap and merge tail into "Other responses".
  if (clusters.length > maxClusters) {
    const head = clusters.slice(0, maxClusters - 1);
    const tail = clusters.slice(maxClusters - 1);
    const existingOther = head.find((c) => c.id === OTHER_ID);
    const tailCount = tail.reduce((acc, c) => acc + c.count, 0);
    const tailExamples = tail.flatMap((c) => c.examples).slice(0, maxExamples);
    if (existingOther) {
      existingOther.count += tailCount;
      const merged = [...existingOther.examples, ...tailExamples].slice(0, maxExamples);
      existingOther.examples = merged;
      clusters = head;
    } else {
      clusters = [
        ...head,
        {
          id: OTHER_ID,
          label: OTHER_LABEL,
          examples: tailExamples,
          count: tailCount,
          percentage: 0,
        },
      ];
    }
    clusters.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  // 6. Percentages — guarantee >=1% when count > 0.
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
