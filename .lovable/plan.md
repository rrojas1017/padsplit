# P6-MIG — Phase 6 drift-log capture migration (file only)

Create exactly one new file. Do NOT run, apply, or execute it. No migration tool, no SQL execution. It records production changes the QA lead already applied directly (drift-log #26–#30) and is idempotent. No other file changes except roadmap.md. Do not publish.

## What to create

Path: `supabase/migrations/20260924080000_capture_phase6_direct_changes.sql`

Content: the exact text provided by the user, byte for byte, ending with a trailing newline. The file is written verbatim — no reformatting, no reordering, no SQL review edits. (The markers `-----BEGIN FILE-----` and `-----END FILE-----` delimit the user's paste and are NOT part of the file.)

The SQL captures:
- #27 BIL-45 — `invoice_platform_costs(p_start date, p_end date)`: STABLE SECURITY DEFINER returning research/platform/archived research cost for the invoice generator's ET period (end inclusive). `has_role` super_admin guard; revoked from public/anon; EXECUTE granted to authenticated.
- #28 BIL-18 correction — `billing_cost_summary(p_start timestamptz, p_end timestamptz)`: STABLE SECURITY DEFINER; live api_costs union archived api_costs_monthly_summary with the no-overlap month-covering condition; same super_admin guard and revoke/grant.
- #29 BIL-23 — `billing_invoices` status constraint (adds 'void'), `guard_invoice_status_transition()` BEFORE UPDATE OF status trigger, `btree_gist` extension, and `billing_invoices_no_overlap` EXCLUDE gist constraint excluding void invoices.
- #30 BKG-07 — `bookings.move_in_date DROP NOT NULL`.
- `NOTIFY pgrst, 'reload schema';`
- Header comment notes #26 (temporary orphan-audio storage DELETE policy, created then dropped same hour) is net-zero and not repeated, and that data changes (alerts, move-in dates, voided invoices, orphan audio) are not repeated.

## What I will NOT do

- No migration tool call, no `supabase--migration`, no `run_sql`, no psql execution.
- No edits to RLS, config.toml, edge functions, or any source file.
- No publish.
- No real database calls of any kind.

## After writing (no execution)

Report:
- The file's line count (`wc -l`).
- Its md5sum (`md5sum`), so the user can verify byte-for-byte against the intended content.

## roadmap.md

Add one checked-off entry under Done: `[P6-MIG] Phase 6 drift-log capture migration file written (#27–#30), not applied — done`.
