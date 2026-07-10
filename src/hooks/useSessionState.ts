import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

/**
 * Session-scoped persistent state. Keeps a value in sessionStorage so
 * navigating away and returning within the same login session preserves it.
 * Cleared on logout (AuthContext.logout wipes sessionStorage) and on tab close.
 *
 * Handles Date instances (and nested { from: Date, to: Date }) via ISO
 * serialization + revival, so date-range values round-trip safely.
 */

const PREFIX = 'ls-session:';

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function reviver(_key: string, value: unknown) {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw, reviver) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    if (value === undefined) {
      sessionStorage.removeItem(PREFIX + key);
    } else {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    }
  } catch {
    /* quota / disabled — ignore */
  }
}

export function useSessionState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const fallback =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;
    return read<T>(key, fallback);
  });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    write(keyRef.current, state);
  }, [state]);

  return [state, setState];
}

/** Clears all session-scoped state written by useSessionState. */
export function clearSessionState() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
