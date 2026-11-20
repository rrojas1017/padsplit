// CR-018 phase 2: "N respondents — <answer>" side panel. No source labels; nothing logged.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { callerIdentity, formatCallerPhone, isRealCallerName } from '@/utils/callerIdentity';
import { maskPhone, shouldMaskContactInfo } from '@/utils/contactPrivacy';

export interface RespondentsSelection {
  title: string;
  question: string;
  records: ScriptSurveyRecord[];
  /** CR-019: the person's own answer ("Other" panels only). */
  answerFor?: (r: ScriptSurveyRecord) => string | null;
}

interface Props {
  selection: RespondentsSelection | null;
  onClose: () => void;
  campaignName?: (id: string | null) => string | null;
  listName?: (id: string | null) => string | null;
  /** CR-020: open the call panel in place (no navigation). */
  onOpenCall?: (r: ScriptSurveyRecord) => void;
  activeBookingId?: string | null;
  /** Shift left so the call panel fits beside it (≥1024px). */
  shifted?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}

const PAGE = 50;

export function useRecordIdentity() {
  const { user } = useAuth();
  const mask = shouldMaskContactInfo(user?.role);
  return (r: Pick<ScriptSurveyRecord, 'member_name' | 'contact_phone'>) => {
    const id = callerIdentity({ name: r.member_name, phone: r.contact_phone });
    const formatted = formatCallerPhone(r.contact_phone);
    if (!mask || !r.contact_phone) return { ...id, phone: formatted };
    const masked = maskPhone(r.contact_phone);
    // Real name stays; any phone shown is masked.
    return isRealCallerName(r.member_name)
      ? { primary: id.primary, secondary: masked, phone: masked }
      : { primary: masked, secondary: null, phone: masked };
  };
}

export const fmtCallDate = (d: string) => (d ? format(new Date(d + 'T00:00:00'), 'MMM d, yyyy') : '—');

export function RespondentsSheet({ selection, onClose, campaignName, listName, onOpenCall, activeBookingId, shifted, onEscapeKeyDown }: Props) {
  const navigate = useNavigate();
  const { agents } = useAgents();
  const identity = useRecordIdentity();
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [selection]);
  const recs = selection?.records ?? [];

  return (
    <Sheet open={!!selection} onOpenChange={(o) => { if (!o) onClose(); }} modal={!onOpenCall}>
      <SheetContent
        side="right"
        data-respondents-sheet=""
        id="respondents-sheet"
        tabIndex={-1}
        onEscapeKeyDown={onEscapeKeyDown}
        hideOverlay={!!onOpenCall}
        // CR-020: closes only via X / Escape / the shared overlay (handled by the dashboard).
        onInteractOutside={onOpenCall ? (e) => e.preventDefault() : undefined}
        className={cn('w-full sm:max-w-lg overflow-y-auto transition-[right] duration-300 ease-out', shifted && 'lg:right-[32rem]')}
      >
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
                  <li key={r.booking_id} className={cn('py-3 flex items-start justify-between gap-3', activeBookingId === r.booking_id && 'bg-muted -mx-2 px-2 rounded-md')}>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-semibold text-sm text-foreground truncate">{id.primary}</p>
                      {id.secondary && <p className="text-xs text-muted-foreground">{id.secondary}</p>}
                      <p className="text-xs text-muted-foreground">
                        {[fmtCallDate(r.booking_date), agent, camp, list].filter(Boolean).join(' · ')}
                      </p>
                      {(() => { const t = selection.answerFor?.(r); return t ? <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words pt-1">{t}</p> : null; })()}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      data-open-call={r.booking_id}
                      disabled={!!onOpenCall && activeBookingId === r.booking_id}
                      onClick={() => (onOpenCall ? onOpenCall(r) : navigate(`/reports?booking=${encodeURIComponent(r.booking_id)}`))}
                    >
                      {onOpenCall && activeBookingId === r.booking_id ? 'Viewing' : 'Open call'}
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
