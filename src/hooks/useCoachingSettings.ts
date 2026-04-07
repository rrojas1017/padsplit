import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CoachingSettings {
  id: string;
  quizEnforcementEnabled: boolean;
  reminderEnabled: boolean;
  costAlertsEnabled: boolean;
}

let cachedSettings: CoachingSettings | null = null;

export function useCoachingSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CoachingSettings | null>(cachedSettings);
  const [isLoading, setIsLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (!user) return;
    if (cachedSettings) {
      setSettings(cachedSettings);
      setIsLoading(false);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('coaching_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const s: CoachingSettings = {
          id: data.id,
          quizEnforcementEnabled: data.quiz_enforcement_enabled,
          reminderEnabled: data.reminder_enabled,
          costAlertsEnabled: (data as any).cost_alerts_enabled ?? true,
        };
        cachedSettings = s;
        setSettings(s);
      }
      setIsLoading(false);
    };
    fetch();
  }, [user]);

  const updateSettings = async (updates: Partial<Pick<CoachingSettings, 'quizEnforcementEnabled' | 'reminderEnabled' | 'costAlertsEnabled'>>) => {
    if (!settings) return;

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user?.id };
    if (updates.quizEnforcementEnabled !== undefined) dbUpdates.quiz_enforcement_enabled = updates.quizEnforcementEnabled;
    if (updates.reminderEnabled !== undefined) dbUpdates.reminder_enabled = updates.reminderEnabled;
    if (updates.costAlertsEnabled !== undefined) dbUpdates.cost_alerts_enabled = updates.costAlertsEnabled;

    const { error } = await supabase
      .from('coaching_settings')
      .update(dbUpdates)
      .eq('id', settings.id);

    if (error) {
      toast.error('Failed to update coaching settings');
      return;
    }

    const updated = { ...settings, ...updates };
    cachedSettings = updated;
    setSettings(updated);
    toast.success('Coaching settings updated');
  };

  return {
    quizEnforcementEnabled: settings?.quizEnforcementEnabled ?? true,
    reminderEnabled: settings?.reminderEnabled ?? true,
    costAlertsEnabled: settings?.costAlertsEnabled ?? true,
    isLoading,
    updateSettings,
  };
}
