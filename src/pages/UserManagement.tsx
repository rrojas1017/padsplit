import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Shield, ShieldCheck, User, Crown, Loader2, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  status: string;
  site_id: string | null;
  role: string;
  site_name?: string;
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
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user: currentUser, hasRole } = useAuth();

  // Form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('');
  const [newUserSiteId, setNewUserSiteId] = useState<string>('');
  const [linkedAgentId, setLinkedAgentId] = useState<string>('');
  const [unlinkedAgents, setUnlinkedAgents] = useState<UnlinkedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const isSuperAdmin = hasRole(['super_admin']);

  useEffect(() => {
    fetchUsers();
    fetchSites();
  }, []);

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
      // Fetch agents without user_id for the selected site
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, site_id')
        .is('user_id', null)
        .eq('site_id', siteId);

      if (agentsError) throw agentsError;

      // Fetch booking counts for each agent
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('agent_id');

      if (bookingsError) throw bookingsError;

      // Fetch site name
      const { data: siteData } = await supabase
        .from('sites')
        .select('name')
        .eq('id', siteId)
        .single();

      // Calculate booking counts
      const agentsWithCounts: UnlinkedAgent[] = (agents || []).map(agent => {
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
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, status, site_id');

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch sites
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name');

      if (sitesError) throw sitesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const site = sitesData?.find(s => s.id === profile.site_id);
        return {
          ...profile,
          role: userRole?.role || 'agent',
          site_name: site?.name,
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
    // Clear site selection and linked agent for roles that have all-site access
    if (role === 'super_admin' || role === 'admin') {
      setNewUserSiteId('none');
      setLinkedAgentId('');
    }
  };

  const handleSiteChange = (siteId: string) => {
    setNewUserSiteId(siteId);
    setLinkedAgentId(''); // Reset linked agent when site changes
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Validate site is required for supervisor and agent roles
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
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          role: newUserRole,
          siteId: newUserSiteId === 'none' ? null : newUserSiteId || null,
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

      // Reset form and close dialog
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('');
      setNewUserSiteId('');
      setLinkedAgentId('');
      setIsDialogOpen(false);

      // Refresh users list
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="w-4 h-4" />;
      case 'admin': return <ShieldCheck className="w-4 h-4" />;
      case 'supervisor': return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-accent/20 text-accent';
      case 'admin': return 'bg-primary/20 text-primary';
      case 'supervisor': return 'bg-warning/20 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    agent: 'Agent',
  };

  // Filter roles based on current user's role
  const availableRoles = isSuperAdmin 
    ? ['super_admin', 'admin', 'supervisor', 'agent']
    : ['supervisor', 'agent'];

  return (
    <DashboardLayout 
      title="User Management" 
      subtitle="Manage users and access levels"
    >
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          {loading ? 'Loading...' : `${users.length} users total`}
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
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
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={newUserRole} onValueChange={handleRoleChange}>
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
              
              {/* Show "All Sites" message for super_admin and admin */}
              {(newUserRole === 'super_admin' || newUserRole === 'admin') && (
                <div className="grid gap-2">
                  <Label>Site Access</Label>
                  <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    All Sites (full access)
                  </p>
                </div>
              )}
              
              {/* Show site selection only for supervisor and agent roles */}
              {(newUserRole === 'supervisor' || newUserRole === 'agent') && (
                <div className="grid gap-2">
                  <Label htmlFor="site">Site *</Label>
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
                </div>
              )}

              {/* Link to Existing Agent - only show when there are unlinked agents */}
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
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
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
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit User</DropdownMenuItem>
                          <DropdownMenuItem>Change Role</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
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
    </DashboardLayout>
  );
}