import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useCoachingSettings } from '@/hooks/useCoachingSettings';
import { Bell, Headphones, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CoachingReminderBanner() {
  const { user } = useAuth();
  const { agents } = useAgents();
  const { reminderEnabled, isLoading: settingsLoading } = useCoachingSettings();
  const [dismissed, setDismissed] = useState(false);
  const [pendingJeff, setPendingJeff] = useState(0);
  const [pendingKatty, setPendingKatty] = useState(0);

  const myAgent = agents.find(a => a.userId === user?.id);

  useEffect(() => {
    if (!myAgent || !reminderEnabled || settingsLoading) return;

    const fetchPending = async () => {
      // Jeff pending: has coaching_audio_url but no coaching_quiz_passed_at
      const { data: jeffData } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, bookings!inner(agent_id, agents!inner(user_id))')
        .not('coaching_audio_url', 'is', null)
        .is('coaching_quiz_passed_at', null)
        .eq('bookings.agents.user_id', user!.id);

      // Katty pending: has qa_coaching_audio_url but no qa_coaching_quiz_passed_at
      const { data: kattyData } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, bookings!inner(agent_id, agents!inner(user_id))')
        .not('qa_coaching_audio_url', 'is', null)
        .is('qa_coaching_quiz_passed_at', null)
        .eq('bookings.agents.user_id', user!.id);

      setPendingJeff(jeffData?.length || 0);
      setPendingKatty(kattyData?.length || 0);
    };

    fetchPending();
  }, [myAgent, user, reminderEnabled, settingsLoading]);

  if (!reminderEnabled || settingsLoading || dismissed || (pendingJeff === 0 && pendingKatty === 0)) {
    return null;
  }

  const total = pendingJeff + pendingKatty;

  return (
    <div className="relative flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-4">
      <Bell className="h-5 w-5 text-amber-500 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          You have {total} coaching session{total !== 1 ? 's' : ''} pending review
        </p>
        <p className="text-xs text-muted-foreground">
          {pendingJeff > 0 && (
            <span>🎧 {pendingJeff} from Jeff (Coach)</span>
          )}
          {pendingJeff > 0 && pendingKatty > 0 && <span> · </span>}
          {pendingKatty > 0 && (
            <span>🎙️ {pendingKatty} from Katty (QA)</span>
          )}
          {' — '}Listen and complete the quiz to mark as done.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
