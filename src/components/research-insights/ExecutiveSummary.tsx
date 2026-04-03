import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

interface ExecutiveSummaryProps {
  data: any;
}

/** Parse percentage strings for display — handles decimals (0.605 → 60.5%) and ranges ("60-70%") */
function fmtPct(val: any): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === 'N/A' || s === '0') return null;
  // Already has %, return as-is (e.g. "60-70%" or "65%")
  if (s.includes('%')) return s;
  // Try parsing as number — if it's a decimal between 0-1, multiply by 100
  const n = parseFloat(s);
  if (!isNaN(n)) {
    const pct = n > 0 && n <= 1 ? n * 100 : n;
    return `${Math.round(pct * 10) / 10}%`;
  }
  return `${s}%`;
}

/** Parse a long paragraph into headline + findings */
function parseParagraph(text: string): { headline: string; findings: string[] } {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length <= 1) return { headline: text, findings: [] };
  return { headline: sentences[0], findings: sentences.slice(1) };
}

export function ExecutiveSummary({ data: rawData }: ExecutiveSummaryProps) {
  if (!rawData) return null;
  const data = typeof rawData === 'string' ? { headline: rawData } : rawData;

  // Extract headline (first sentence of the long headline paragraph)
  const rawHeadline = data.headline || data.title || '';
  let headline = '';
  let bodyFindings: string[] = [];

  if (rawHeadline.length > 200) {
    const parsed = parseParagraph(rawHeadline);
    headline = parsed.headline;
    bodyFindings = parsed.findings;
  } else {
    headline = rawHeadline || 'Research Insights Summary';
  }

  // key_findings can be string or string[]
  const rawFindings = data.key_findings || data.key_finding;
  let findings: string[] = [];
  if (Array.isArray(rawFindings)) {
    findings = rawFindings;
  } else if (typeof rawFindings === 'string' && rawFindings.length > 0) {
    const parsed = parseParagraph(rawFindings);
    findings = parsed.findings.length > 0 ? [parsed.headline, ...parsed.findings] : [rawFindings];
  }
  // Merge body findings from long headline
  if (bodyFindings.length > 0 && findings.length === 0) {
    findings = bodyFindings;
  }

  // Stat badges from executive_summary
  const statBadges = [
    { label: 'Total Cases', value: data.total_cases },
    { label: 'Addressable', value: fmtPct(data.addressable_pct) },
    { label: 'High Regret', value: fmtPct(data.high_regret_pct) },
    { label: 'Host Related', value: fmtPct(data.host_related_pct) },
    { label: 'Payment Related', value: fmtPct(data.payment_related_pct) },
    { label: 'Life Event', value: fmtPct(data.life_event_pct) },
    { label: 'Roommate Related', value: fmtPct(data.roommate_related_pct) },
  ].filter(s => s.value != null);

  return (
    <Card className="shadow-md overflow-hidden border-primary/20">
      {/* Hero banner with headline */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white leading-snug">{headline}</h2>
        </div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Stat badges row */}
        {statBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statBadges.map(s => (
              <Badge key={s.label} variant="outline" className="text-sm px-3 py-1">
                <span className="font-bold text-foreground mr-1">{s.value}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Key findings as paragraph */}
        {findings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Key Findings</p>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              {findings.slice(0, 5).map((f, i) => (
                <p key={i}>{f}</p>
              ))}
            </div>
          </div>
        )}

        {/* Top recommendation */}
        {(data.recommendation_summary || data.urgent_recommendation || data.top_recommendation) && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">Top Recommendation</p>
            <p className="text-sm text-foreground leading-relaxed">
              {data.recommendation_summary || data.urgent_recommendation || data.top_recommendation}
            </p>
          </div>
        )}

        {/* Urgent quote */}
        {data.urgent_quote && (
          <div className="bg-accent/50 border border-accent rounded-xl p-4">
            <p className="text-sm italic text-muted-foreground">&ldquo;{data.urgent_quote}&rdquo;</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
