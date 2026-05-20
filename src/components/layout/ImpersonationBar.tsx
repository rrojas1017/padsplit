import { useState } from 'react';
import { Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function ImpersonationBar() {
  const { user, realUser, isImpersonating, stopImpersonation } = useAuth();
  const [expanded, setExpanded] = useState(false);

  if (!isImpersonating || !user) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/40 px-6 py-2 text-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <Eye className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
        <span className="font-semibold text-amber-800 dark:text-amber-200">
          Viewing as {user.name}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 font-medium uppercase">
          {user.role}
        </span>
        {realUser && (
          <span className="text-xs text-amber-700/80 dark:text-amber-300/80">
            (real: {realUser.email})
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs ml-auto"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          Effective context
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-amber-500/50"
          onClick={stopImpersonation}
        >
          <X className="h-3 w-3 mr-1" /> Exit
        </Button>
      </div>
      {expanded && (
        <div className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90 grid grid-cols-1 sm:grid-cols-4 gap-2 font-mono">
          <div><span className="opacity-70">id:</span> {user.id}</div>
          <div><span className="opacity-70">role:</span> {user.role}</div>
          <div><span className="opacity-70">site_id:</span> {user.siteId || '∅ (none)'}</div>
          <div><span className="opacity-70">email:</span> {user.email}</div>
        </div>
      )}
    </div>
  );
}
