/**
 * Shared utilities for Move-Out Insights components.
 * Every percentage MUST go through formatPercent().
 * Every AI-generated text MUST go through stripUUIDs().
 */

/** Format a decimal (0.0–1.0), number, or string percentage for display. */
export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  
  // String handling
  if (typeof value === 'string') {
    if (!value || value === 'N/A') return '—';
    if (value.includes('%')) return value; // already formatted like "60-70%"
    const n = parseFloat(value);
    if (isNaN(n)) return value;
    const pct = n > 0 && n <= 1 ? n * 100 : n;
    return `${Math.round(pct * 10) / 10}%`;
  }
  
  // Number handling
  if (typeof value === 'number') {
    if (isNaN(value)) return '—';
    const pct = value > 0 && value <= 1 ? value * 100 : value;
    return `${Math.round(pct * 10) / 10}%`;
  }
  
  return '—';
}

/** Strip UUIDs and booking IDs from AI-generated text. */
export function stripUUIDs(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s*\(['\"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['\"]?\)/gi, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[case]')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Format a count with optional total. */
export function formatCount(count: number, total?: number): string {
  if (total) return `${count.toLocaleString()} of ${total.toLocaleString()} records`;
  return `${count.toLocaleString()} cases`;
}

/** Parse severity string into priority level and color classes. */
export function parseSeverityLevel(severity?: string): {
  priority: string;
  level: number;
  borderClass: string;
  bgClass: string;
  textClass: string;
} {
  if (!severity) return { priority: '', level: 3, borderClass: 'border-l-muted', bgClass: 'bg-muted/50', textClass: 'text-muted-foreground' };
  const lower = severity.toLowerCase();
  if (lower.includes('p0') || lower.includes('critical') || lower.includes('act now'))
    return { priority: 'P0', level: 0, borderClass: 'border-l-destructive', bgClass: 'bg-destructive/10', textClass: 'text-destructive' };
  if (lower.includes('p1') || lower.includes('high') || lower.includes('investigate'))
    return { priority: 'P1', level: 1, borderClass: 'border-l-amber-500', bgClass: 'bg-amber-500/10', textClass: 'text-amber-700' };
  if (lower.includes('p2') || lower.includes('monitor'))
    return { priority: 'P2', level: 2, borderClass: 'border-l-blue-500', bgClass: 'bg-blue-500/10', textClass: 'text-blue-700' };
  return { priority: '', level: 3, borderClass: 'border-l-muted', bgClass: 'bg-muted/50', textClass: 'text-muted-foreground' };
}
