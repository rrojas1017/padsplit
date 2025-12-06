// Database Circuit Breaker - prevents query storms during DB issues

interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
  cooldownUntil: number | null;
}

const state: CircuitBreakerState = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  cooldownUntil: null,
};

const FAILURE_THRESHOLD = 3; // Number of failures before opening circuit
const FAILURE_WINDOW_MS = 30000; // 30 seconds window for counting failures
const COOLDOWN_MS = 60000; // 60 seconds cooldown when circuit is open

// Track in-flight queries to prevent duplicates
const inFlightQueries = new Map<string, Promise<any>>();

export function recordFailure(): void {
  const now = Date.now();
  
  // Reset if outside the failure window
  if (state.lastFailure && now - state.lastFailure > FAILURE_WINDOW_MS) {
    state.failures = 0;
  }
  
  state.failures++;
  state.lastFailure = now;
  
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
    state.cooldownUntil = now + COOLDOWN_MS;
    console.warn('[Circuit Breaker] OPENED - Database queries paused for 60 seconds');
  }
}

export function recordSuccess(): void {
  // Reset on success
  state.failures = 0;
  state.lastFailure = null;
  
  if (state.isOpen) {
    state.isOpen = false;
    state.cooldownUntil = null;
    console.log('[Circuit Breaker] CLOSED - Database queries resumed');
  }
}

export function isCircuitOpen(): boolean {
  if (!state.isOpen) return false;
  
  const now = Date.now();
  if (state.cooldownUntil && now >= state.cooldownUntil) {
    // Cooldown expired, try again (half-open state)
    state.isOpen = false;
    state.cooldownUntil = null;
    state.failures = 0;
    console.log('[Circuit Breaker] Cooldown expired, attempting to resume queries');
    return false;
  }
  
  return true;
}

export function getCooldownRemaining(): number {
  if (!state.cooldownUntil) return 0;
  const remaining = Math.max(0, state.cooldownUntil - Date.now());
  return Math.ceil(remaining / 1000);
}

// Debounce/dedupe wrapper for queries
export async function deduplicatedQuery<T>(
  key: string,
  queryFn: () => Promise<T>
): Promise<T | null> {
  // Check circuit breaker first
  if (isCircuitOpen()) {
    console.log(`[Circuit Breaker] Query "${key}" blocked - circuit is open`);
    return null;
  }
  
  // Check if same query is already in flight
  const existing = inFlightQueries.get(key);
  if (existing) {
    console.log(`[Query Dedup] Reusing in-flight query: ${key}`);
    return existing;
  }
  
  // Execute query
  const promise = queryFn()
    .then((result) => {
      recordSuccess();
      inFlightQueries.delete(key);
      return result;
    })
    .catch((error) => {
      recordFailure();
      inFlightQueries.delete(key);
      throw error;
    });
  
  inFlightQueries.set(key, promise);
  return promise;
}

// Simple debounce utility
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}
