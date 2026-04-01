import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ResearchCampaign {
  id: string;
  name: string;
  campaign_key: string;
  script_id: string;
  script_name?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  target_count: number;
  start_date: string | null;
  end_date: string | null;
  assigned_researchers: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_calls?: number;
}

export interface ResearcherProfile {
  id: string;
  name: string | null;
  email: string | null;
}

export type CampaignInput = Omit<ResearchCampaign, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'script_name' | 'completed_calls'>;

export function useResearchCampaigns() {
  const [campaigns, setCampaigns] = useState<ResearchCampaign[]>([]);
  const [researchers, setResearchers] = useState<ResearcherProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResearchers = useCallback(async () => {
    // Get user IDs with 'researcher' role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'researcher');

    if (roleError || !roleData?.length) {
      setResearchers([]);
      return;
    }

    const userIds = roleData.map(r => r.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    if (profileError) {
      console.error('Error fetching researchers:', profileError);
    } else {
      setResearchers(profiles || []);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);

    // Fetch campaigns with script name
    const { data, error } = await supabase
      .from('research_campaigns')
      .select('*, research_scripts(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
      setIsLoading(false);
      return;
    }

    const campaignsList = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      script_id: c.script_id,
      script_name: c.research_scripts?.name || 'Unknown Script',
      status: c.status as ResearchCampaign['status'],
      target_count: c.target_count,
      start_date: c.start_date,
      end_date: c.end_date,
      assigned_researchers: c.assigned_researchers || [],
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
      completed_calls: 0,
    }));

    // Fetch completed call counts for each campaign
    if (campaignsList.length > 0) {
      const campaignIds = campaignsList.map(c => c.id);
      const { data: callData } = await supabase
        .from('research_calls')
        .select('campaign_id, call_outcome')
        .in('campaign_id', campaignIds)
        .eq('call_outcome', 'completed');

      if (callData) {
        const countMap: Record<string, number> = {};
        callData.forEach(c => {
          countMap[c.campaign_id] = (countMap[c.campaign_id] || 0) + 1;
        });
        campaignsList.forEach(c => {
          c.completed_calls = countMap[c.id] || 0;
        });
      }
    }

    setCampaigns(campaignsList);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetchResearchers();
  }, [fetchCampaigns, fetchResearchers]);

  const createCampaign = async (input: CampaignInput) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('research_campaigns').insert({
      name: input.name,
      script_id: input.script_id,
      status: input.status,
      target_count: input.target_count,
      start_date: input.start_date,
      end_date: input.end_date,
      assigned_researchers: input.assigned_researchers,
      created_by: user?.id || null,
    });
    if (error) {
      toast.error('Failed to create campaign');
      throw error;
    }
    toast.success('Campaign created successfully');
    await fetchCampaigns();
  };

  const updateCampaign = async (id: string, updates: Partial<CampaignInput>) => {
    const { error } = await supabase
      .from('research_campaigns')
      .update(updates)
      .eq('id', id);
    if (error) {
      toast.error('Failed to update campaign');
      throw error;
    }
    toast.success('Campaign updated successfully');
    await fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    // Check for existing calls
    const { count } = await supabase
      .from('research_calls')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id);

    if (count && count > 0) {
      toast.error(`Cannot delete: ${count} calls are linked to this campaign`);
      return;
    }

    const { error } = await supabase
      .from('research_campaigns')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Failed to delete campaign');
      throw error;
    }
    toast.success('Campaign deleted');
    await fetchCampaigns();
  };

  return { campaigns, researchers, isLoading, fetchCampaigns, createCampaign, updateCampaign, deleteCampaign };
}
