import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAgents } from '@/contexts/AgentsContext';
import { supabase } from '@/integrations/supabase/client';
import { PlusCircle, Pencil, UserX, UserCheck, Link, Unlink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface LinkedUserInfo {
  id: string;
  name: string | null;
  email: string | null;
}

export default function AgentManagement() {
  const { agents, sites, addAgent, updateAgent, toggleAgentStatus } = useAgents();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [linkedUsers, setLinkedUsers] = useState<Record<string, LinkedUserInfo>>({});
  
  // Form state
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');

  // Fetch linked user info for all agents
  useEffect(() => {
    const fetchLinkedUsers = async () => {
      const agentUserIds = agents
        .filter(a => a.userId)
        .map(a => a.userId as string);
      
      if (agentUserIds.length === 0) {
        setLinkedUsers({});
        return;
      }

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', agentUserIds);

      if (error) {
        console.error('Error fetching linked users:', error);
        return;
      }

      const userMap: Record<string, LinkedUserInfo> = {};
      profiles?.forEach(profile => {
        userMap[profile.id] = profile;
      });
      setLinkedUsers(userMap);
    };

    fetchLinkedUsers();
  }, [agents]);

  const resetForm = () => {
    setName('');
    setSiteId('');
    setEditingAgent(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Agent name is required', variant: 'destructive' });
      return;
    }
    if (!siteId) {
      toast({ title: 'Error', description: 'Please select a site', variant: 'destructive' });
      return;
    }

    const site = sites.find(s => s.id === siteId);

    if (editingAgent) {
      updateAgent(editingAgent, { name: name.trim(), siteId, siteName: site?.name || '' });
      toast({ title: 'Agent Updated', description: `${name} has been updated` });
    } else {
      addAgent({
        name: name.trim(),
        siteId,
        siteName: site?.name || '',
        active: true,
      });
      toast({ title: 'Agent Added', description: `${name} has been added` });
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setName(agent.name);
      setSiteId(agent.siteId);
      setEditingAgent(agentId);
      setIsAddDialogOpen(true);
    }
  };

  const handleToggleStatus = (agentId: string) => {
    toggleAgentStatus(agentId);
    const agent = agents.find(a => a.id === agentId);
    toast({
      title: agent?.active ? 'Agent Deactivated' : 'Agent Activated',
      description: `${agent?.name} has been ${agent?.active ? 'deactivated' : 'activated'}`,
    });
  };

  const getLinkedUserDisplay = (agent: typeof agents[0]) => {
    if (!agent.userId) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-dashed">
          <Unlink className="w-3 h-3 mr-1" />
          Unlinked
        </Badge>
      );
    }
    
    const user = linkedUsers[agent.userId];
    if (!user) {
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          <Link className="w-3 h-3 mr-1" />
          Loading...
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-primary">
          <Link className="w-3 h-3 mr-1" />
          Linked
        </Badge>
        <span className="text-sm text-muted-foreground">
          {user.name || user.email}
        </span>
      </div>
    );
  };

  return (
    <DashboardLayout title="Agent Management" subtitle="Manage agents and their site assignments">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAgent ? 'Edit Agent' : 'Add New Agent'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="agentName">Agent Name *</Label>
                  <Input
                    id="agentName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter agent's full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site Assignment *</Label>
                  <Select value={siteId} onValueChange={setSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
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
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingAgent ? 'Update Agent' : 'Add Agent'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Linked User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map(agent => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>{agent.siteName}</TableCell>
                  <TableCell>{getLinkedUserDisplay(agent)}</TableCell>
                  <TableCell>
                    <Badge variant={agent.active ? 'default' : 'secondary'}>
                      {agent.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(agent.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(agent.id)}
                      >
                        {agent.active ? (
                          <UserX className="w-4 h-4 text-destructive" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-success" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
