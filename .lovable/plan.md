
## Fix: Script Token Generation Failing

### Root Cause

The `script_access_tokens` table has a broken column default for the `token` field:

```sql
DEFAULT encode(extensions.gen_random_bytes(24), 'base64url'::text)
```

The problem is `'base64url'` — this is **not a valid encoding format** in this version of PostgreSQL. Valid options are `'base64'`, `'hex'`, and `'escape'`. Every INSERT into this table attempts to evaluate this default, fails with a Postgres error, and the hook catches it and shows "Failed to generate link".

### Fix

Alter the column default to use a working approach. Since `gen_random_bytes` from `pgcrypto` is also unavailable directly, the best approach is to use `gen_random_uuid()` (which is always available) to generate a unique, URL-safe token:

```sql
ALTER TABLE public.script_access_tokens
  ALTER COLUMN token SET DEFAULT replace(replace(replace(
    encode(gen_random_uuid()::text::bytea, 'base64'),
    '+', '-'), '/', '_'), E'\n', '');
```

This generates a ~48-character base64-encoded, URL-safe token (no `+`, `/`, or newlines) from a UUID — cryptographically unique and safe to use in URLs.

### Files Changed

1. **New migration** — Alters the `token` column default on `script_access_tokens` to a working expression.

No frontend code changes are needed. The hook already sends the insert without a `token` value, correctly relying on the column default.
