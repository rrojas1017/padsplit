import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/utils/passwordValidation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResetPasswordSectionProps {
  userId: string;
  userName: string;
}

export function ResetPasswordSection({ userId, userName }: ResetPasswordSectionProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const result = validatePassword(pw);
  const mismatch = confirm.length > 0 && confirm !== pw;
  const canSubmit = result.isValid && pw === confirm && pw.length <= 128 && !submitting;

  const reset = () => {
    setPw('');
    setConfirm('');
    setShow(false);
    setExpanded(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId, newPassword: pw },
      });
      if (error) {
        let message = 'Failed to update password';
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
        toast({ title: 'Password not updated', description: message, variant: 'destructive' });
        return;
      }
      toast({ title: `Password updated for ${userName}. Share it with the user securely.` });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
        <KeyRound className="w-4 h-4 mr-2" />
        Reset password
      </Button>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`resetPw-${userId}`}>New password</Label>
        <div className="relative">
          <Input
            id={`resetPw-${userId}`}
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            maxLength={128}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        <PasswordStrengthIndicator result={result} show={pw.length > 0} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`resetPwConfirm-${userId}`}>Confirm password</Label>
        <Input
          id={`resetPwConfirm-${userId}`}
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          maxLength={128}
        />
        {mismatch && <p className="text-xs text-destructive">Passwords do not match</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Set password
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
