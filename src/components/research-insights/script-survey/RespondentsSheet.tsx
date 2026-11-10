// CR-018 phase 2: "N respondents — <answer>" side panel. No source labels; nothing logged.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { callerIdentity } from '@/utils/callerIdentity';
import { maskPhone, shouldMaskContactInfo } from '@/utils/contactPrivacy';

export interface RespondentsSelection { title: string; question: string; records: ScriptSurveyRecord[] }

interface Props {
  selection: RespondentsSelection | null;
  onClose: () => void;
  campaignName?: (id: string | null) => string | null;
  listName?: (id: string | null) => string | null;
}

const PAGE = 50;

export function useRecordIdentity() {
  const { user } = useAuth();
  const mask = shouldMaskContactInfo(user?.role);
  return (r: Pick<ScriptSurveyRecord, 'member_name' | 'contact_phone'>) => {
    const id = callerIdentity({ name: r.member_name, phone: mask ? null : r.contact_phone });
    if (!mask || !r.contact_phone) return { ...id, phone: mask && r.contact_phone ? maskPhone(r.contact_phone) : id.secondary ?? (id.primary !== 'Unknown caller' && !r.member_name ? id.primary : null) };
    const masked = maskPhone(r.contact_phone);
    return id.primary === 'Unknown caller'
      ? { primary: masked, secondary: null, phone: masked }
      : { primary: id.primary, secondary: masked, phone: masked };
  };
}

export const fmtCallDate = (d: string) => (d ? format(new Date(d + 'T00:00:00'), 'MMM d, yyyy') : '—');

export function RespondentsSheet({ selection, onClose, campaignName, listName }: Props) {
  const navigate = useNavigate();
  const { agents } = useAgents();
  const identity = useRecordIdentity();
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [selection]);
  const recs = selection?.records ?? [];

  return (
    <Sheet open={!!selection} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {selection && (
          <>
            <SheetHeader className="text-left space-y-1">
              <SheetTitle>{recs.length} respondent{recs.length === 1 ? '' : 's'} — {selection.title}</SheetTitle>
              <SheetDescription>{selection.question}</SheetDescription>
            </SheetHeader>
            <ul className="mt-4 divide-y divide-border">
              {recs.slice(0, shown).map((r) => {
                const id = identity(r);
                const camp = campaignName?.(r.campaign_id);
                const list = listName?.(r.list_id);
                const agent = agents.find((a) => a.id === r.agent_id)?.name;
                return (
                  <li key={r.booking_id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-sm text-foreground truncate">{id.primary}</p>
                      {id.secondary && <p className="text-xs text-muted-foreground">{id.secondary}</p>}
                      <p className="text-xs text-muted-foreground">
                        {[fmtCallDate(r.booking_date), agent, camp, list].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate(`/reports?booking=${encodeURIComponent(r.booking_id)}`)}>
                      Open call
                    </Button>
                  </li>
                );
              })}
            </ul>
            {shown < recs.length && (
              <Button variant="ghost" className="w-full mt-2" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
