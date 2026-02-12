import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScriptQuestion {
  order: number;
  question: string;
  type: 'scale' | 'open_ended' | 'multiple_choice' | 'yes_no';
  options?: string[];
  required: boolean;
  ai_extraction_hint?: string;
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
}

export function useResearchScripts() {
  const [scripts, setScripts] = useState<ResearchScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      }));
      setScripts(mapped);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const createScript = async (script: Omit<ResearchScript, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('research_scripts').insert({
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
    });
    if (error) {
      toast.error('Failed to create script');
      throw error;
    }
    toast.success('Script created successfully');
    await fetchScripts();
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
  };

  const deleteScript = async (id: string) => {
    const { error } = await supabase.from('research_scripts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete script');
      throw error;
    }
    toast.success('Script deleted successfully');
    await fetchScripts();
  };

  return { scripts, isLoading, fetchScripts, createScript, updateScript, deleteScript };
}
