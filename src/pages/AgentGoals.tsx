import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useAgentGoals } from '@/hooks/useAgentGoals';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Target, ChevronLeft, ChevronRight, Save, Users, TrendingUp, Award, Building2 } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';

const AgentGoals = () => {
  const { user, hasRole } = useAuth();
  const { agents, sites, isLoading: agentsLoading } = useAgents();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const { goals, isLoading: goalsLoading, upsertGoal, weekStart, weekEnd } = useAgentGoals(selectedWeek);
  
  const [editingGoals, setEditingGoals] = useState<Record<string, number>>({});
  const [applyToAllValue, setApplyToAllValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const isSupervisor = hasRole(['supervisor']);
  const isAdmin = hasRole(['admin']);
  const isSuperAdmin = hasRole(['super_admin']);
  const canEdit = isSupervisor || isSuperAdmin;

  // Filter agents based on role and selected site
  const filteredAgents = agents.filter(agent => {
    if (!agent.active) return false;
    if (isSupervisor && user?.siteId && agent.siteId !== user.siteId) return false;
    if (selectedSiteId !== 'all' && agent.siteId !== selectedSiteId) return false;
    return true;
  });

  // Initialize editing goals from fetched goals
  useEffect(() => {
    const initialGoals: Record<string, number> = {};
    goals.forEach(goal => {
      initialGoals[goal.agent_id] = goal.weekly_target;
    });
    setEditingGoals(initialGoals);
  }, [goals]);

  const handleWeekChange = (direction: 'prev' | 'next') => {
    setSelectedWeek(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const handleApplyToAll = () => {
    const value = parseInt(applyToAllValue);
    if (isNaN(value) || value < 0) {
      toast.error('Please enter a valid number');
      return;
    }
    
    const newGoals: Record<string, number> = {};
    filteredAgents.forEach(agent => {
      newGoals[agent.id] = value;
    });
    setEditingGoals(newGoals);
    toast.success(`Applied ${value} bookings target to all agents`);
  };

  const handleSaveGoals = async () => {
    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const [agentId, target] of Object.entries(editingGoals)) {
      if (target > 0) {
        const success = await upsertGoal(agentId, target);
        if (success) successCount++;
        else errorCount++;
      }
    }

    setIsSaving(false);
    
    if (errorCount === 0) {
      toast.success(`Saved goals for ${successCount} agents`);
    } else {
      toast.error(`Failed to save ${errorCount} goals`);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-amber-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-muted';
  };

  // Calculate summary stats
  const totalAgentsWithGoals = goals.length;
  const totalAchieved = goals.filter(g => g.progress_percentage >= 100).length;
  const averageProgress = goals.length > 0 
    ? Math.round(goals.reduce((sum, g) => sum + g.progress_percentage, 0) / goals.length) 
    : 0;

  if (goalsLoading || agentsLoading) {
    return (
      <DashboardLayout title="Agent Goals" subtitle="Set and track weekly booking targets">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Agent Goals" 
      subtitle="Set and track weekly booking targets for your team"
    >
      <div className="space-y-6">
        {/* Week Selector and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Week Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleWeekChange('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[200px]">
                  <div className="font-semibold">
                    {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(weekStart, 'yyyy') === format(new Date(), 'yyyy') && 
                     format(weekStart, 'ww') === format(new Date(), 'ww') 
                      ? 'Current Week' 
                      : `Week ${format(weekStart, 'ww')}`}
                  </div>
                </div>
                <Button variant="outline" size="icon" onClick={() => handleWeekChange('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Site Filter (Admin/Super Admin only) */}
              {(isAdmin || isSuperAdmin) && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Sites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sites</SelectItem>
                      {sites.map(site => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Apply to All (Supervisors only) */}
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Target for all"
                    className="w-32"
                    value={applyToAllValue}
                    onChange={(e) => setApplyToAllValue(e.target.value)}
                  />
                  <Button variant="outline" onClick={handleApplyToAll}>
                    Apply to All
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalAgentsWithGoals}</div>
                  <div className="text-sm text-muted-foreground">Goals Set</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Award className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalAchieved}</div>
                  <div className="text-sm text-muted-foreground">Achieved Goal</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{averageProgress}%</div>
                  <div className="text-sm text-muted-foreground">Avg Progress</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {goals.reduce((sum, g) => sum + g.current_bookings, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Bookings</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Goals List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Agent Weekly Targets
            </CardTitle>
            {canEdit && (
              <Button onClick={handleSaveGoals} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save All Goals'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {filteredAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No agents found for the selected filters
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAgents.map(agent => {
                  const existingGoal = goals.find(g => g.agent_id === agent.id);
                  const currentTarget = editingGoals[agent.id] ?? existingGoal?.weekly_target ?? 0;
                  const currentBookings = existingGoal?.current_bookings ?? 0;
                  const progressPercent = currentTarget > 0 
                    ? Math.min(100, Math.round((currentBookings / currentTarget) * 100)) 
                    : 0;

                  return (
                    <div 
                      key={agent.id} 
                      className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      {/* Agent Info */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-sm text-muted-foreground">{agent.siteName}</div>
                        {existingGoal?.set_by_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Set by: {existingGoal.set_by_name}
                          </div>
                        )}
                      </div>

                      {/* Target Input (Supervisors) or Display (Admins) */}
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Label className="text-sm text-muted-foreground">Target:</Label>
                        {canEdit ? (
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={currentTarget || ''}
                            onChange={(e) => setEditingGoals(prev => ({
                              ...prev,
                              [agent.id]: parseInt(e.target.value) || 0
                            }))}
                          />
                        ) : (
                          <span className="font-semibold">{currentTarget || 'Not set'}</span>
                        )}
                      </div>

                      {/* Progress Display */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">
                            {currentBookings} / {currentTarget || '—'}
                          </span>
                          <Badge 
                            variant={progressPercent >= 100 ? 'default' : 'secondary'}
                            className={progressPercent >= 100 ? 'bg-green-500' : ''}
                          >
                            {currentTarget > 0 ? `${progressPercent}%` : 'No goal'}
                          </Badge>
                        </div>
                        <Progress 
                          value={progressPercent} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AgentGoals;
