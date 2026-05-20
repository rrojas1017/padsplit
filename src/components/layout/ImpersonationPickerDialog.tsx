import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  site_id: string | null;
  role: string | null;
};

export function ImpersonationPickerDialog({ open, onOpenChange }: Props) {
  const { startImpersonation, realUser } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, email, site_id')
        .order('name', { ascending: true });
      if (error) {
        toast.error('Failed to load users: ' + error.message);
        setLoading(false);
        return;
      }
      const ids = (profiles || []).map(p => p.id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids);
      const roleMap = new Map<string, string>();
      (roles || []).forEach(r => roleMap.set(r.user_id, r.role));
      if (cancelled) return;
      setRows((profiles || []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        site_id: p.site_id,
        role: roleMap.get(p.id) || null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.name?.toLowerCase().includes(q)) ||
      (r.email?.toLowerCase().includes(q)) ||
      (r.role?.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const pick = (r: Row) => {
    if (!r.role) {
      toast.error('User has no role assigned — cannot impersonate.');
      return;
    }
    const ok = startImpersonation({
      id: r.id,
      name: r.name || r.email || 'Unknown',
      email: r.email || '',
      role: r.role as any,
      siteId: r.site_id || undefined,
    });
    if (!ok) {
      toast.error('Only super admins can impersonate.');
      return;
    }
    onOpenChange(false);
    toast.success(`Viewing as ${r.name || r.email}`);
    navigate('/reports');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>View app as another user</DialogTitle>
          <DialogDescription>
            Super-admin tool. Frontend role/site override only — RLS still runs as {realUser?.email}.
            No data is written under the impersonated identity.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto border rounded-lg divide-y">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No matches</div>
          ) : (
            filtered.map(r => (
              <button
                key={r.id}
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.name || '(no name)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {r.role || 'no role'}
                </Badge>
                {!r.site_id && <span className="text-[10px] text-amber-600">no site</span>}
              </button>
            ))
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Found {filtered.length} of {rows.length} users
        </div>
      </DialogContent>
    </Dialog>
  );
}
