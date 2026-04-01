import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';
import type { AudienceSurveySummary } from '@/types/research-insights';

interface Props {
  data: AudienceSurveySummary;
}

export function AudienceSurveyExecutiveSummary({ data }: Props) {
  // Derive top recommendation from key_findings if available
  const topRecommendation = data.key_findings?.[0];

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Badge className="bg-white/20 text-white border-white/30 text-xs hover:bg-white/30">
            Executive Summary
          </Badge>
          <h3 className="text-xl font-bold leading-tight">
            {data.headline || 'Audience Survey Results'}
          </h3>
        </div>
        <Badge className="bg-white/20 text-white border-white/30 flex-shrink-0">
          {data.total_responses || 0} responses
        </Badge>
      </div>

      {data.key_findings && data.key_findings.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-semibold text-white/80 uppercase tracking-wide">Key Findings</p>
          <ul className="space-y-1.5">
            {data.key_findings.map((finding, i) => (
              <li key={i} className="text-sm text-white/90 flex items-start gap-2">
                <span className="text-white/60 mt-0.5">•</span>
                <span>{typeof finding === 'string' ? finding : JSON.stringify(finding)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topRecommendation && (
        <div className="mt-5 flex items-start gap-2 bg-white/10 rounded-lg p-3">
          <Lightbulb className="w-4 h-4 text-yellow-300 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-0.5">Top Recommendation</p>
            <p className="text-sm text-white/95">{topRecommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
