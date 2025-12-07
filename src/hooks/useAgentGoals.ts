import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, format } from 'date-fns';

export interface AgentGoal {
  id: string;
  agent_id: string;
  weekly_target: number;
  daily_target: number;
  week_start: string;
  week_end: string;
  set_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentGoalWithProgress extends AgentGoal {
  agent_name: string;
  site_id: string;
  site_name: string;
  current_bookings: number;
  progress_percentage: number;
  set_by_name?: string;
}

export function useAgentGoals(weekStart?: Date) {
  const { user, hasRole } = useAuth();
  const [goals, setGoals] = useState<AgentGoalWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize dates to prevent infinite re-renders (Date objects create new references each render)
  const selectedWeekStart = useMemo(
    () => weekStart || startOfWeek(new Date(), { weekStartsOn: 1 }),
    [weekStart]
  );
  
  const selectedWeekEnd = useMemo(
    () => endOfWeek(selectedWeekStart, { weekStartsOn: 1 }),
    [selectedWeekStart]
  );

  // Memoize string versions for stable useCallback dependencies
  const weekStartStr = useMemo(() => format(selectedWeekStart, 'yyyy-MM-dd'), [selectedWeekStart]);
  const weekEndStr = useMemo(() => format(selectedWeekEnd, 'yyyy-MM-dd'), [selectedWeekEnd]);

  const fetchGoals = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {

      // Fetch goals for the selected week (use the memoized string values)
      const { data: goalsData, error: goalsError } = await supabase
        .from('agent_goals')
        .select('*')
        .eq('week_start', weekStartStr);

      if (goalsError) throw goalsError;

      // Fetch agents with their sites
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, site_id, sites(name)')
        .eq('active', true);

      if (agentsError) throw agentsError;

      // Fetch bookings for the week to calculate progress
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('agent_id, status')
        .gte('booking_date', weekStartStr)
        .lte('booking_date', weekEndStr)
        .in('status', ['Pending Move-In', 'Moved In']);

      if (bookingsError) throw bookingsError;

      // Fetch supervisor names for set_by
      const setByIds = goalsData?.map(g => g.set_by).filter(Boolean) || [];
      let supervisorNames: Record<string, string> = {};
      
      if (setByIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', setByIds);
        
        if (profilesData) {
          supervisorNames = profilesData.reduce((acc, p) => {
            acc[p.id] = p.name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Count bookings per agent
      const bookingsByAgent: Record<string, number> = {};
      bookingsData?.forEach(booking => {
        bookingsByAgent[booking.agent_id] = (bookingsByAgent[booking.agent_id] || 0) + 1;
      });

      // Map goals with agent info and progress
      const goalsWithProgress: AgentGoalWithProgress[] = (goalsData || []).map(goal => {
        const agent = agentsData?.find(a => a.id === goal.agent_id);
        const currentBookings = bookingsByAgent[goal.agent_id] || 0;
        const progressPercentage = goal.weekly_target > 0 
          ? Math.round((currentBookings / goal.weekly_target) * 100) 
          : 0;

        return {
          ...goal,
          agent_name: agent?.name || 'Unknown Agent',
          site_id: agent?.site_id || '',
          site_name: (agent?.sites as any)?.name || 'Unknown Site',
          current_bookings: currentBookings,
          progress_percentage: progressPercentage,
          set_by_name: goal.set_by ? supervisorNames[goal.set_by] : undefined,
        };
      });

      setGoals(goalsWithProgress);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError('Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  }, [user, weekStartStr, weekEndStr]); // Use stable string dependencies

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const upsertGoal = async (
    agentId: string, 
    weeklyTarget: number, 
    notes?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('agent_goals')
        .upsert({
          agent_id: agentId,
          weekly_target: weeklyTarget,
          daily_target: Math.ceil(weeklyTarget / 5), // 5 working days
          week_start: weekStartStr,
          week_end: weekEndStr,
          set_by: user.id,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'agent_id,week_start',
        });

      if (error) throw error;
      
      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error saving goal:', err);
      return false;
    }
  };

  const deleteGoal = async (goalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('agent_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
      
      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error deleting goal:', err);
      return false;
    }
  };

  return {
    goals,
    isLoading,
    error,
    upsertGoal,
    deleteGoal,
    refreshGoals: fetchGoals,
    weekStart: selectedWeekStart,
    weekEnd: selectedWeekEnd,
  };
}

// Hook for agent's own goal
export function useMyGoal() {
  const { user } = useAuth();
  const [goal, setGoal] = useState<AgentGoalWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMyGoal = async () => {
      if (!user) return;

      setIsLoading(true);

      try {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

        // Get agent ID for current user
        const { data: agentData } = await supabase
          .from('agents')
          .select('id, name, site_id')
          .eq('user_id', user.id)
          .single();

        if (!agentData) {
          setGoal(null);
          setIsLoading(false);
          return;
        }

        // Get goal for current week
        const { data: goalData } = await supabase
          .from('agent_goals')
          .select('*')
          .eq('agent_id', agentData.id)
          .eq('week_start', weekStartStr)
          .single();

        if (!goalData) {
          setGoal(null);
          setIsLoading(false);
          return;
        }

        // Count bookings for current week
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('id')
          .eq('agent_id', agentData.id)
          .gte('booking_date', weekStartStr)
          .lte('booking_date', weekEndStr)
          .in('status', ['Pending Move-In', 'Moved In']);

        const currentBookings = bookingsData?.length || 0;
        const progressPercentage = goalData.weekly_target > 0 
          ? Math.round((currentBookings / goalData.weekly_target) * 100) 
          : 0;

        setGoal({
          ...goalData,
          agent_name: agentData.name,
          site_id: agentData.site_id,
          site_name: '',
          current_bookings: currentBookings,
          progress_percentage: progressPercentage,
        });
      } catch (err) {
        console.error('Error fetching my goal:', err);
        setGoal(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyGoal();
  }, [user]);

  return { goal, isLoading };
}
