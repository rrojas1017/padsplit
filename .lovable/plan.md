

# Storage & Cost Cleanup: 60-Day Audio Purge + 90-Day api_costs Archival

## Findings (from live DB inspection)

| Resource | Status | Action |
|---|---|---|
| `coaching_audio_url` (Jeff) | 11 files, 0 older than 60d | Lower retention to 60d (currently 15d) |
| `qa_coaching_audio_url` (Katty) | **1,327 files, 1,280 older than 60d** | **Add to cleanup — biggest win** |
| `cleanup-coaching-audio` cron | Runs daily at 3 AM ✓ | Already scheduled, just needs QA logic |
| `api_costs` rows >90 days | 3,891 / 110,647 | Archive to summary table |
| `net._http_response` | 33 MB, 409 rows, oldest = yesterday | **Not leaking** — pg_net auto-purges. No action needed. |

## Plan

### 1. Update `cleanup-coaching-audio` edge function
- Change `RETENTION_DAYS` from `15` → `60`
- Add a second pass that handles `qa_coaching_audio_url` / `qa_coaching_audio_generated_at` (currently ignored)
- Increase batch limit from 100 → 500 per pass so the 1,280 backlog clears in 3 nightly runs (or one manual trigger)
- Both passes: delete from `coaching-audio` storage bucket, then null the URL in `booking_transcriptions` (preserve timestamps for historical record)
- Return combined stats: `{ coaching_deleted, qa_deleted, errors }`

### 2. Archive old `api_costs` rows (>90 days)
Create a migration that:
- Adds `api_costs_monthly_summary` table with columns: `month` (date), `service_type`, `service_provider`, `is_internal`, `record_count`, `total_cost_usd`, `total_tokens`, `total_audio_seconds`
- Adds `archive_old_api_costs()` SECURITY DEFINER function that:
  - Aggregates rows older than 90 days into the summary table (idempotent via `ON CONFLICT`)
  - Deletes the archived rows from `api_costs`
- Schedules a weekly cron job (Sundays 4 AM) to run the archive function
- Adds RLS: super_admin only on the summary table

### 3. Manually trigger one-time backfill
After deploy:
- Call `cleanup-coaching-audio` 3× to clear the 1,280 QA audio backlog (~500 per run)
- Call `archive_old_api_costs()` once via SQL to archive the 3,891 old rows

### 4. Skip: `net._http_response`
Verified — only 1 day of data retained (oldest row is from yesterday). pg_net is correctly auto-purging. No leak.

## Files

| File | Change |
|---|---|
| `supabase/functions/cleanup-coaching-audio/index.ts` | Add QA audio pass, raise retention to 60d, batch 500 |
| New migration | Create `api_costs_monthly_summary` + `archive_old_api_costs()` function + weekly cron |
| Manual trigger after deploy | Run cleanup 3× and `SELECT archive_old_api_costs()` once |

## Expected Impact

- Storage: ~1.7 GB → ~50 MB in `coaching-audio` bucket (~96% reduction)
- `api_costs` table: 110k → 107k rows now, then steady-state (older rows continuously archived weekly)
- Summary table preserves billing history forever in compact form

