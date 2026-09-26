// Generic twin of PE ExecutiveSummaryBanner (CR-010 Phase 2). Same markup.
import { Sparkles } from 'lucide-react';

interface ScriptSurveySummaryBannerProps {
  summary: string;
  firstAction?: string | null;
  chips?: string[];
  source?: 'ai' | 'derived';
  footer?: string | null;
}

export function ScriptSurveySummaryBanner({ summary, firstAction, chips = [], source = 'ai', footer }: ScriptSurveySummaryBannerProps) {
  if (!summary) return null;
  const limitedChips = chips.slice(0, 4);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 md:px-5 md:py-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
          Executive Summary {source === 'derived' && '· derived'}
        </span>
      </div>

      <p className="text-base md:text-lg font-semibold leading-snug text-white break-words">
        {summary}
      </p>

      {limitedChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {limitedChips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-200"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {firstAction && (
        <p className="mt-3 text-xs text-slate-300 leading-relaxed">
          <span className="text-slate-400 font-medium">Focus: </span>
          {firstAction}
        </p>
      )}

      {footer && (
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-slate-500">
          <span>{footer}</span>
        </div>
      )}
    </div>
  );
}
