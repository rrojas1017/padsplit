import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BroadcastMessage {
  id: string;
  message: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  priority: number;
  site_id: string | null;
  target_role: string;
  // Joined data
  creator_name?: string;
  site_name?: string;
}

interface UseBroadcastMessagesOptions {
  /** If true, fetches all broadcasts for management (supervisors+) */
  forManagement?: boolean;
}

export function useBroadcastMessages(options: UseBroadcastMessagesOptions = {}) {
  const { forManagement = false } = options;
  const { user, hasRole } = useAuth();
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBroadcasts = useCallback(async () => {
    if (!user) {
      setBroadcasts([]);
      setIsLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('broadcast_messages')
        .select(`
          *,
          profiles:created_by(name),
          sites:site_id(name)
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      // For management view, fetch all broadcasts the user can manage
      // For display view, only active non-expired broadcasts are returned by RLS
      if (!forManagement) {
        query = query
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.now()');
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData: BroadcastMessage[] = (data || []).map((item: any) => ({
        id: item.id,
        message: item.message,
        created_by: item.created_by,
        created_at: item.created_at,
        expires_at: item.expires_at,
        is_active: item.is_active,
        priority: item.priority,
        site_id: item.site_id,
        target_role: item.target_role,
        creator_name: item.profiles?.name || 'Unknown',
        site_name: item.sites?.name || null,
      }));

      setBroadcasts(formattedData);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, forManagement]);

  // Initial fetch
  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('broadcast_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_messages',
        },
        () => {
          fetchBroadcasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchBroadcasts]);

  // CRUD operations for management
  const createBroadcast = async (data: {
    message: string;
    expires_at?: string | null;
    site_id?: string | null;
    priority?: number;
    target_role?: string;
  }) => {
    try {
      const { error } = await supabase.from('broadcast_messages').insert({
        message: data.message,
        expires_at: data.expires_at || null,
        site_id: data.site_id || null,
        priority: data.priority || 0,
        target_role: data.target_role || 'agent',
        created_by: user?.id,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Broadcast created successfully');
      return true;
    } catch (error) {
      console.error('Error creating broadcast:', error);
      toast.error('Failed to create broadcast');
      return false;
    }
  };

  const updateBroadcast = async (
    id: string,
    data: Partial<{
      message: string;
      expires_at: string | null;
      site_id: string | null;
      priority: number;
      is_active: boolean;
      target_role: string;
    }>
  ) => {
    try {
      const { error } = await supabase
        .from('broadcast_messages')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      toast.success('Broadcast updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating broadcast:', error);
      toast.error('Failed to update broadcast');
      return false;
    }
  };

  const deleteBroadcast = async (id: string) => {
    try {
      const { error } = await supabase
        .from('broadcast_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Broadcast deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      toast.error('Failed to delete broadcast');
      return false;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateBroadcast(id, { is_active: isActive });
  };

  return {
    broadcasts,
    isLoading,
    refetch: fetchBroadcasts,
    createBroadcast,
    updateBroadcast,
    deleteBroadcast,
    toggleActive,
  };
}
