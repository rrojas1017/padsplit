import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, Sparkles, Quote, Lightbulb,
  TrendingDown, Users, DollarSign, Home, Info,
  ShieldAlert, AlertCircle,
} from 'lucide-react';

interface ExecutiveSummaryProps {
  data: {
    title?: string;
    headline?: string;
    key_findings?: string | string[];
    key_finding?: string;
    period?: string;
    date_range?: string;
    recommendation_summary?: string;
    urgent_recommendation?: string;
    top_recommendation?: string;
    urgent_quote?: string;
    quantified_impact?: string;
    // Legacy
    total_cases?: number;
    addressable_pct?: number;
    avg_preventability_score?: number;
    high_regret_count?: number;
    high_regret_pct?: number;
    payment_related_pct?: number;
    host_related_pct?: number;
  };
}

/** Guess severity from finding text for border colour */
function guessSeverity(text: string): 'critical' | 'high' | 'info' {
  const lower = text.toLowerCase();
  if (
    /urgent|critical|immediate|p0|illegal|harassment|unsafe|uninhabitable|crisis/i.test(lower)
  )
    return 'critical';
  if (
    /significant|major|high|concern|risk|friction|barrier|problem|issue|prevent|churn/i.test(lower)
  )
    return 'high';
  return 'info';
}

function severityClasses(sev: 'critical' | 'high' | 'info') {
  switch (sev) {
    case 'critical':
      return 'border-l-destructive bg-destructive/5';
    case 'high':
      return 'border-l-amber-500 bg-amber-500/5';
    default:
      return 'border-l-blue-500 bg-blue-500/5';
  }
}

function severityIcon(sev: 'critical' | 'high' | 'info', idx: number) {
  const iconProps = { className: 'w-4 h-4 flex-shrink-0 mt-0.5', strokeWidth: 2 };
  if (sev === 'critical')
    return <ShieldAlert {...iconProps} className={`${iconProps.className} text-destructive`} />;
  if (sev === 'high')
    return <AlertCircle {...iconProps} className={`${iconProps.className} text-amber-500`} />;
  // Rotate through informational icons
  const infoIcons = [TrendingDown, Users, DollarSign, Home, Info];
  const Icon = infoIcons[idx % infoIcons.length];
  return <Icon {...iconProps} className={`${iconProps.className} text-blue-500`} />;
}

/** Split a long paragraph into sentences for findings */
function parseParagraph(text: string): { headline: string; findings: string[]; recommendation: string | null } {
  // Split on sentence boundaries
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return { headline: text, findings: [], recommendation: null };
  }

  const headline = sentences[0];
  const recommendation = sentences[sentences.length - 1];
  const findings = sentences.slice(1, -1);
  return { headline, findings, recommendation };
}

export function ExecutiveSummary({ data: rawData }: ExecutiveSummaryProps) {
  const data: ExecutiveSummaryProps['data'] =
    typeof rawData === 'string' ? { headline: rawData } : rawData;

  const rawPeriod = data.period || data.date_range;
  const period =
    rawPeriod && rawPeriod.toLowerCase() !== 'not specified' && rawPeriod.trim() !== ''
      ? rawPeriod
      : null;

  // --- Derive structured fields ---
  let headline: string | null = null;
  let findings: string[] = [];
  let recommendation: string | null =
    data.recommendation_summary || data.urgent_recommendation || data.top_recommendation || null;

  // key_findings can be string or string[]
  const rawFindings = data.key_findings || data.key_finding;

  if (Array.isArray(rawFindings)) {
    findings = rawFindings.map((f) => (typeof f === 'string' ? f : JSON.stringify(f)));
  } else if (typeof rawFindings === 'string' && rawFindings.length > 0) {
    // Could be a paragraph — parse it
    const parsed = parseParagraph(rawFindings);
    findings = parsed.findings.length > 0 ? [parsed.headline, ...parsed.findings] : [];
    if (!recommendation && parsed.recommendation) recommendation = parsed.recommendation;
    if (findings.length === 0) findings = [rawFindings];
  }

  // Headline
  const rawTitle = data.title || data.headline;
  if (rawTitle && rawTitle.length <= 200) {
    headline = rawTitle;
  } else if (rawTitle) {
    // Title is too long — treat as body, parse first sentence as headline
    const parsed = parseParagraph(rawTitle);
    headline = parsed.headline.length <= 200 ? parsed.headline : 'Research Insights Summary';
    if (parsed.findings.length > 0) findings = [...parsed.findings, ...findings];
    if (!recommendation && parsed.recommendation) recommendation = parsed.recommendation;
  } else if (findings.length > 0) {
    headline = 'Research Insights Summary';
  }

  // If still nothing, fall back to legacy stats
  if (!headline && !findings.length) {
    const stats = [
      { label: 'Total Cases', value: data.total_cases },
      {
        label: 'Addressable',
        value: data.addressable_pct ? `${data.addressable_pct.toFixed(0)}%` : undefined,
      },
      {
        label: 'Avg Preventability',
        value: data.avg_preventability_score
          ? `${data.avg_preventability_score.toFixed(1)}/10`
          : undefined,
      },
      {
        label: 'High Regret',
        value:
          data.high_regret_count != null
            ? `${data.high_regret_count} (${data.high_regret_pct?.toFixed(0)}%)`
            : undefined,
      },
      {
        label: 'Payment Related',
        value: data.payment_related_pct
          ? `${data.payment_related_pct.toFixed(0)}%`
          : undefined,
      },
      {
        label: 'Host Related',
        value: data.host_related_pct ? `${data.host_related_pct.toFixed(0)}%` : undefined,
      },
    ].filter((s) => s.value != null);

    if (!stats.length) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Cap findings to 5
  const displayFindings = findings.slice(0, 5);

  return (
    <Card className="shadow-md overflow-hidden border-primary/20">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-2 flex-1">
            <h2 className="text-lg font-bold text-white leading-snug">{headline}</h2>
            {period && (
              <Badge
                variant="outline"
                className="border-white/30 text-white/90 bg-white/10"
              >
                {period}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Key Findings */}
        {displayFindings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Key Findings
            </p>
            <div className="space-y-2">
              {displayFindings.map((finding, i) => {
                const sev = guessSeverity(finding);
                return (
                  <div
                    key={i}
                    className={`rounded-lg border-l-4 p-3 flex items-start gap-2.5 ${severityClasses(sev)}`}
                  >
                    {severityIcon(sev, i)}
                    <p className="text-sm text-foreground leading-relaxed">{finding}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantified Impact */}
        {data.quantified_impact && (
          <div className="bg-muted/30 rounded-xl p-4 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">
              Quantified Impact
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.quantified_impact}
            </p>
          </div>
        )}

        {/* Urgent Quote */}
        {data.urgent_quote && (
          <div className="bg-accent/50 border border-accent rounded-xl p-4 flex items-start gap-2.5">
            <Quote className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              &ldquo;{data.urgent_quote}&rdquo;
            </p>
          </div>
        )}

        {/* #1 Recommendation */}
        {recommendation && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive mb-1 uppercase tracking-wide">
                #1 Recommendation
              </p>
              <p className="text-sm text-foreground leading-relaxed">{recommendation}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
