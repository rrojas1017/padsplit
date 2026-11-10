// CR-018: right-side call panel for Reports › Research. Read-only, no source labels.
import { format } from 'date-fns';
import { FileText, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Booking } from '@/types';
import { callerIdentity } from '@/utils/callerIdentity';
import { maskPhone } from '@/utils/contactPrivacy';
import { researchCampaignLabel } from '@/utils/researchCampaignType';
import { useResearchCallAnswers } from '@/hooks/useResearchCallAnswers';

interface Props {
  booking: Booking | null;
  agentName: string;
  maskContact: boolean;
  onClose: () => void;
  onOpenTranscript: (b: Booking) => void;
}

const mss = (s?: number) => {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ResearchCallPanel({ booking, agentName, maskContact, onClose, onOpenTranscript }: Props) {
  const { isLoading, groups, hasAnswers } = useResearchCallAnswers(booking?.id ?? null, booking?.researchCallId);
  const id = booking
    ? callerIdentity({ name: booking.memberName, phone: maskContact ? null : booking.contactPhone })
    : null;
  // Masked users: phone fallback uses masked value.
  const primary = id && booking && maskContact && id.primary === 'Unknown caller' && booking.contactPhone
    ? maskPhone(booking.contactPhone) : id?.primary;
  const secondary = id && booking && maskContact && id.primary !== 'Unknown caller' && booking.contactPhone
    ? maskPhone(booking.contactPhone) : id?.secondary;

  return (
    <Sheet open={!!booking} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {booking && (
          <>
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-2xl">{primary}</SheetTitle>
              {secondary && <SheetDescription className="text-sm">{secondary}</SheetDescription>}
            </SheetHeader>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Call date</dt><dd>{format(booking.bookingDate, 'MMM d, yyyy')}</dd>
              <dt className="text-muted-foreground">Agent</dt><dd>{agentName}</dd>
              <dt className="text-muted-foreground">Survey</dt><dd>{booking.researchCampaignType ? researchCampaignLabel(booking.researchCampaignType) : '—'}</dd>
              <dt className="text-muted-foreground">Duration</dt><dd>{mss(booking.callDurationSeconds)}</dd>
            </dl>
            {(booking.kixieLink || booking.transcriptionStatus === 'completed') && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => onOpenTranscript(booking)}>
                <FileText className="h-3.5 w-3.5" /> Transcript
              </Button>
            )}
            <section className="mt-6">
              <h3 className="text-sm font-semibold mb-3">Answers</h3>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : !hasAnswers ? (
                <p className="text-sm text-muted-foreground">No survey answers for this call.</p>
              ) : (
                <ol className="space-y-4">
                  {groups.map((g) => (
                    <li key={g.key} className="space-y-2">
                      {g.title && <p className="text-sm font-medium">{g.title}</p>}
                      <ul className={g.title ? 'pl-3 border-l border-border space-y-2' : 'space-y-2'}>
                        {g.items.map((it) => (
                          <li key={it.key}>
                            <p className="text-xs text-muted-foreground">{it.label}</p>
                            {it.answer ? <p className="text-sm text-foreground whitespace-pre-wrap">{it.answer}</p>
                              : <p className="text-sm text-muted-foreground italic">Not answered</p>}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
