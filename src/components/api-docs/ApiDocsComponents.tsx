import React from 'react';
import { Copy, Check } from 'lucide-react';

/* ── Section wrapper ── */
export function DocSection({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-border last:border-b-0">
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-12">
        {children}
      </div>
    </section>
  );
}

/* ── Section header ── */
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground tracking-tight">{title}</h2>
      {description && <p className="mt-2 text-muted-foreground text-sm leading-relaxed max-w-2xl">{description}</p>}
    </div>
  );
}

/* ── HTTP method badge ── */
export function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' }) {
  const styles: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    POST: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    PUT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    PATCH: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
    DELETE: 'bg-destructive/15 text-destructive border-destructive/20',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${styles[method]}`}>
      {method}
    </span>
  );
}

/* ── Status badge ── */
export function StatusBadge({ status, label }: { status: 'live' | 'beta' | 'coming-soon'; label?: string }) {
  const styles = {
    live: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    beta: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    'coming-soon': 'bg-muted text-muted-foreground',
  };
  const defaults = { live: 'Live', beta: 'Beta', 'coming-soon': 'Coming Soon' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {label || defaults[status]}
    </span>
  );
}

/* ── Code block with copy ── */
export function CodeBlock({ children, title, language }: { children: string; title?: string; language?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card group">
      {(title || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {title || language}
          </span>
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
      <pre className="p-4 text-[13px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/* ── Callout / info box ── */
export function Callout({ variant = 'info', icon, children }: {
  variant?: 'info' | 'warning' | 'danger';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-300',
    warning: 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300',
    danger: 'bg-destructive/5 border-destructive/20 text-destructive',
  };
  return (
    <div className={`flex gap-3 p-4 rounded-xl border text-sm leading-relaxed ${styles[variant]}`}>
      {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

/* ── Parameter table ── */
export function ParamTable({ params }: {
  params: { name: string; type: string; required: boolean; description: string }[];
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Parameter</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Required</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {params.map(p => (
              <tr key={p.name} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <code className="text-xs font-mono font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded">{p.name}</code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground font-mono">{p.type}</span>
                </td>
                <td className="px-4 py-3">
                  {p.required ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Required</span>
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground">Optional</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs leading-relaxed">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Response block ── */
export function ResponseBlock({ status, label, children }: { status: number; label: string; children: string }) {
  const color = status < 300
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
    : status < 500
    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
    : 'text-destructive bg-destructive/10';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>{status}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <CodeBlock>{children}</CodeBlock>
    </div>
  );
}
