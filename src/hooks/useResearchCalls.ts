import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface ResearchCallCampaign {
  id: string;
  name: string;
  script_id: string;
  status: string;
  target_count: number;
  start_date: string | null;
  end_date: string | null;
  script?: {
    id: string;
    name: string;
    questions: ScriptQuestion[];
    intro_script: string | null;
    rebuttal_script: string | null;
    closing_script: string | null;
  };
  completed_calls: number;
}

export interface ScriptQuestionBranch {
  yes_goto?: number;
  no_goto?: number;
  yes_probes?: string[];
  no_probes?: string[];
}

export interface ScriptQuestion {
  id: number;
  order?: number;
  text: string;
  type: 'scale' | 'open_ended' | 'multiple_choice' | 'yes_no';
  required?: boolean;
  options?: string[];
  probes?: string[];
  branch?: ScriptQuestionBranch;
  section?: string;
  is_internal?: boolean;
  ai_extraction_hint?: string;
}

export interface ResearchCall {
  id: string;
  campaign_id: string;
  campaign_name?: string;
  researcher_id: string;
  caller_name: string;
  caller_phone: string | null;
  caller_type: string;
  caller_status: string | null;
  call_date: string;
  call_duration_seconds: number | null;
  call_outcome: string;
  transferred_to_agent_id: string | null;
  transfer_notes: string | null;
  responses: Record<string, unknown> | null;
  researcher_notes: string | null;
  created_at: string;
}

export interface CallSubmission {
  campaign_id: string;
  caller_name: string;
  caller_first_name?: string;
  caller_last_name?: string;
  caller_phone?: string;
  caller_type: string;
  caller_status?: string;
  call_outcome: string;
  call_duration_seconds?: number;
  transferred_to_agent_id?: string;
  transfer_notes?: string;
  researcher_name?: string;
  responses?: Record<string, unknown>;
  researcher_notes?: string;
  language?: string;
}

export function useResearchCalls() {
  const [myCampaigns, setMyCampaigns] = useState<ResearchCallCampaign[]>([]);
  const [myCalls, setMyCalls] = useState<ResearchCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMyCampaigns = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('research_campaigns')
      .select('*, research_scripts(id, name, questions, intro_script, rebuttal_script, closing_script)')
      .contains('assigned_researchers', [user.id])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return;
    }

    const campaignIds = (data || []).map(c => c.id);
    let callCounts: Record<string, number> = {};

    if (campaignIds.length > 0) {
      const { data: callData } = await supabase
        .from('research_calls')
        .select('campaign_id')
        .in('campaign_id', campaignIds)
        .eq('call_outcome', 'completed');

      if (callData) {
        callData.forEach(c => {
          callCounts[c.campaign_id] = (callCounts[c.campaign_id] || 0) + 1;
        });
      }
    }

    const mapped: ResearchCallCampaign[] = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      script_id: c.script_id,
      status: c.status,
      target_count: c.target_count,
      start_date: c.start_date,
      end_date: c.end_date,
      script: c.research_scripts ? {
        id: c.research_scripts.id,
        name: c.research_scripts.name,
        questions: (c.research_scripts.questions || []) as ScriptQuestion[],
        intro_script: c.research_scripts.intro_script || null,
        rebuttal_script: c.research_scripts.rebuttal_script || null,
        closing_script: c.research_scripts.closing_script || null,
      } : undefined,
      completed_calls: callCounts[c.id] || 0,
    }));

    setMyCampaigns(mapped);
  }, []);

  const fetchMyCalls = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('research_calls')
      .select('*, research_campaigns(name)')
      .eq('researcher_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching calls:', error);
      return;
    }

    const mapped: ResearchCall[] = (data || []).map((c: any) => ({
      id: c.id,
      campaign_id: c.campaign_id,
      campaign_name: c.research_campaigns?.name || 'Unknown',
      researcher_id: c.researcher_id,
      caller_name: c.caller_name,
      caller_phone: c.caller_phone,
      caller_type: c.caller_type,
      caller_status: c.caller_status,
      call_date: c.call_date,
      call_duration_seconds: c.call_duration_seconds,
      call_outcome: c.call_outcome,
      transferred_to_agent_id: c.transferred_to_agent_id,
      transfer_notes: c.transfer_notes,
      responses: c.responses as Record<string, unknown> | null,
      researcher_notes: c.researcher_notes,
      created_at: c.created_at,
    }));

    setMyCalls(mapped);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchMyCampaigns(), fetchMyCalls()]);
      setIsLoading(false);
    };
    load();
  }, [fetchMyCampaigns, fetchMyCalls]);

  const submitCall = async (submission: CallSubmission) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in');
      return false;
    }

    setIsSubmitting(true);

    // Enrich responses with researcher and caller metadata
    const enrichedResponses: Record<string, unknown> = {
      ...(submission.responses || {}),
      _researcher_name: submission.researcher_name || '',
      _caller_first_name: submission.caller_first_name || '',
      _caller_last_name: submission.caller_last_name || '',
    };
    
    // Step 1: Insert into research_calls
    const { data: researchCallData, error } = await supabase.from('research_calls').insert({
      campaign_id: submission.campaign_id,
      researcher_id: user.id,
      caller_name: submission.caller_name,
      caller_phone: submission.caller_phone || null,
      caller_type: submission.caller_type,
      caller_status: submission.caller_status || null,
      call_outcome: submission.call_outcome,
      call_duration_seconds: submission.call_duration_seconds || null,
      transferred_to_agent_id: submission.transferred_to_agent_id || null,
      transfer_notes: submission.transfer_notes || null,
      responses: enrichedResponses as Json,
      researcher_notes: submission.researcher_notes || null,
      language: submission.language || 'en',
    }).select('id').single();

    if (error) {
      setIsSubmitting(false);
      console.error('Error submitting call:', error);
      toast.error('Failed to submit call');
      return false;
    }

    // Step 2: Also insert into bookings table for centralized reporting
    try {
      // Get any valid agent_id (required field) - use first available agent
      const { data: anyAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('active', true)
        .limit(1)
        .single();

      if (anyAgent) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('bookings').insert({
          record_type: 'research',
          research_call_id: researchCallData.id,
          member_name: submission.caller_name,
          booking_date: today,
          move_in_date: today, // Required column, displayed as "--" for research
          booking_type: 'Research',
          status: 'Research',
          agent_id: anyAgent.id,
          contact_phone: submission.caller_phone || null,
          created_by: user.id,
          notes: submission.researcher_notes || null,
          call_duration_seconds: submission.call_duration_seconds || null,
        });
      }
    } catch (bookingErr) {
      // Non-fatal: research call was saved, just log the booking insert failure
      console.error('Error creating booking record for research call:', bookingErr);
    }

    setIsSubmitting(false);
    toast.success('Call logged successfully');
    await Promise.all([fetchMyCampaigns(), fetchMyCalls()]);
    return true;
  };

  return {
    myCampaigns,
    myCalls,
    isLoading,
    isSubmitting,
    fetchMyCampaigns,
    fetchMyCalls,
    submitCall,
  };
}
