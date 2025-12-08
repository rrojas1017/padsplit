import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useAgentGoals } from '@/hooks/useAgentGoals';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Target, ChevronLeft, ChevronRight, Save, Users, TrendingUp, Award, 
  Building2, Calendar, CheckCircle2, Sparkles, Trophy
} from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';

const AgentGoals = () => {
  const { user, hasRole } = useAuth();
  const { agents, sites, isLoading: agentsLoading } = useAgents();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const { goals, isLoading: goalsLoading, batchUpsertGoals, weekStart, weekEnd } = useAgentGoals(selectedWeek);
  
  // Determine if we're on the current week (to disable past navigation)
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = format(selectedWeek, 'yyyy-MM-dd') === format(currentWeekStart, 'yyyy-MM-dd');
  const isNextWeek = format(selectedWeek, 'yyyy-MM-dd') === format(addWeeks(currentWeekStart, 1), 'yyyy-MM-dd');
  
  const [editingGoals, setEditingGoals] = useState<Record<string, number>>({});
  const [applyToAllValue, setApplyToAllValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const isSupervisor = hasRole(['supervisor']);
  const isAdmin = hasRole(['admin']);
  const isSuperAdmin = hasRole(['super_admin']);
  const canEdit = isSupervisor || isSuperAdmin || isAdmin;

  // Filter agents based on role and selected site
  const filteredAgents = agents.filter(agent => {
    if (!agent.active) return false;
    if (isSupervisor && user?.siteId && agent.siteId !== user.siteId) return false;
    if (selectedSiteId !== 'all' && agent.siteId !== selectedSiteId) return false;
    return true;
  });

  // Initialize editing goals from fetched goals - skip during save to prevent glitch
  useEffect(() => {
    if (isSavingRef.current) return;
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
    isSavingRef.current = true;

    // Collect all goals to save in one batch
    const goalsToSave = Object.entries(editingGoals)
      .filter(([_, target]) => target > 0)
      .map(([agentId, target]) => ({ agentId, target }));

    const success = await batchUpsertGoals(goalsToSave);
    
    isSavingRef.current = false;
    setIsSaving(false);
    
    if (success) {
      toast.success(`Saved goals for ${goalsToSave.length} agents`);
    } else {
      toast.error('Failed to save goals');
    }
  };

  const handleQuickSet = (value: number) => {
    const newGoals: Record<string, number> = {};
    filteredAgents.forEach(agent => {
      newGoals[agent.id] = value;
    });
    setEditingGoals(newGoals);
    setApplyToAllValue(value.toString());
    toast.success(`Set ${value} bookings target for all agents`);
  };

  // Calculate summary stats
  const totalAgentsWithGoals = goals.length;
  const totalAchieved = goals.filter(g => g.progress_percentage >= 100).length;
  const averageProgress = goals.length > 0 
    ? Math.round(goals.reduce((sum, g) => sum + g.progress_percentage, 0) / goals.length) 
    : 0;
  const totalBookings = goals.reduce((sum, g) => sum + g.current_bookings, 0);

  // Get week label
  const getWeekLabel = () => {
    if (isCurrentWeek) return 'Current Week';
    if (isNextWeek) return 'Next Week';
    return `Week ${format(weekStart, 'ww')}`;
  };

  // Show loading only when actually loading
  if (goalsLoading || agentsLoading) {
    return (
      <DashboardLayout title="Agent Goals" subtitle="Set and track weekly booking targets">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
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
        {/* Hero Week Selector */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 animate-fade-in">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          <div className="relative flex flex-col lg:flex-row gap-6 items-center justify-between">
            {/* Week Navigation - Hero Style */}
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                className="h-12 w-12 rounded-full border-2 hover:bg-primary/10 hover:border-primary transition-all duration-300"
                onClick={() => handleWeekChange('prev')}
                disabled={isCurrentWeek}
                title={isCurrentWeek ? "Cannot set goals for past weeks" : "Previous week"}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="text-center min-w-[240px]">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Calendar className="h-5 w-5 text-primary" />
                  <Badge variant={isCurrentWeek ? "default" : "secondary"} className="text-xs">
                    {getWeekLabel()}
                  </Badge>
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(weekStart, 'yyyy')}
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="icon"
                className="h-12 w-12 rounded-full border-2 hover:bg-primary/10 hover:border-primary transition-all duration-300"
                onClick={() => handleWeekChange('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Site Filter (Admin/Super Admin only) */}
              {(isAdmin || isSuperAdmin) && (
                <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger className="w-[140px] border-0 bg-transparent h-8">
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

              {/* Quick Set Presets (Supervisors only) */}
              {canEdit && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">Quick Set:</span>
                  <div className="flex gap-1">
                    {[5, 10, 15].map(val => (
                      <Button 
                        key={val}
                        variant="outline" 
                        size="sm"
                        className="h-8 px-3 hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleQuickSet(val)}
                      >
                        {val}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Input
                      type="number"
                      placeholder="Custom"
                      className="w-20 h-8"
                      value={applyToAllValue}
                      onChange={(e) => setApplyToAllValue(e.target.value)}
                    />
                    <Button variant="outline" size="sm" className="h-8" onClick={handleApplyToAll}>
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards - Enhanced KPI Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="overflow-hidden border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0ms' }}>
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Goals Set</p>
                    <p className="text-3xl font-bold">{totalAgentsWithGoals}</p>
                    <p className="text-xs text-muted-foreground mt-1">of {filteredAgents.length} agents</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/20">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-success/20 to-success/5 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Achieved</p>
                    <p className="text-3xl font-bold text-success">{totalAchieved}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalAgentsWithGoals > 0 ? `${Math.round((totalAchieved / totalAgentsWithGoals) * 100)}% success rate` : 'No goals yet'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-success/20">
                    <Trophy className="h-5 w-5 text-success" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-warning/20 to-warning/5 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Avg Progress</p>
                    <p className="text-3xl font-bold text-warning">{averageProgress}%</p>
                    <Progress value={averageProgress} className="h-1.5 mt-2 w-24" />
                  </div>
                  <div className="p-3 rounded-xl bg-warning/20">
                    <TrendingUp className="h-5 w-5 text-warning" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Bookings</p>
                    <p className="text-3xl font-bold text-blue-500">{totalBookings}</p>
                    <p className="text-xs text-muted-foreground mt-1">this week</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <Target className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Goals - Card-Based Layout */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Agent Weekly Targets
            </h2>
            {canEdit && (
              <Button 
                onClick={handleSaveGoals} 
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save All Goals'}
              </Button>
            )}
          </div>

          {filteredAgents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No agents found for the selected filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgents.map((agent, index) => {
                const existingGoal = goals.find(g => g.agent_id === agent.id);
                const currentTarget = editingGoals[agent.id] ?? existingGoal?.weekly_target ?? 0;
                const currentBookings = existingGoal?.current_bookings ?? 0;
                const progressPercent = currentTarget > 0 
                  ? Math.min(100, Math.round((currentBookings / currentTarget) * 100)) 
                  : 0;
                const hasAchieved = progressPercent >= 100;
                const hasGoal = currentTarget > 0;

                return (
                  <Card 
                    key={agent.id} 
                    className={`
                      overflow-hidden transition-all duration-300 animate-slide-up
                      hover:shadow-lg hover:-translate-y-0.5
                      ${hasAchieved ? 'ring-2 ring-success/50 bg-success/5' : ''}
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        {/* Agent Info */}
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                            ${hasAchieved ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'}
                          `}>
                            {hasAchieved ? <CheckCircle2 className="h-5 w-5" /> : agent.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {agent.name}
                              {hasAchieved && (
                                <Badge className="bg-success/20 text-success border-0 text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Goal Achieved!
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{agent.siteName}</div>
                          </div>
                        </div>

                        {/* Target Input/Display */}
                        <div className="text-right">
                          {canEdit ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Target:</span>
                              <Input
                                type="number"
                                min={0}
                                className="w-20 h-9 text-center font-semibold"
                                value={currentTarget || ''}
                                onChange={(e) => setEditingGoals(prev => ({
                                  ...prev,
                                  [agent.id]: parseInt(e.target.value) || 0
                                }))}
                              />
                            </div>
                          ) : (
                            <div>
                              <span className="text-sm text-muted-foreground">Target: </span>
                              <span className="font-semibold">{currentTarget || 'Not set'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {hasGoal ? (
                              <>
                                <span className={hasAchieved ? 'text-success' : ''}>
                                  {currentBookings}
                                </span>
                                <span className="text-muted-foreground"> / {currentTarget} bookings</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">No goal set</span>
                            )}
                          </span>
                        </div>
                        
                        <div className="relative">
                          <Progress 
                            value={hasGoal ? progressPercent : 0} 
                            className={`h-3 ${hasAchieved ? '[&>div]:bg-success' : ''}`}
                          />
                          {hasGoal && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1">
                              <Badge 
                                variant={hasAchieved ? 'default' : 'secondary'}
                                className={`text-xs px-2 ${hasAchieved ? 'bg-success' : ''}`}
                              >
                                {progressPercent}%
                              </Badge>
                            </div>
                          )}
                        </div>

                        {existingGoal?.set_by_name && (
                          <p className="text-xs text-muted-foreground">
                            Set by {existingGoal.set_by_name}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AgentGoals;
