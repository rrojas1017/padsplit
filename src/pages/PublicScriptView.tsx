import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';

interface ScriptQuestion {
  id?: number;
  order?: number;
  text?: string;
  question?: string;
  type: string;
  required?: boolean;
  options?: string[];
  probes?: string[];
  branch?: {
    yes_goto?: number;
    no_goto?: number;
    yes_probes?: string[];
    no_probes?: string[];
  };
  section?: string;
  is_internal?: boolean;
  ai_extraction_hint?: string;
}

interface PublicScript {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  target_audience: string;
  questions: ScriptQuestion[];
  intro_script: string | null;
  rebuttal_script: string | null;
  closing_script: string | null;
}

const CAMPAIGN_LABELS: Record<string, string> = {
  satisfaction: 'Satisfaction',
  market_research: 'Market Research',
  retention: 'Retention',
};

const AUDIENCE_LABELS: Record<string, string> = {
  existing_member: 'Existing Members',
  former_booking: 'Former Bookings',
  rejected: 'Rejected Leads',
};

function groupBySection(questions: ScriptQuestion[]) {
  const sections: { name: string; questions: ScriptQuestion[] }[] = [];
  let current: { name: string; questions: ScriptQuestion[] } | null = null;

  for (const q of questions) {
    const sectionName = q.section || 'Questions';
    if (!current || current.name !== sectionName) {
      current = { name: sectionName, questions: [] };
      sections.push(current);
    }
    current.questions.push(q);
  }
  return sections;
}

function QuestionText({ q, index }: { q: ScriptQuestion; index: number }) {
  const text = q.text || q.question || '';

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-sm font-bold text-muted-foreground min-w-[28px] mt-0.5">
          Q{index + 1}.
        </span>
        <div className="flex-1 space-y-2">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-base font-medium leading-snug">{text}</p>
            {q.is_internal && (
              <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-600">
                Internal
              </Badge>
            )}
            {q.type === 'yes_no' && (
              <Badge variant="secondary" className="text-xs shrink-0">Yes / No</Badge>
            )}
          </div>

          {/* Yes/No branching */}
          {q.type === 'yes_no' && q.branch && (
            <div className="ml-1 space-y-2 border-l-2 border-primary/30 pl-3 mt-2">
              {(q.branch.yes_probes?.length || q.branch.yes_goto) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                    ✓ If YES:
                  </p>
                  {q.branch.yes_probes?.map((p, i) => (
                    <p key={i} className="text-sm text-muted-foreground pl-2">• {p}</p>
                  ))}
                </div>
              )}
              {(q.branch.no_probes?.length || q.branch.no_goto) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                    ✗ If NO:
                  </p>
                  {q.branch.no_probes?.map((p, i) => (
                    <p key={i} className="text-sm text-muted-foreground pl-2">• {p}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Multiple choice options */}
          {q.type === 'multiple_choice' && q.options?.length && (
            <div className="space-y-1 pl-2">
              {q.options.map((opt, i) => (
                <p key={i} className="text-sm text-muted-foreground">○ {opt}</p>
              ))}
            </div>
          )}

          {/* Probing follow-ups */}
          {q.probes && q.probes.length > 0 && (
            <div className="mt-2 space-y-1 bg-muted/40 rounded-md p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                ▾ Probing follow-ups
              </p>
              {q.probes.map((probe, i) => (
                <p key={i} className="text-sm text-muted-foreground pl-2">• {probe}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicScriptView() {
  const { token } = useParams<{ token: string }>();
  const [script, setScript] = useState<PublicScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('No token provided');
      setIsLoading(false);
      return;
    }

    supabase.functions.invoke('validate-script-token', { body: { token } })
      .then(({ data, error: fnError }) => {
        if (fnError) {
          setError('Unable to load script. Please try again.');
        } else if (!data?.valid) {
          setError(data?.error || 'Invalid or expired link.');
        } else {
          setScript(data.script);
        }
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading script…</p>
        </div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm mx-auto px-6">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-semibold">Link Unavailable</h1>
          <p className="text-muted-foreground text-sm">{error || 'This script link is invalid or has been revoked.'}</p>
        </div>
      </div>
    );
  }

  const sortedQuestions = [...(script.questions || [])].sort(
    (a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0)
  );
  const sections = groupBySection(sortedQuestions);

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header */}
      <div className="border-b bg-card print:border-gray-200 sticky top-0 z-10 print:static">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <img src={padsplitLogo} alt="PadSplit" className="h-8 w-8 rounded object-cover" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{script.name}</h1>
            {script.description && (
              <p className="text-xs text-muted-foreground truncate">{script.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge variant="outline" className="text-xs">
              {CAMPAIGN_LABELS[script.campaign_type] || script.campaign_type}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {AUDIENCE_LABELS[script.target_audience] || script.target_audience}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8 print:px-0">

        {/* Intro Script */}
        {script.intro_script && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Intro Script</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{script.intro_script}</p>
            </div>
          </section>
        )}

        {/* Sections */}
        {sections.map((section, si) => (
          <section key={si} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                Section {si + 1}: {section.name}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-5">
              {section.questions.map((q, qi) => {
                const globalIndex = sortedQuestions.indexOf(q);
                return (
                  <div key={qi} className="pl-0">
                    <QuestionText q={q} index={globalIndex} />
                    {qi < section.questions.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Rebuttal Script */}
        {script.rebuttal_script && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Rebuttal Script</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{script.rebuttal_script}</p>
            </div>
          </section>
        )}

        {/* Closing Script */}
        {script.closing_script && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Closing Script</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{script.closing_script}</p>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">PadSplit Operations · Read-only reference view</p>
        </div>
      </div>
    </div>
  );
}
