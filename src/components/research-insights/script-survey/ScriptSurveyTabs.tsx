// Generic twin of PE InsightTabs (CR-010 Phase 2). Same TabsList / trigger
// look, with wrapping on narrow screens.
import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export interface ScriptSurveyTab {
  key: string;
  label: string;
  title?: string;
  badge?: number;
  content: ReactNode;
}

const TRIGGER_CLASS =
  'gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-5 py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none';

export function ScriptSurveyTabs({ tabs }: { tabs: ScriptSurveyTab[] }) {
  const [tab, setTab] = useState<string>(tabs[0]?.key ?? 'overview');
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full mt-1">
      <TabsList className="h-auto w-full flex-wrap justify-start rounded-none border-b border-border bg-transparent p-0 mb-1">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className={TRIGGER_CLASS} title={t.title}>
            {t.label}
            {t.badge != null && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-medium tabular-nums">
                {t.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} className="mt-2">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
