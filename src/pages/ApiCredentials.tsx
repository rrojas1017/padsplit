import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useApiCredentials, ApiCredential } from '@/hooks/useApiCredentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Key, Plus, Copy, Check, AlertTriangle, RefreshCw, Trash2, ShieldOff, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-primary/10 text-primary border-primary/20' },
    revoked: { label: 'Revoked', className: 'bg-destructive/15 text-destructive border-destructive/20' },
    expired: { label: 'Expired', className: 'bg-muted text-muted-foreground border-border' },
  };
  const { label, className } = map[status] || map.revoked;
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="ml-1.5 p-1 rounded hover:bg-muted transition-colors flex-shrink-0" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

// ── Secret Display Modal ─────────────────────────────────────────────────────
function SecretModal({ open, secret, onClose }: {
  open: boolean;
  secret: string;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast({ title: 'Secret copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={() => confirmed && onClose()}>
      <DialogContent className="max-w-lg" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Your New Client Secret
          </DialogTitle>
          <DialogDescription>
            This secret will <strong>not be shown again</strong>. Copy it now and store it securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Store this secret in a password manager or secure vault. Once you close this dialog it cannot be retrieved.
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Client Secret</Label>
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3 border border-border">
              <code className="text-sm font-mono text-foreground flex-1 break-all">{secret}</code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-background transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-saved"
              checked={confirmed}
              onCheckedChange={v => setConfirmed(!!v)}
            />
            <label htmlFor="confirm-saved" className="text-sm text-foreground cursor-pointer">
              I have copied and securely stored my client secret
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={!confirmed} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Credential Dialog ─────────────────────────────────────────────────
function CreateDialog({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (params: { application_name: string; expires_at?: string | null; rate_limit?: number | null }) => Promise<void>;
}) {
  const [appName, setAppName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [rateLimit, setRateLimit] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;
    setLoading(true);
    try {
      await onCreate({
        application_name: appName.trim(),
        expires_at: expiresAt || null,
        rate_limit: rateLimit ? parseInt(rateLimit) : null,
      });
      setAppName(''); setExpiresAt(''); setRateLimit('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create API Credential</DialogTitle>
          <DialogDescription>
            Generate a new Client ID and Secret for an external application.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="app-name">Application Name <span className="text-destructive">*</span></Label>
            <Input
              id="app-name"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="e.g. Zapier Integration"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="expires-at">Expiration Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="rate-limit">Rate Limit (req/min) <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="rate-limit"
              type="number"
              min="1"
              value={rateLimit}
              onChange={e => setRateLimit(e.target.value)}
              placeholder="e.g. 60"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !appName.trim()}>
              {loading ? 'Generating…' : 'Generate Credentials'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ApiCredentials() {
  const { credentials, loading, createCredential, revokeCredential, regenerateCredential, deleteCredential } = useApiCredentials();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'revoke' | 'regenerate' | 'delete';
    id: string;
    name: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleCreate = async (params: { application_name: string; expires_at?: string | null; rate_limit?: number | null }) => {
    try {
      const result = await createCredential(params);
      setSecret(result.client_secret);
      toast({ title: 'Credential created successfully' });
    } catch (err) {
      toast({ title: 'Failed to create credential', variant: 'destructive' });
      throw err;
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'revoke') {
        await revokeCredential(confirmAction.id);
      } else if (confirmAction.type === 'delete') {
        await deleteCredential(confirmAction.id);
      } else if (confirmAction.type === 'regenerate') {
        const result = await regenerateCredential(confirmAction.id);
        setSecret(result.client_secret);
        toast({ title: 'Secret regenerated' });
      }
    } catch {
      toast({ title: 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const fmt = (date: string | null) => date ? format(new Date(date), 'MMM d, yyyy') : '—';

  const confirmMessages = {
    revoke: {
      title: 'Revoke Credential',
      desc: (name: string) => `Revoking "${name}" will immediately block any integrations using this credential. This action cannot be undone.`,
      action: 'Revoke',
      variant: 'destructive' as const,
    },
    regenerate: {
      title: 'Regenerate Secret',
      desc: (name: string) => `This will invalidate the current secret for "${name}" and generate a new one. Update any integrations immediately after.`,
      action: 'Regenerate',
      variant: 'default' as const,
    },
    delete: {
      title: 'Delete Credential',
      desc: (name: string) => `Permanently delete "${name}"? All integrations using this credential will stop working. This cannot be undone.`,
      action: 'Delete',
      variant: 'destructive' as const,
    },
  };

  return (
    <DashboardLayout title="API Credentials" subtitle="Manage API keys for external integrations">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Key className="w-6 h-6 text-primary" />
              API Credentials
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage API keys for external integrations. Secrets are hashed and displayed only once.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href="/api-docs" target="_blank" className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                API Docs
              </a>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              New Credential
            </Button>
          </div>
        </div>

        {/* Security notice */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-4 pb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-medium text-foreground">Security reminder: </span>
              <span className="text-muted-foreground">
                Client secrets are shown once at generation time. They are stored hashed and cannot be retrieved. 
                If a secret is lost, regenerate it and update all integrations.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Credentials ({credentials.length})</CardTitle>
            <CardDescription>All active API credentials for external integrations.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading credentials…</div>
            ) : credentials.length === 0 ? (
              <div className="p-12 text-center">
                <Key className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No credentials yet</p>
                <p className="text-muted-foreground/70 text-sm mt-1">Create your first API credential to get started.</p>
                <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Credential
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((cred: ApiCredential) => (
                    <TableRow key={cred.id}>
                      <TableCell className="font-medium">{cred.application_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0">
                          <code className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                            {cred.client_id}
                          </code>
                          <CopyButton value={cred.client_id} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={cred.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(cred.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(cred.last_used_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(cred.expires_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={cred.status === 'revoked'}
                            onClick={() => setConfirmAction({ type: 'regenerate', id: cred.id, name: cred.application_name })}
                            title="Regenerate secret"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            disabled={cred.status === 'revoked'}
                            onClick={() => setConfirmAction({ type: 'revoke', id: cred.id, name: cred.application_name })}
                            title="Revoke credential"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmAction({ type: 'delete', id: cred.id, name: cred.application_name })}
                            title="Delete credential"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      {secret && (
        <SecretModal
          open={!!secret}
          secret={secret}
          onClose={() => setSecret(null)}
        />
      )}

      {confirmAction && (
        <AlertDialog open onOpenChange={open => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {confirmMessages[confirmAction.type].title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmMessages[confirmAction.type].desc(confirmAction.name)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={confirmMessages[confirmAction.type].variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {actionLoading ? 'Processing…' : confirmMessages[confirmAction.type].action}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DashboardLayout>
  );
}
