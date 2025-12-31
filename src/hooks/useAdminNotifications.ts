import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminNotification {
  id: string;
  notification_type: string;
  service: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  is_resolved: boolean;
  metadata: Record<string, any>;
  created_at: string;
  resolved_at: string | null;
}

export function useAdminNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AdminNotification[];
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const markAsResolved = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const unresolvedNotifications = notifications.filter(n => !n.is_resolved);
  const resolvedNotifications = notifications.filter(n => n.is_resolved);
  const criticalNotifications = unresolvedNotifications.filter(n => n.severity === 'critical');
  const unreadCount = unresolvedNotifications.filter(n => !n.is_read).length;

  return {
    notifications,
    unresolvedNotifications,
    resolvedNotifications,
    criticalNotifications,
    unreadCount,
    isLoading,
    error,
    refetch,
    markAsRead: markAsRead.mutate,
    markAsResolved: markAsResolved.mutate,
    deleteNotification: deleteNotification.mutate,
    isMarkingRead: markAsRead.isPending,
    isMarkingResolved: markAsResolved.isPending,
  };
}
