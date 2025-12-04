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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { useDisplayTokens } from '@/contexts/DisplayTokensContext';
import { useAgents } from '@/contexts/AgentsContext';
import { PlusCircle, Copy, Trash2, CalendarIcon, ExternalLink, Eye, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const PRODUCTION_DOMAIN = 'https://padsplit.tools';

const getBaseUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname.includes('lovable')) {
    return PRODUCTION_DOMAIN;
  }
  return window.location.origin;
};

export default function DisplayLinks() {
  const { tokens, addToken, deleteToken, refreshTokens, isLoading } = useDisplayTokens();
  const { sites } = useAgents();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  const resetForm = () => {
    setName('');
    setSiteFilter('');
    setExpiresAt(undefined);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Display name is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const newToken = await addToken({
        name: name.trim(),
        siteFilter: siteFilter && siteFilter !== 'all' ? siteFilter : undefined,
        expiresAt,
      });

      const displayUrl = `${getBaseUrl()}/display/${newToken.token}`;
      navigator.clipboard.writeText(displayUrl);

      toast({
        title: 'Display Link Created',
        description: 'The link has been copied to your clipboard',
      });

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create display link', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const displayUrl = `${getBaseUrl()}/display/${token}`;
    navigator.clipboard.writeText(displayUrl);
    toast({ title: 'Link Copied', description: 'Display link copied to clipboard' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteToken(id);
      toast({ title: 'Link Deleted', description: 'Display link has been revoked' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete link', variant: 'destructive' });
    }
  };

  const handleOpenLink = (token: string) => {
    const displayUrl = `${getBaseUrl()}/display/${token}`;
    window.open(displayUrl, '_blank');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTokens();
      toast({ title: 'Refreshed', description: 'Usage stats updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to refresh stats', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate totals
  const totalViews = tokens.reduce((sum, t) => sum + t.viewCount, 0);
  const activeLinks = tokens.filter(t => !t.expiresAt || t.expiresAt > new Date()).length;

  return (
    <DashboardLayout title="Display Links" subtitle="Generate shareable wallboard links for TVs and displays">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Total Links</div>
            <div className="text-2xl font-bold">{tokens.length}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Active Links</div>
            <div className="text-2xl font-bold text-green-500">{activeLinks}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Total Views</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-muted-foreground" />
              {totalViews}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Refresh Stats
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Create Display Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Display Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name *</Label>
                  <Input
                    id="displayName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Office TV, Floor 2 Display"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site Filter (Optional)</Label>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Show all sites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sites</SelectItem>
                      {sites.map(site => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expiresAt && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiresAt ? format(expiresAt, "PPP") : "No expiration"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                      <Calendar
                        mode="single"
                        selected={expiresAt}
                        onSelect={setExpiresAt}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Link'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {tokens.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <p className="text-muted-foreground">No display links created yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a link to share the wallboard on TVs or displays without login.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Site Filter</TableHead>
                  <TableHead className="text-center">Views</TableHead>
                  <TableHead>Last Viewed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map(token => {
                  const site = sites.find(s => s.id === token.siteFilter);
                  const isExpired = token.expiresAt && token.expiresAt < new Date();
                  return (
                    <TableRow key={token.id} className={cn(isExpired && "opacity-50")}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {token.name}
                          {isExpired && (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {token.createdByName || token.createdByEmail || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>{site?.name || 'All Sites'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="gap-1">
                          <Eye className="w-3 h-3" />
                          {token.viewCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {token.lastViewedAt ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(token.lastViewedAt, { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>{format(token.createdAt, 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {token.expiresAt ? format(token.expiresAt, 'MMM d, yyyy') : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenLink(token.token)}
                            title="Open in new tab"
                            disabled={isExpired}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyLink(token.token)}
                            title="Copy link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(token.id)}
                            title="Delete link"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}