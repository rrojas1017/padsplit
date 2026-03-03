import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { validatePassword, getPasswordErrorMessage } from '@/utils/passwordValidation';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Shield, ShieldCheck, User, Crown, Loader2, Link, Pencil, Trash2, ChevronDown, ChevronUp, Mail, MessageSquare, Mic, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { CommunicationPermissionsCell } from '@/components/user-management/CommunicationPermissionsCell';

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  status: string;
  site_id: string | null;
  role: string;
  site_name?: string;
  can_send_communications?: boolean;
  can_send_email?: boolean;
  can_send_sms?: boolean;
  can_send_voice?: boolean;
}

interface Site {
  id: string;
  name: string;
}

interface UnlinkedAgent {
  id: string;
  name: string;
  bookingCount: number;
  siteName: string;
}

export default function UserManagement() {
  usePageTracking('view_user_management');
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user: currentUser, hasRole } = useAuth();
  const { agents, sites: agentSites, updateAgent, toggleAgentStatus } = useAgents();

  // Edit agent state
  const [isEditAgentDialogOpen, setIsEditAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<{ id: string; name: string; siteId: string; dialerAgentUser: string } | null>(null);

  // Edit researcher state
  const [isEditResearcherDialogOpen, setIsEditResearcherDialogOpen] = useState(false);
  const [editingResearcher, setEditingResearcher] = useState<{ id: string; name: string; siteId: string } | null>(null);

  // Form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('');
  const [newUserSiteId, setNewUserSiteId] = useState<string>('');
  const [linkedAgentId, setLinkedAgentId] = useState<string>('');
  const [unlinkedAgents, setUnlinkedAgents] = useState<UnlinkedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Linked user info for agents tab
  const [linkedUsers, setLinkedUsers] = useState<Record<string, { name: string; email: string }>>({});

  // Delete user state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit role state
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [userToEditRole, setUserToEditRole] = useState<UserWithRole | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<string>('');
  const [editRoleSiteId, setEditRoleSiteId] = useState<string>('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentTypeFilter, setAgentTypeFilter] = useState('all');

  const isSuperAdmin = hasRole(['super_admin']);
  const isAdmin = hasRole(['admin']);
  const isSupervisor = hasRole(['supervisor']);

  // Get current user's site_id for supervisors
  const [currentUserSiteId, setCurrentUserSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (isSupervisor && currentUser?.id) {
      supabase
        .from('profiles')
        .select('site_id')
        .eq('id', currentUser.id)
        .single()
        .then(({ data }) => {
          if (data?.site_id) {
            setCurrentUserSiteId(data.site_id);
            // Auto-select site for supervisors
            setNewUserSiteId(data.site_id);
          }
        });
    }
  }, [isSupervisor, currentUser?.id]);

  useEffect(() => {
    fetchUsers();
    fetchSites();
  }, []);

  // Fetch linked user info for agents
  useEffect(() => {
    const fetchLinkedUsers = async () => {
      const linkedAgentIds = agents.filter(a => a.userId).map(a => a.userId as string);
      if (linkedAgentIds.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', linkedAgentIds);

      if (data) {
        const userMap: Record<string, { name: string; email: string }> = {};
        data.forEach(u => {
          userMap[u.id] = { name: u.name || '', email: u.email || '' };
        });
        setLinkedUsers(userMap);
      }
    };

    if (agents.length > 0) {
      fetchLinkedUsers();
    }
  }, [agents]);

  // Fetch unlinked agents when role is 'agent' and site is selected
  useEffect(() => {
    if (newUserRole === 'agent' && newUserSiteId && newUserSiteId !== 'none') {
      fetchUnlinkedAgents(newUserSiteId);
    } else {
      setUnlinkedAgents([]);
      setLinkedAgentId('');
    }
  }, [newUserRole, newUserSiteId]);

  const fetchUnlinkedAgents = async (siteId: string) => {
    setLoadingAgents(true);
    try {
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, site_id')
        .is('user_id', null)
        .eq('site_id', siteId);

      if (agentsError) throw agentsError;

      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('agent_id');

      if (bookingsError) throw bookingsError;

      const { data: siteData } = await supabase
        .from('sites')
        .select('name')
        .eq('id', siteId)
        .single();

      const agentsWithCounts: UnlinkedAgent[] = (agentsData || []).map(agent => {
        const bookingCount = bookings?.filter(b => b.agent_id === agent.id).length || 0;
        return {
          id: agent.id,
          name: agent.name,
          bookingCount,
          siteName: siteData?.name || '',
        };
      });

      setUnlinkedAgents(agentsWithCounts);
    } catch (error) {
      console.error('Error fetching unlinked agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, status, site_id, can_send_communications, can_send_email, can_send_sms, can_send_voice');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name');

      if (sitesError) throw sitesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const site = sitesData?.find(s => s.id === profile.site_id);
        return {
          ...profile,
          role: userRole?.role || 'agent',
          site_name: site?.name,
          can_send_communications: profile.can_send_communications ?? false,
          can_send_email: profile.can_send_email ?? false,
          can_send_sms: profile.can_send_sms ?? false,
          can_send_voice: profile.can_send_voice ?? false,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase.from('sites').select('id, name');
      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleRoleChange = (role: string) => {
    setNewUserRole(role);
    if (role === 'super_admin' || role === 'admin') {
      setNewUserSiteId('none');
      setLinkedAgentId('');
    } else if (role === 'researcher') {
      const vixicomSite = sites.find(s => s.name.toLowerCase().includes('vixicom'));
      setNewUserSiteId(vixicomSite?.id || 'none');
      setLinkedAgentId('');
    }
  };

  const handleSiteChange = (siteId: string) => {
    setNewUserSiteId(siteId);
    setLinkedAgentId('');
  };

  const newUserPasswordStrength = useMemo(() => validatePassword(newUserPassword), [newUserPassword]);
  const [hasTypedNewPassword, setHasTypedNewPassword] = useState(false);

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (!newUserPasswordStrength.isValid) {
      toast({
        title: 'Password Too Weak',
        description: getPasswordErrorMessage(newUserPasswordStrength.requirements),
        variant: 'destructive',
      });
      return;
    }

    if ((newUserRole === 'supervisor' || newUserRole === 'agent') && 
        (!newUserSiteId || newUserSiteId === 'none')) {
      toast({
        title: 'Validation Error',
        description: 'Site is required for supervisor and agent roles',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          role: newUserRole,
          siteId: (newUserRole === 'supervisor' || newUserRole === 'agent' || newUserRole === 'researcher') && newUserSiteId !== 'none' ? newUserSiteId : null,
          linkedAgentId: linkedAgentId && linkedAgentId !== 'none' ? linkedAgentId : null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const linkedAgentName = linkedAgentId && linkedAgentId !== 'none' 
        ? unlinkedAgents.find(a => a.id === linkedAgentId)?.name 
        : null;

      toast({
        title: 'Success',
        description: linkedAgentName 
          ? `User created and linked to existing agent "${linkedAgentName}"`
          : 'User created successfully',
      });

      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('');
      setNewUserSiteId('');
      setLinkedAgentId('');
      setHasTypedNewPassword(false);
      setIsDialogOpen(false);

      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAgent = (agent: typeof agents[0]) => {
    setEditingAgent({
      id: agent.id,
      name: agent.name,
      siteId: agent.siteId,
      dialerAgentUser: agent.dialerAgentUser || '',
    });
    setIsEditAgentDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    if (!editingAgent) return;

    try {
      await updateAgent(editingAgent.id, {
        name: editingAgent.name,
        siteId: editingAgent.siteId,
        dialerAgentUser: editingAgent.dialerAgentUser,
      });
      toast({
        title: 'Success',
        description: 'Agent updated successfully',
      });
      setIsEditAgentDialogOpen(false);
      setEditingAgent(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update agent',
        variant: 'destructive',
      });
    }
  };

  const handleEditResearcher = (user: UserWithRole) => {
    setEditingResearcher({
      id: user.id,
      name: user.name,
      siteId: user.site_id || '',
    });
    setIsEditResearcherDialogOpen(true);
  };

  const handleSaveResearcher = async () => {
    if (!editingResearcher) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editingResearcher.name,
          site_id: editingResearcher.siteId || null,
        })
        .eq('id', editingResearcher.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Researcher updated successfully' });
      setIsEditResearcherDialogOpen(false);
      setEditingResearcher(null);
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update researcher', variant: 'destructive' });
    }
  };

  const handleToggleAgentStatus = async (agentId: string) => {
    try {
      await toggleAgentStatus(agentId);
      toast({
        title: 'Success',
        description: 'Agent status updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update agent status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Prevent deleting yourself
    if (userToDelete.id === currentUser?.id) {
      toast({
        title: 'Error',
        description: 'You cannot delete your own account',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Success',
        description: `User ${userToDelete.email} deleted successfully`,
      });

      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEditRoleDialog = (user: UserWithRole) => {
    setUserToEditRole(user);
    setEditRoleValue(user.role);
    setEditRoleSiteId(user.site_id || '');
    setIsEditRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!userToEditRole || !editRoleValue) return;

    // Validate site for supervisor/agent
    if ((editRoleValue === 'supervisor' || editRoleValue === 'agent') && !editRoleSiteId) {
      toast({
        title: 'Validation Error',
        description: 'Site is required for supervisor and agent roles',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingRole(true);
    try {
      const response = await supabase.functions.invoke('update-user-role', {
        body: {
          userId: userToEditRole.id,
          newRole: editRoleValue,
          siteId: (editRoleValue === 'supervisor' || editRoleValue === 'agent' || editRoleValue === 'researcher') ? editRoleSiteId : null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update role');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Success',
        description: `Role changed from ${roleLabels[response.data.previousRole]} to ${roleLabels[response.data.newRole]}`,
      });

      setIsEditRoleDialogOpen(false);
      setUserToEditRole(null);
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error updating role:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update role';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle toggling user profile status (for researchers without linked agents)
  const handleToggleUserStatus = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);
      if (error) throw error;
      toast({ title: 'Status Updated', description: `User is now ${newStatus}` });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  // Handle toggling communication permission (master toggle)
  const handleToggleCommunicationPermission = async (userId: string, userName: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      
      // Update profile - master toggle
      const { error } = await supabase
        .from('profiles')
        .update({ can_send_communications: newValue })
        .eq('id', userId);

      if (error) throw error;

      // Log the action
      await supabase.from('access_logs').insert({
        user_id: currentUser?.id,
        user_name: currentUser?.name,
        action: newValue ? 'communication_permission_grant' : 'communication_permission_revoke',
        resource: `user:${userId} (${userName}) - master toggle`,
      });

      toast({
        title: 'Permission Updated',
        description: `Communication permission ${newValue ? 'granted to' : 'revoked from'} ${userName}`,
      });

      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error('Error toggling communication permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to update communication permission',
        variant: 'destructive',
      });
    }
  };

  // Handle toggling individual channel permissions
  const handleToggleChannelPermission = async (
    userId: string, 
    userName: string, 
    channel: 'email' | 'sms' | 'voice',
    currentValue: boolean
  ) => {
    try {
      const newValue = !currentValue;
      const columnName = `can_send_${channel}`;
      
      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ [columnName]: newValue })
        .eq('id', userId);

      if (error) throw error;

      // Log the action
      const channelLabel = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'Voice';
      await supabase.from('access_logs').insert({
        user_id: currentUser?.id,
        user_name: currentUser?.name,
        action: newValue ? 'channel_permission_grant' : 'channel_permission_revoke',
        resource: `user:${userId} (${userName}) - ${channelLabel}`,
      });

      toast({
        title: 'Permission Updated',
        description: `${channelLabel} permission ${newValue ? 'granted to' : 'revoked from'} ${userName}`,
      });

      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error('Error toggling channel permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to update channel permission',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="w-4 h-4" />;
      case 'admin': return <ShieldCheck className="w-4 h-4" />;
      case 'supervisor': return <Shield className="w-4 h-4" />;
      case 'researcher': return <Mic className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-accent/20 text-accent';
      case 'admin': return 'bg-primary/20 text-primary';
      case 'supervisor': return 'bg-warning/20 text-warning';
      case 'researcher': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    agent: 'Agent',
    researcher: 'Researcher',
  };

  const availableRoles = isSuperAdmin 
    ? ['super_admin', 'admin', 'supervisor', 'agent', 'researcher']
    : isSupervisor
      ? ['agent']
      : ['supervisor', 'agent', 'researcher'];

  return (
    <DashboardLayout 
      title="User Management" 
      subtitle="Manage users, roles, and agents"
    >
      <Tabs defaultValue={isSupervisor ? "agents" : "non-agents"} className="w-full" onValueChange={() => { setRoleFilter('all'); setSiteFilter('all'); setStatusFilter('all'); setSearchQuery(''); }}>
        <TabsList className="mb-6">
          {!isSupervisor && <TabsTrigger value="non-agents">Non-Agents</TabsTrigger>}
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        {/* Non-Agents Tab */}
        <TabsContent value="non-agents">
          {(() => {
            let filteredNonAgents = users.filter(u => ['super_admin', 'admin', 'supervisor'].includes(u.role));
            const query = searchQuery.toLowerCase();
            if (query) {
              filteredNonAgents = filteredNonAgents.filter(u => 
                u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query)
              );
            }
            if (roleFilter !== 'all') {
              filteredNonAgents = filteredNonAgents.filter(u => u.role === roleFilter);
            }
            if (siteFilter !== 'all') {
              filteredNonAgents = filteredNonAgents.filter(u => u.site_id === siteFilter);
            }
            if (statusFilter !== 'all') {
              filteredNonAgents = filteredNonAgents.filter(u => u.status === statusFilter);
            }
            const nonAgentUsers = filteredNonAgents;
            return (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <p className="text-muted-foreground">
                      {loading ? 'Loading...' : `${nonAgentUsers.length} administrators & supervisors`}
                    </p>
                     <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64 bg-background/50"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-40 bg-background/50">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={siteFilter} onValueChange={setSiteFilter}>
                      <SelectTrigger className="w-40 bg-background/50">
                        <SelectValue placeholder="Site" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sites</SelectItem>
                        {sites.map(site => (
                          <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 bg-background/50">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
            <Button 
              className="gap-2"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    {(isSuperAdmin || isAdmin) && (
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Communications</th>
                    )}
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={(isSuperAdmin || isAdmin) ? 7 : 6} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading users...
                      </td>
                    </tr>
                  ) : nonAgentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={(isSuperAdmin || isAdmin) ? 7 : 6} className="py-8 text-center text-muted-foreground">
                        No administrators or supervisors found
                      </td>
                    </tr>
                  ) : (
                    nonAgentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.name?.split(' ').map(n => n[0]).join('') || '?'}
                              </span>
                            </div>
                            <span className="font-medium text-foreground">{user.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground">
                          {user.email}
                        </td>
                        <td className="py-4 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                            getRoleColor(user.role)
                          )}>
                            {getRoleIcon(user.role)}
                            {roleLabels[user.role] || user.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {(user.role === 'super_admin' || user.role === 'admin') 
                            ? <span className="text-primary font-medium">All Sites</span>
                            : user.role === 'researcher'
                              ? <span className="text-muted-foreground">N/A</span>
                              : <span className="text-muted-foreground">{user.site_name || '-'}</span>
                          }
                        </td>
                        <td className="py-4 px-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            user.status === 'active' 
                              ? "bg-success/20 text-success" 
                              : "bg-muted text-muted-foreground"
                          )}>
                            {user.status}
                          </span>
                        </td>
                        {(isSuperAdmin || isAdmin) && (
                          <td className="py-4 px-4">
                            <CommunicationPermissionsCell
                              userId={user.id}
                              userName={user.name}
                              canSendCommunications={user.can_send_communications ?? false}
                              canSendEmail={user.can_send_email ?? false}
                              canSendSMS={user.can_send_sms ?? false}
                              canSendVoice={user.can_send_voice ?? false}
                              onToggleMaster={handleToggleCommunicationPermission}
                              onToggleChannel={handleToggleChannelPermission}
                            />
                          </td>
                        )}
                        <td className="py-4 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Edit User</DropdownMenuItem>
                              {(isSuperAdmin || isAdmin) && user.id !== currentUser?.id && (
                                <DropdownMenuItem onClick={() => handleOpenEditRoleDialog(user)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Change Role
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                              {user.id !== currentUser?.id && !isSupervisor && (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => {
                                    setUserToDelete(user);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
              </>
            );
          })()}
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          {(() => {
            // Supervisors only see agents from their site
            let filteredAgents = users.filter(u => {
              if (!['agent', 'researcher'].includes(u.role)) return false;
              if (isSupervisor && currentUserSiteId) {
                return u.site_id === currentUserSiteId;
              }
              return true;
            });
            const query = searchQuery.toLowerCase();
            if (query) {
              filteredAgents = filteredAgents.filter(u => 
                u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query)
              );
            }
            if (siteFilter !== 'all') {
              filteredAgents = filteredAgents.filter(u => u.site_id === siteFilter);
            }
            if (statusFilter !== 'all') {
              filteredAgents = filteredAgents.filter(u => u.status === statusFilter);
            }
            if (agentTypeFilter !== 'all') {
              filteredAgents = filteredAgents.filter(u => u.role === agentTypeFilter);
            }
            const agentUsers = filteredAgents;
            return (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <p className="text-muted-foreground">
                      {loading ? 'Loading...' : `${agentUsers.length} agents & researchers`}
                    </p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64 bg-background/50"
                      />
                    </div>
                    <Select value={siteFilter} onValueChange={setSiteFilter}>
                      <SelectTrigger className="w-40 bg-background/50">
                        <SelectValue placeholder="Site" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sites</SelectItem>
                        {sites.map(site => (
                          <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 bg-background/50">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={agentTypeFilter} onValueChange={setAgentTypeFilter}>
                      <SelectTrigger className="w-40 bg-background/50">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="agent">Booking Agent</SelectItem>
                        <SelectItem value="researcher">Researcher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="gap-2"
                    onClick={() => {
                      // Pre-select agent role and supervisor's site
                      setNewUserRole('agent');
                      if (isSupervisor && currentUserSiteId) {
                        setNewUserSiteId(currentUserSiteId);
                      }
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Agent
                  </Button>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                          {(isSuperAdmin || isAdmin) && (
                            <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Communications</th>
                          )}
                          <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {loading ? (
                          <tr>
                             <td colSpan={(isSuperAdmin || isAdmin) ? 7 : 6} className="py-8 text-center text-muted-foreground">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                              Loading agents...
                            </td>
                          </tr>
                        ) : agentUsers.length === 0 ? (
                          <tr>
                            <td colSpan={(isSuperAdmin || isAdmin) ? 7 : 6} className="py-8 text-center text-muted-foreground">
                              No agents found
                            </td>
                          </tr>
                        ) : (
                          agentUsers.map((user) => {
                            const linkedAgent = agents.find(a => a.userId === user.id);
                            return (
                              <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                      <span className="text-sm font-medium text-primary">
                                        {user.name?.split(' ').map(n => n[0]).join('') || '?'}
                                      </span>
                                    </div>
                                    <span className="font-medium text-foreground">{user.name || 'Unknown'}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                    user.role === 'researcher' 
                                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" 
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  )}>
                                    {user.role === 'researcher' ? 'Researcher' : 'Booking Agent'}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-sm text-muted-foreground">
                                  {user.email}
                                </td>
                                <td className="py-4 px-4 text-sm text-muted-foreground">
                                  {user.site_name || '-'}
                                </td>
                                <td className="py-4 px-4">
                                  {linkedAgent ? (
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={linkedAgent.active}
                                        onCheckedChange={() => handleToggleAgentStatus(linkedAgent.id)}
                                      />
                                      <span className={cn(
                                        "text-xs font-medium",
                                        linkedAgent.active ? "text-success" : "text-muted-foreground"
                                      )}>
                                        {linkedAgent.active ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={user.status === 'active'}
                                        onCheckedChange={() => handleToggleUserStatus(user.id)}
                                      />
                                      <span className={cn(
                                        "text-xs font-medium",
                                        user.status === 'active' ? "text-success" : "text-muted-foreground"
                                      )}>
                                        {user.status === 'active' ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                {(isSuperAdmin || isAdmin) && (
                                  <td className="py-4 px-4">
                                    <CommunicationPermissionsCell
                                      userId={user.id}
                                      userName={user.name}
                                      canSendCommunications={user.can_send_communications ?? false}
                                      canSendEmail={user.can_send_email ?? false}
                                      canSendSMS={user.can_send_sms ?? false}
                                      canSendVoice={user.can_send_voice ?? false}
                                      onToggleMaster={handleToggleCommunicationPermission}
                                      onToggleChannel={handleToggleChannelPermission}
                                    />
                                  </td>
                                )}
                                <td className="py-4 px-4 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {linkedAgent && (
                                        <DropdownMenuItem onClick={() => handleEditAgent(linkedAgent)}>
                                          <Pencil className="w-4 h-4 mr-2" />
                                          Edit Agent
                                        </DropdownMenuItem>
                                      )}
                                      {!linkedAgent && user.role === 'researcher' && (isSuperAdmin || isAdmin) && (
                                        <DropdownMenuItem onClick={() => handleEditResearcher(user)}>
                                          <Pencil className="w-4 h-4 mr-2" />
                                          Edit Researcher
                                        </DropdownMenuItem>
                                      )}
                                      {(isSuperAdmin || isAdmin) && user.id !== currentUser?.id && (
                                        <DropdownMenuItem onClick={() => handleOpenEditRoleDialog(user)}>
                                          <Shield className="w-4 h-4 mr-2" />
                                          Change Role
                                        </DropdownMenuItem>
                                      )}
                                      {user.id !== currentUser?.id && !isSupervisor && (
                                        <DropdownMenuItem 
                                          className="text-destructive"
                                          onClick={() => {
                                            setUserToDelete(user);
                                            setIsDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete User
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive login credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={newUserPassword}
                onChange={(e) => {
                  setNewUserPassword(e.target.value);
                  if (!hasTypedNewPassword && e.target.value.length > 0) {
                    setHasTypedNewPassword(true);
                  }
                }}
                placeholder="Enter password"
              />
              <PasswordStrengthIndicator 
                result={newUserPasswordStrength} 
                show={hasTypedNewPassword} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={newUserRole} onValueChange={handleRoleChange} disabled={isSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role)}
                        {roleLabels[role]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {(newUserRole === 'super_admin' || newUserRole === 'admin' || newUserRole === 'researcher') && (
              <div className="grid gap-2">
                <Label>Site Access</Label>
                <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                  All Sites (full access)
                </p>
              </div>
            )}
            
            {(newUserRole === 'supervisor' || newUserRole === 'agent') && (
              <div className="grid gap-2">
                <Label htmlFor="site">Site *</Label>
                {isSupervisor ? (
                  <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    {sites.find(s => s.id === currentUserSiteId)?.name || 'Your Site'}
                  </p>
                ) : (
                  <Select value={newUserSiteId} onValueChange={handleSiteChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map(site => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {newUserRole === 'agent' && newUserSiteId && newUserSiteId !== 'none' && !loadingAgents && unlinkedAgents.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="linkedAgent" className="flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Link to Existing Agent
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Select value={linkedAgentId} onValueChange={setLinkedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent to link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Don't link (create new agent)</span>
                    </SelectItem>
                    {unlinkedAgents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{agent.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({agent.bookingCount} booking{agent.bookingCount !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {linkedAgentId && linkedAgentId !== 'none' && (
                  <p className="text-xs text-accent">
                    This user will inherit all bookings from the linked agent
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for this user. Site is required for supervisor and agent roles.
            </DialogDescription>
          </DialogHeader>
          {userToEditRole && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <p className="font-medium text-foreground">{userToEditRole.name}</p>
                <p className="text-sm text-muted-foreground">{userToEditRole.email}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Current Role: <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ml-1",
                    getRoleColor(userToEditRole.role)
                  )}>
                    {getRoleIcon(userToEditRole.role)}
                    {roleLabels[userToEditRole.role]}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newRole">New Role</Label>
                <Select value={editRoleValue} onValueChange={(value) => {
                  setEditRoleValue(value);
                  if (value === 'super_admin' || value === 'admin') {
                    setEditRoleSiteId('');
                  } else if (value === 'researcher') {
                    const vixicomSite = sites.find(s => s.name.toLowerCase().includes('vixicom'));
                    setEditRoleSiteId(vixicomSite?.id || '');
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="researcher">Researcher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editRoleValue === 'supervisor' || editRoleValue === 'agent') && (
                <div className="space-y-2">
                  <Label htmlFor="editSite">Site *</Label>
                  <Select value={editRoleSiteId} onValueChange={setEditRoleSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditRoleDialogOpen(false);
                setUserToEditRole(null);
              }}
              disabled={isUpdatingRole}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateRole}
              disabled={isUpdatingRole || editRoleValue === userToEditRole?.role}
            >
              {isUpdatingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={isEditAgentDialogOpen} onOpenChange={setIsEditAgentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update agent details.
            </DialogDescription>
          </DialogHeader>
          {editingAgent && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="agentName">Name</Label>
                <Input
                  id="agentName"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agentSite">Site</Label>
                <Select
                  value={editingAgent.siteId}
                  onValueChange={(value) => setEditingAgent({ ...editingAgent, siteId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentSites.map(site => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dialerAgentUser">Dialer Agent User</Label>
                <Input
                  id="dialerAgentUser"
                  placeholder="External dialer identifier"
                  value={editingAgent.dialerAgentUser}
                  onChange={(e) => setEditingAgent({ ...editingAgent, dialerAgentUser: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Used to match incoming API submissions to this agent.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAgentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAgent}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Researcher Dialog */}
      <Dialog open={isEditResearcherDialogOpen} onOpenChange={setIsEditResearcherDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Researcher</DialogTitle>
            <DialogDescription>
              Update researcher details.
            </DialogDescription>
          </DialogHeader>
          {editingResearcher && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="researcherName">Name</Label>
                <Input
                  id="researcherName"
                  value={editingResearcher.name}
                  onChange={(e) => setEditingResearcher({ ...editingResearcher, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="researcherSite">Site</Label>
                <Select
                  value={editingResearcher.siteId}
                  onValueChange={(value) => setEditingResearcher({ ...editingResearcher, siteId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentSites.map(site => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditResearcherDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveResearcher}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {userToDelete && (
            <div className="py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="font-medium text-foreground">{userToDelete.name}</p>
                <p className="text-sm text-muted-foreground">{userToDelete.email}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Role: {roleLabels[userToDelete.role] || userToDelete.role}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
