import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { stripUUIDs, formatCount } from './utils';
import { MoveOutActionCenter } from './MoveOutActionCenter';
import { ReasonCodeChart } from '@/components/research-insights/ReasonCodeChart';
import type { ResearchInsightData } from '@/types/research-insights';
import type { ExtendedKPIs } from '@/components/research-insights/InsightsKPIRow';

interface MoveOutOverviewProps {
  reportData: ResearchInsightData;
  kpis: ExtendedKPIs;
  lastUpdated: string | null;
  totalRecords: number;
  onCodeClick?: (code: string) => void;
  onViewAllMembers?: (cluster: string) => void;
}

export function MoveOutOverview({
  reportData,
  kpis,
  lastUpdated,
  totalRecords,
  onCodeClick,
  onViewAllMembers,
}: MoveOutOverviewProps) {
  const es = reportData.executive_summary;
  const headline = es?.headline || es?.title || '';
  const keyFindings = es?.key_findings;

  // Parse headline: first sentence bold, rest normal
  const firstDot = headline.indexOf('. ');
  const headlineBold = firstDot > 0 ? headline.slice(0, firstDot + 1) : headline;
  const headlineRest = firstDot > 0 ? headline.slice(firstDot + 1).trim() : '';

  // Key findings as string
  const findingsText = Array.isArray(keyFindings)
    ? keyFindings.join(' ')
    : typeof keyFindings === 'string'
      ? keyFindings
      : '';

  return (
    <div className="space-y-4">
      {/* AI Executive Summary */}
      {headline && (
        <Card className="bg-slate-900 border-slate-800 shadow-sm rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">AI Insight</span>
            </div>
            <p className="text-lg font-medium leading-relaxed text-white">
              <span className="font-semibold">{stripUUIDs(headlineBold)}</span>
              {headlineRest && <> {stripUUIDs(headlineRest)}</>}
            </p>
            {findingsText && (
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                {stripUUIDs(findingsText)}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-4">
              Generated from {totalRecords.toLocaleString()} analyzed cases
              {lastUpdated && <> · Last updated {lastUpdated}</>}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reason Code Chart (existing component — donut + treemap + drill-down) */}
      <ReasonCodeChart
        data={reportData.reason_code_distribution}
        onCodeClick={onCodeClick}
        onViewAllMembers={onViewAllMembers}
      />

      {/* Emerging Patterns */}
      {reportData.emerging_patterns && reportData.emerging_patterns.length > 0 && (
        <MoveOutPatterns data={reportData.emerging_patterns} />
      )}
    </div>
  );
}
