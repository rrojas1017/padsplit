
# Fix: PostgREST Schema Cache is Stale

## Root Cause

The `check-auto-transcription` edge function is **failing on every new booking** with:

```
column bookings.transcription_status does not exist
```

Debugging findings:
- The `transcription_status` column **does exist** in the database (confirmed via direct SQL)
- The DB trigger fires correctly (logs show it was called for all 5 stuck bookings)
- The edge function crashes at the **atomic claim step** (line 76-79) when it tries to `UPDATE bookings SET transcription_status = 'queued' WHERE transcription_status IS NULL`
- PostgREST (the API layer the Supabase JS client uses) has a **stale schema cache** and doesn't recognize the column yet

This is why 2 bookings processed earlier today worked fine — they likely ran after a prior cache reload — and the last 5 added after that cache drifted are all stuck.

## What Needs to Happen

### 1. Reload the PostgREST Schema Cache (immediate fix)

The fastest fix is to signal PostgREST to reload its schema cache by calling:

```sql
NOTIFY pgrst, 'reload schema';
```

This is a built-in PostgREST mechanism — sending this NOTIFY instantly makes PostgREST pick up any schema changes (new columns, tables, etc.) without any restart needed.

### 2. Re-trigger the 5 Stuck Bookings

After the cache is reloaded, the 5 stuck bookings still won't process on their own (the trigger already fired and won't re-fire). We need to manually invoke `check-auto-transcription` for each stuck booking ID:

- `bc4354ef-5ca0-4da5-9711-ef3dd7a09757`
- `015908f2-a4dc-4a9f-a1ae-0c7664158681`
- `6147573b-7510-41d4-a9d5-26731f72655c`
- `d8203b74-e101-439f-9604-4e5f5cdad812`
- `b4fbf950-2880-49b3-881a-2c3fd38aa92d`

This can be done directly via a SQL call using `pg_net` (the same mechanism the DB trigger uses), so no frontend change is needed.

### 3. Future-Proof: Add NOTIFY to Migrations

To prevent this from happening again after future schema changes, we'll add `NOTIFY pgrst, 'reload schema';` at the end of the SQL migration file so the cache refreshes automatically when a migration runs.

## Files to Change

| Action | What |
|---|---|
| SQL migration | Run `NOTIFY pgrst, 'reload schema'` to reload the cache |
| SQL migration | Re-trigger stuck bookings using `pg_net.http_post` for each of the 5 booking IDs |

No edge function code changes are needed — the function itself is correct, it's purely a schema cache staleness issue.
