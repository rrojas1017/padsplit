import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Globe, Building, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface IPAllowlistEntry {
  id: string;
  site_id: string | null;
  ip_address: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  sites?: { name: string } | null;
}

interface Site {
  id: string;
  name: string;
}

// Validate IP address or CIDR
function isValidIpOrCidr(value: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv4 CIDR regex
  const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  // IPv6 regex (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  // IPv6 CIDR regex
  const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/;
  
  if (ipv4Regex.test(value)) {
    const parts = value.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }
  
  if (ipv4CidrRegex.test(value)) {
    const [ip, mask] = value.split('/');
    const parts = ip.split('.').map(Number);
    const maskNum = parseInt(mask, 10);
    return parts.every(p => p >= 0 && p <= 255) && maskNum >= 0 && maskNum <= 32;
  }
  
  if (ipv6Regex.test(value) || ipv6CidrRegex.test(value)) {
    return true; // Simplified IPv6 validation
  }
  
  return false;
}

export function IPAllowlistManager() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<IPAllowlistEntry[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IPAllowlistEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  
  // Form state
  const [formIpAddress, setFormIpAddress] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSiteId, setFormSiteId] = useState<string>('global');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch allowlist entries with site names
      const { data: entriesData, error: entriesError } = await supabase
        .from('ip_allowlists')
        .select('*, sites(name)')
        .order('created_at', { ascending: false });

      if (entriesError) throw entriesError;
      
      // Fetch sites for dropdown
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name')
        .order('name');

      if (sitesError) throw sitesError;

      setEntries(entriesData || []);
      setSites(sitesData || []);
    } catch (error) {
      console.error('Error fetching IP allowlist data:', error);
      toast.error('Failed to load IP allowlist');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormIpAddress('');
    setFormDescription('');
    setFormSiteId('global');
    setFormIsActive(true);
    setEditingEntry(null);
    setValidationError('');
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (entry: IPAllowlistEntry) => {
    setEditingEntry(entry);
    setFormIpAddress(entry.ip_address);
    setFormDescription(entry.description || '');
    setFormSiteId(entry.site_id || 'global');
    setFormIsActive(entry.is_active);
    setValidationError('');
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Validate IP
    if (!isValidIpOrCidr(formIpAddress)) {
      setValidationError('Please enter a valid IP address or CIDR range (e.g., 192.168.1.1 or 10.0.0.0/8)');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ip_address: formIpAddress.trim(),
        description: formDescription.trim() || null,
        site_id: formSiteId === 'global' ? null : formSiteId,
        is_active: formIsActive,
        created_by: user?.id,
      };

      if (editingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('ip_allowlists')
          .update(payload)
          .eq('id', editingEntry.id);

        if (error) throw error;
        toast.success('IP allowlist entry updated');
      } else {
        // Create new entry
        const { error } = await supabase
          .from('ip_allowlists')
          .insert(payload);

        if (error) throw error;
        toast.success('IP address added to allowlist');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving IP allowlist entry:', error);
      toast.error(error.message || 'Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (entry: IPAllowlistEntry) => {
    try {
      const { error } = await supabase
        .from('ip_allowlists')
        .update({ is_active: !entry.is_active })
        .eq('id', entry.id);

      if (error) throw error;
      
      setEntries(prev => prev.map(e => 
        e.id === entry.id ? { ...e, is_active: !e.is_active } : e
      ));
      
      toast.success(`IP ${entry.is_active ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error('Error toggling IP status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteEntryId) return;

    try {
      const { error } = await supabase
        .from('ip_allowlists')
        .delete()
        .eq('id', deleteEntryId);

      if (error) throw error;
      
      setEntries(prev => prev.filter(e => e.id !== deleteEntryId));
      toast.success('IP address removed from allowlist');
    } catch (error) {
      console.error('Error deleting IP allowlist entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setDeleteEntryId(null);
    }
  };

  // Group entries by site
  const globalEntries = entries.filter(e => !e.site_id);
  const siteGroupedEntries = sites.map(site => ({
    site,
    entries: entries.filter(e => e.site_id === site.id),
  })).filter(group => group.entries.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage allowed IP addresses for agent login. Agents can only login from these IP addresses.
            Admins, supervisors, and super admins are not restricted.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Add IP Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEntry ? 'Edit IP Address' : 'Add IP Address'}</DialogTitle>
              <DialogDescription>
                {editingEntry 
                  ? 'Update the IP address or CIDR range configuration.'
                  : 'Add an IP address or CIDR range to the allowlist. Agents will only be able to login from allowed addresses.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ip_address">IP Address or CIDR Range *</Label>
                <Input
                  id="ip_address"
                  placeholder="e.g., 192.168.1.1 or 10.0.0.0/8"
                  value={formIpAddress}
                  onChange={(e) => {
                    setFormIpAddress(e.target.value);
                    setValidationError('');
                  }}
                />
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Supports single IP (192.168.1.1) or CIDR notation (192.168.1.0/24)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g., Main Office, VPN Exit"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="site">Apply to Site</Label>
                <Select value={formSiteId} onValueChange={setFormSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Global (All Sites)
                      </div>
                    </SelectItem>
                    {sites.map(site => (
                      <SelectItem key={site.id} value={site.id}>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          {site.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving || !formIpAddress}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingEntry ? 'Update' : 'Add IP'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* No entries state */}
      {entries.length === 0 && (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Globe className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">No IP Restrictions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Agents can currently login from any location. Add IP addresses to restrict access.
          </p>
          <Button onClick={openAddDialog} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add First IP Address
          </Button>
        </div>
      )}

      {/* Global entries */}
      {globalEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium text-foreground">Global (All Sites)</h4>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.ip_address}</TableCell>
                    <TableCell>{entry.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.is_active ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Switch
                          checked={entry.is_active}
                          onCheckedChange={() => handleToggleActive(entry)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(entry)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEntryId(entry.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Site-specific entries */}
      {siteGroupedEntries.map(({ site, entries: siteEntries }) => (
        <div key={site.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium text-foreground">{site.name}</h4>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.ip_address}</TableCell>
                    <TableCell>{entry.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.is_active ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Switch
                          checked={entry.is_active}
                          onCheckedChange={() => handleToggleActive(entry)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(entry)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEntryId(entry.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={() => setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this IP address from the allowlist? 
              Agents will no longer be able to login from this IP.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
