import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/utils/passwordValidation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  forced?: boolean;
}

export function ChangePasswordDialog({ open, onOpenChange, forced = false }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const { logout, refreshMustChangePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = validatePassword(next);
  const canSubmit =
    current.length > 0 &&
    strength.isValid &&
    next.length <= 128 &&
    next === confirm &&
    next !== current &&
    !submitting;

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setShow(false); };

  const handleOpenChange = (o: boolean) => {
    if (forced) return;
    if (!o) reset();
    onOpenChange?.(o);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('change-own-password', {
        body: { currentPassword: current, newPassword: next },
      });
      if (error) {
        let message = 'Failed to change password';
        if (error instanceof FunctionsHttpError) {
          try {
            const payload = (await error.context.json()) as { error?: string; unmet?: string[] };
            if (payload?.error) message = payload.error;
            if (Array.isArray(payload?.unmet) && payload.unmet.length > 0) {
              message += `: ${payload.unmet.join(', ')}`;
            }
          } catch {
            // keep generic message
          }
        }
        toast({ title: 'Password not changed', description: message, variant: 'destructive' });
        return;
      }
      await supabase.auth.refreshSession();
      await refreshMustChangePassword();
      toast({ title: 'Password changed. Other devices were signed out.' });
      reset();
      onOpenChange?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  const inputType = show ? 'text' : 'password';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn('sm:max-w-md', forced && '[&>button]:hidden')}
        onEscapeKeyDown={(e) => { if (forced) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (forced) e.preventDefault(); }}
        onInteractOutside={(e) => { if (forced) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{forced ? 'Choose a new password' : 'Change password'}</DialogTitle>
          <DialogDescription>
            {forced
              ? 'Your password was reset by an administrator. Choose a new password to continue.'
              : 'Other devices will be signed out after the change.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-current">Current password</Label>
            <Input id="cp-current" type={inputType} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">New password</Label>
            <Input id="cp-new" type={inputType} autoComplete="new-password" maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
            <PasswordStrengthIndicator result={strength} show={next.length > 0} />
            {next.length > 0 && next === current && (
              <p className="text-xs text-destructive">Must differ from your current password.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input id="cp-confirm" type={inputType} autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm.length > 0 && confirm !== next && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {show ? 'Hide passwords' : 'Show passwords'}
          </button>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {forced ? (
            <Button variant="link" className="px-0" onClick={() => logout()}>Sign out</Button>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Change password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
