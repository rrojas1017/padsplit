// Deterministic keyword-based clustering for open-ended Payment Experience
// responses. No AI, no backend calls. Pure client-side helper.

export interface OpenEndedCluster {
  id: string;
  label: string;
  count: number;
  percentage: number;
  summary?: string;
  /** Capped, case-insensitive deduped representative examples. */
  examples: string[];
  /** Full ordered list of every response assigned to this cluster (duplicates preserved). */
  responses: string[];
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
  'all is well',
  'everything is fine',
  'everything good',
  'everything is good',
  'no complaints',
  'not really',
  'not at all',
  'nothing comes to mind',
  "i don't know",
  'i dont know',
  'idk',
  'unsure',
]);

// Ordered most-specific → broadest. First match wins.
const RULES: ClusterRule[] = [
  {
    id: 'no_issue',
    label: 'No issue reported',
    summary: 'Respondent indicated no problems with their payment experience.',
    exactMatches: Array.from(NO_ISSUE_EXACT),
  },
  {
    id: 'late_fees',
    label: 'Late fees & penalties',
    keywords: ['late fee', 'late charge', 'penalty', 'penalt'],
  },
  {
    id: 'payment_reminders',
    label: 'Payment reminders & notifications',
    keywords: [
      'remind', 'notification', 'notif', 'alert', 'text me', 'email me',
      'warning', 'heads up', 'before due', 'advance notice',
    ],
  },
  {
    id: 'due_date_flex',
    label: 'Due-date flexibility',
    keywords: [
      'due date', 'extension', 'more time', 'grace', 'flexible', 'weekly',
      'biweekly', 'bi-weekly', 'monthly', 'grace period', 'push back',
      'later date', 'earlier date', 'change date', 'different date',
    ],
  },
  {
    id: 'autopay',
    label: 'Autopay',
    keywords: ['autopay', 'auto pay', 'auto-pay', 'automatic'],
  },
  {
    id: 'payment_methods',
    label: 'Payment method requests',
    keywords: [
      'cash app', 'cashapp', 'venmo', 'zelle', 'paypal', 'apple pay',
      'google pay', 'card', 'debit', 'credit', 'bank', 'ach',
      'money order', 'check', 'transfer', 'wire', 'crypto',
    ],
  },
  {
    id: 'payment_processing',
    label: 'Payment processing issues',
    keywords: [
      'process', 'post', 'posted', 'pending', "didn't go through",
      'didnt go through', 'declined', 'fail', 'error', 'glitch', 'bug',
    ],
  },
  {
    id: 'partial_payments',
    label: 'Partial / split payments',
    keywords: ['partial', 'split', 'break it up', 'pay half', 'smaller payment', 'installment'],
  },
  {
    id: 'refunds',
    label: 'Refunds',
    keywords: ['refund', 'reimburs', 'credit back', 'money back'],
  },
  {
    id: 'receipt_history',
    label: 'Receipts & payment history',
    keywords: ['receipt', 'history', 'statement', 'record', 'proof', 'confirmation'],
  },
  {
    id: 'fees_charges',
    label: 'Fees or unexpected charges',
    keywords: ['fee', 'charge', 'surcharge', 'hidden', 'extra cost'],
  },
  {
    id: 'lower_price',
    label: 'Lower price / affordability',
    keywords: ['cheaper', 'lower', 'too expensive', 'too high', 'afford', 'price', 'rate', 'cost too much'],
  },
  {
    id: 'hardship',
    label: 'Hardship assistance',
    keywords: [
      'hardship', 'lost job', 'unemploy', 'medical', 'emergency', 'help', 'assist',
      'covid', 'sick', 'injury', 'laid off', 'fired', 'behind',
    ],
  },
  {
    id: 'app_confusion',
    label: 'App or website confusion',
    keywords: [
      'app', 'website', 'portal', 'dashboard', 'confus', 'hard to find', 'navigat',
      'login', 'log in', 'sign in', 'ui', 'interface', 'buttons', 'menu',
      'slow', 'lag', 'crash',
    ],
  },
  {
    id: 'clarity_communication',
    label: 'Clarity & communication',
    keywords: ['clear', 'clarity', 'explain', 'explanation', 'instructions', 'communicate', 'communication', 'transparent'],
  },
  {
    id: 'customer_support',
    label: 'Customer support',
    keywords: ['support', 'customer service', 'rep', 'agent', 'chat', 'phone call', 'call back', 'callback', 'answer the phone'],
  },
  {
    id: 'host_support',
    label: 'Host support',
    keywords: ['host', 'landlord', 'owner'],
  },
  {
    id: 'positive_feedback',
    label: 'Positive feedback',
    keywords: ['easy', 'simple', 'great', 'love', 'perfect', 'smooth', 'no problem', 'satisfied', 'happy', 'convenient'],
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
      responses: string[];
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
      bucket = { label, summary, examples: [], exampleKeys: new Set(), responses: [], count: 0 };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    bucket.responses.push(resp);
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
      responses: b.responses,
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
