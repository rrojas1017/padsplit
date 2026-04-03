import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useScriptTranslation } from './useScriptTranslation';

export interface ScriptQuestion {
  order: number;
  question: string;
  type: 'scale' | 'open_ended' | 'multiple_choice' | 'yes_no';
  options?: string[];
  required: boolean;
  ai_extraction_hint?: string;
  section?: string;
  probes?: string[];
  branch?: {
    yes_goto?: number;
    no_goto?: number;
    yes_probes?: string[];
    no_probes?: string[];
  };
  is_internal?: boolean;
}

export interface ResearchScript {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  target_audience: string;
  questions: ScriptQuestion[];
  intro_script: string | null;
  rebuttal_script: string | null;
  closing_script: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Translation fields
  intro_script_es: string | null;
  closing_script_es: string | null;
  rebuttal_script_es: string | null;
  questions_es: ScriptQuestion[] | null;
  translation_status: string | null;
  // Wizard fields
  script_type: string | null;
  ai_prompt: string | null;
  ai_model: string | null;
  ai_temperature: number | null;
  slug: string | null;
  status: string | null;
}

export function useResearchScripts() {
  const [scripts, setScripts] = useState<ResearchScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { translateAndStore } = useScriptTranslation();

  const fetchScripts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('research_scripts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching research scripts:', error);
      toast.error('Failed to load research scripts');
    } else {
      const mapped = (data || []).map((s: any) => ({
        ...s,
        questions: (s.questions as ScriptQuestion[]) || [],
        questions_es: (s.questions_es as ScriptQuestion[]) || null,
        translation_status: s.translation_status || 'pending',
        script_type: s.script_type || 'qualitative',
        ai_prompt: s.ai_prompt || null,
        ai_model: s.ai_model || 'gemini-2.5-flash',
        ai_temperature: s.ai_temperature ?? 0.2,
        slug: s.slug || s.campaign_type,
        status: s.status || 'active',
      }));
      setScripts(mapped);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const triggerTranslation = useCallback(async (scriptId: string, script: {
    intro_script: string | null;
    closing_script: string | null;
    rebuttal_script: string | null;
    questions: ScriptQuestion[];
  }) => {
    // Fire in background, don't await
    translateAndStore(scriptId, script).then(() => {
      fetchScripts(); // Refresh to get updated status
    });
  }, [translateAndStore, fetchScripts]);

  const createScript = async (script: Omit<ResearchScript, 'id' | 'created_at' | 'updated_at' | 'created_by'> & { intro_script_es?: string | null; closing_script_es?: string | null; rebuttal_script_es?: string | null; questions_es?: ScriptQuestion[] | null; translation_status?: string | null }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('research_scripts').insert({
      name: script.name,
      description: script.description,
      campaign_type: script.campaign_type,
      target_audience: script.target_audience,
      questions: script.questions as any,
      intro_script: script.intro_script || null,
      rebuttal_script: script.rebuttal_script || null,
      closing_script: script.closing_script || null,
      is_active: script.is_active,
      created_by: user?.id || null,
    }).select('id').single();
    if (error) {
      toast.error('Failed to create script');
      throw error;
    }
    toast.success('Script created successfully');
    await fetchScripts();

    // Auto-translate in background
    if (data?.id) {
      triggerTranslation(data.id, {
        intro_script: script.intro_script || null,
        closing_script: script.closing_script || null,
        rebuttal_script: script.rebuttal_script || null,
        questions: script.questions,
      });
    }
  };

  const updateScript = async (id: string, updates: Partial<Omit<ResearchScript, 'id' | 'created_at' | 'updated_at' | 'created_by'>>) => {
    const payload: any = { ...updates };
    if (updates.questions) payload.questions = updates.questions as any;
    const { error } = await supabase.from('research_scripts').update(payload).eq('id', id);
    if (error) {
      toast.error('Failed to update script');
      throw error;
    }
    toast.success('Script updated successfully');
    await fetchScripts();

    // Re-translate in background (need full script data)
    const updated = scripts.find(s => s.id === id);
    const mergedScript = {
      intro_script: updates.intro_script ?? updated?.intro_script ?? null,
      closing_script: updates.closing_script ?? updated?.closing_script ?? null,
      rebuttal_script: updates.rebuttal_script ?? updated?.rebuttal_script ?? null,
      questions: (updates.questions ?? updated?.questions ?? []) as ScriptQuestion[],
    };
    triggerTranslation(id, mergedScript);
  };

  const retranslateScript = useCallback(async (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;
    triggerTranslation(id, {
      intro_script: script.intro_script,
      closing_script: script.closing_script,
      rebuttal_script: script.rebuttal_script,
      questions: script.questions,
    });
  }, [scripts, triggerTranslation]);

  const deleteScript = async (id: string) => {
    const { error } = await supabase.from('research_scripts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete script');
      throw error;
    }
    toast.success('Script deleted successfully');
    await fetchScripts();
  };

  return { scripts, isLoading, fetchScripts, createScript, updateScript, deleteScript, retranslateScript };
}
