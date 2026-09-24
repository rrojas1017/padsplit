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
- [ ] P6-B: NULL move-in date (HubSpot import null, NULL-safe readers, 2 functions)
