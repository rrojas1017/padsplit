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
import { useAuth } from '@/contexts/AuthContext';
import { PlusCircle, Copy, Trash2, CalendarIcon, ExternalLink, Eye, RefreshCw, Monitor, Smartphone, Tablet, Tv, Users, BarChart3, Globe, Clock } from 'lucide-react';
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

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'mobile': return <Smartphone className="w-4 h-4" />;
    case 'tablet': return <Tablet className="w-4 h-4" />;
    case 'tv': return <Tv className="w-4 h-4" />;
    default: return <Monitor className="w-4 h-4" />;
  }
};

export default function DisplayLinks() {
  const { tokens, addToken, deleteToken, refreshTokens, isLoading } = useDisplayTokens();
  const { sites } = useAgents();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailToken, setDetailToken] = useState<typeof tokens[0] | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  const isSuperAdmin = user?.role === 'super_admin';

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
  const totalSessions = tokens.reduce((sum, t) => sum + t.sessionCount, 0);
  const todaySessions = tokens.reduce((sum, t) => sum + t.todaySessions, 0);
  const totalUniqueViewers = tokens.reduce((sum, t) => sum + t.uniqueViewers, 0);
  const activeLinks = tokens.filter(t => !t.expiresAt || t.expiresAt > new Date()).length;

  return (
    <DashboardLayout title="Display Links" subtitle="Generate shareable wallboard links for TVs and displays">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Total Links</div>
            <div className="text-2xl font-bold">{tokens.length}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Active Links</div>
            <div className="text-2xl font-bold text-green-500">{activeLinks}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Total Sessions</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-muted-foreground" />
              {totalSessions}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Today's Sessions</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              {todaySessions}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm text-muted-foreground">Unique Viewers</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              {totalUniqueViewers}
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
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-center">Today</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Last Viewed</TableHead>
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
                          {token.sessionCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          {token.todaySessions}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DeviceIcon type={token.primaryDevice} />
                          <span className="text-xs capitalize">{token.primaryDevice}</span>
                        </div>
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
                      <TableCell>
                        {token.expiresAt ? format(token.expiresAt, 'MMM d, yyyy') : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetailToken(token)}
                              title="View details"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          )}
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

        {/* Detail Modal */}
        <Dialog open={!!detailToken} onOpenChange={(open) => !open && setDetailToken(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {detailToken?.name} - Usage Analytics
              </DialogTitle>
            </DialogHeader>
            
            {detailToken && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{detailToken.sessionCount}</div>
                    <div className="text-xs text-muted-foreground">Total Sessions</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{detailToken.todaySessions}</div>
                    <div className="text-xs text-muted-foreground">Today's Sessions</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{detailToken.uniqueViewers}</div>
                    <div className="text-xs text-muted-foreground">Unique Viewers</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold capitalize">{detailToken.primaryDevice}</div>
                    <div className="text-xs text-muted-foreground">Primary Device</div>
                  </div>
                </div>

                {/* Device Breakdown */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Device Distribution
                  </h4>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(detailToken.deviceStats).map(([device, count]) => (
                      <div key={device} className="bg-muted/30 rounded-lg p-2 text-center">
                        <DeviceIcon type={device} />
                        <div className="text-lg font-semibold mt-1">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize">{device}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Browser Breakdown */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Browser Distribution
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(detailToken.browserStats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([browser, count]) => (
                        <Badge key={browser} variant="outline" className="gap-1">
                          {browser}: {count}
                        </Badge>
                      ))}
                  </div>
                </div>

                {/* Screen Resolutions */}
                {detailToken.topResolutions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4" /> Top Screen Resolutions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {detailToken.topResolutions.map(({ resolution, count }) => (
                        <Badge key={resolution} variant="secondary" className="gap-1">
                          {resolution}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                {detailToken.recentViews.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Recent Activity
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {detailToken.recentViews.slice(0, 10).map((view, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <DeviceIcon type={view.device_type || 'desktop'} />
                            <span className="text-muted-foreground">{view.browser || 'Unknown'}</span>
                            <span className="text-muted-foreground">{view.operating_system || 'Unknown'}</span>
                            {view.screen_width && view.screen_height && (
                              <span className="text-xs text-muted-foreground">
                                {view.screen_width}x{view.screen_height}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(view.viewed_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
