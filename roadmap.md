# Project Task Roadmap

## In Progress
(none)

## Open
(none)

## Done
- [P9] Coaching audio players use signed URLs (frontend step 1 toward private bucket) — done
- [P-C] Research pipeline fixes (4 functions) — done
- [PIPE-1] Transcription pipeline fixes (3 functions) — done
- [P-A] Research call logging fixes (4 frontend files) — done
- [P1–P8] Security fixes: auth guards on edge functions, unused-function cleanup, SSRF/role hardening (prior phases)
- [x] P-B public script submissions (PublicScriptView + submit-public-script + validate-script-token)
- [x] PIPE-2 reanalyze parity + Kixie webhook cleanup
- [x] P-G1 cost gate, nightly insights dates, deepseek model, drift file
- [x] P-G2 frontend cleanup (7 files)
- [x] P-G3 translate merge by key, per-script research mode, wizard defaults
- [x] P-G4 research_campaign_type routing for public/agent-logged answers
- [x] LP-4 Non-Booking numbers (stats bounds, hot leads, failed parse, created_by)
- [x] LP-1 Payment Experience KPI correctness (shared resolver/normalizer)
- [x] BKG-P3 Dashboard/leaderboard/timezone (businessTime, useDashboardData, EditBooking fetch)
- [x] BIL-FE: billing totals via billing_cost_summary, 7d preset, usage PDF rates from invoice line items
- [x] BIL-FE correction: archived null edge_function → 'archived_monthly_summary' + static label
- [x] BIL-COSTS: shared _shared/costs.ts price list, 10 functions switched, deploy + 401 checks
- [x] BIL-COSTS correction: deepseek-flash alias + DeepSeek fallback
- [x] P5-SEC: internal-only continuation paths + requireUser in create/delete/update-user-role
- [x] P5-SEC correction: bulk-transcription-processor continue guard moved before job lookup (403 for user callers)
- [x] P5-GATE: nightly skip-when-nothing-new gate (3 insight functions) + drift migration file #21-#25 (written, not applied)
- [x] P5-CLEAN: shared cost logging in 14 functions + delete MemberInsights page
- [x] P6-A: void invoices + research/platform AI cost in invoice internal cost (3 billing files)
- [x] P6-B: NULL move-in date (HubSpot import null, NULL-safe readers, 2 functions)
- [x] P6-MIG: Phase 6 drift-log capture migration file written (#27–#30), not applied
- [x] BUG-001: Edit User dialog on Non-Agents tab (UserManagement.tsx only) — state, handlers, super_admin-gated menu item, dialog
- [x] BUG-001b: super_admin password reset from Edit User / Researcher / Agent dialogs (admin-reset-password function, ResetPasswordSection, drift #31 migration file written, not applied)
- [x] BUG-002: Deactivate/Reactivate (admin-set-user-status), reset ends sessions + forces new password, Change password for all roles (change-own-password, ChangePasswordDialog), AuthContext inactive/ban/session checks; drift #32/#33 migration file written, not applied
- [x] P6-C: useMyGoal .maybeSingle() (no 406 on no goal), SiteFilter supervisor lock + preselect, Leaderboard site filter wiring (Set-based)
- [x] BUG-003 Phase A: form/runtime research bookings has_valid_conversation + survey_progress, early ends kept, Reports per-script filter/labels/Ended-early badge, Submissions tab
- [x] BUG-003 Phase B: generate-research-insights script mode (script_<id8>), AI Summary tab, real scale_min/scale_max in script insights
- [x] BUG-003 capture: drift #34 cron jobs file written, not applied
- [x] CR-001: admins can edit supervisor/agent/researcher users (Edit User menu, researcher save denial check, comms disabled prop + denial checks)
- [x] BUG-005: public survey autosave (in_progress rows), idempotent terminal save, office-friendly rate limit
- [x] BUG-007: script-aware research validation, empty transcript → 'unavailable' (No audio); capture file written, not applied
- [x] CR-006: screen-pop placeholder guard (--A--/--B-- → absent) in PublicScriptView sanitizeDialer + both intake cleanDialer/phoneDigits; public links → padsplit.tools (useScriptTokens BASE_URL); both functions deployed
