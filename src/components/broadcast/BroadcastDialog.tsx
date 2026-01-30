import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BroadcastMessage } from '@/hooks/useBroadcastMessages';
import { Loader2 } from 'lucide-react';

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broadcast?: BroadcastMessage | null;
  onSave: (data: {
    message: string;
    expires_at?: string | null;
    site_id?: string | null;
    priority?: number;
    target_role?: string;
    is_active?: boolean;
  }) => Promise<boolean>;
}

interface Site {
  id: string;
  name: string;
}

export function BroadcastDialog({ open, onOpenChange, broadcast, onSave }: BroadcastDialogProps) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['super_admin', 'admin']);
  
  const [message, setMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [siteId, setSiteId] = useState<string>('all');
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch sites for dropdown
  useEffect(() => {
    async function fetchSites() {
      const { data } = await supabase.from('sites').select('id, name').order('name');
      setSites(data || []);
    }
    fetchSites();
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (broadcast) {
      setMessage(broadcast.message);
      setExpiresAt(broadcast.expires_at ? broadcast.expires_at.slice(0, 16) : '');
      setSiteId(broadcast.site_id || 'all');
      setPriority(broadcast.priority);
      setIsActive(broadcast.is_active);
    } else {
      setMessage('');
      setExpiresAt('');
      setSiteId('all');
      setPriority(0);
      setIsActive(true);
    }
  }, [broadcast, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const data = {
        message: message.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        site_id: siteId === 'all' ? null : siteId,
        priority,
        target_role: 'agent' as const,
        is_active: isActive,
      };

      const success = await onSave(data);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{broadcast ? 'Edit Broadcast' : 'New Broadcast'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter the broadcast message..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expires">Expires At (optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Higher = shown first</p>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="site">Target Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger id="site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {broadcast && (
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !message.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {broadcast ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
