import { useState } from 'react';
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
import { PlusCircle, Pencil, UserX, UserCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function AgentManagement() {
  const { agents, sites, addAgent, updateAgent, toggleAgentStatus } = useAgents();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');

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

    const site = mockSites.find(s => s.id === siteId);

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
                      {mockSites.map(site => (
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map(agent => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>{agent.siteName}</TableCell>
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
