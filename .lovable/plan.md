

# Fix Sub-Category Drill-Down — Extract Sub-Reasons from `case_brief`

## Problem
The `reason_detail` field is NULL across all 600+ records. The hook correctly tries to use it, but since it's always empty, it falls back to `primary_reason_code` — producing a single 100% row per cluster.

## Solution
Use keyword-based sub-categorization from `case_brief` (which IS populated on every record) to create meaningful sub-reasons within each cluster. This is a client-side extraction — no database changes needed.

## Changes

### 1. `src/utils/reason-code-mapping.ts` — Add `extractSubReason()` function
Add a new function that takes `primary_reason_code` and `case_brief` and returns a sub-reason string. Each cluster gets its own keyword map:

**Host Negligence sub-reasons:**
- "Mold / Pest Infestation" — keywords: mold, pest, roach, mice, rat, bug, bedbug
- "Maintenance / Repairs Ignored" — keywords: broken, repair, maintenance, fix, leak, plumbing
- "Unsanitary / Dirty Conditions" — keywords: dirty, filthy, clean, unsanitary, trash
- "Host Unresponsive" — keywords: host unresponsive, host didn't, host won't, host never, host refused, couldn't reach host
- "Overcrowding / Illegal Conversion" — keywords: overcrowd, too many, converted, illegal
- "Eviction by Host" — keywords: notice to vacate, kicked out, asked to leave, evict
- "Misrepresentation" — keywords: misrepresent, not as advertised, false, misleading, different from

**Payment Friction sub-reasons:**
- "Rent Too High / Increase" — keywords: rent increase, too high, too expensive, rent went up, afford
- "Late Fees / Collections" — keywords: late fee, collection, penalty
- "Billing / Payment Issues" — keywords: billing, charged, overcharge, payment issue, refund

**Roommate Conflict sub-reasons:**
- "Noise / Cleanliness" — keywords: noise, loud, dirty roommate, messy
- "Harassment / Theft / Drugs" — keywords: harass, theft, stole, drug, smoking
- "Safety Fears" — keywords: safety, unsafe, scared, threatened, assault

**External Life Event sub-reasons:**
- "Buying a Home" — keywords: buying, purchased, own place, own apartment
- "Job Relocation" — keywords: relocat, new job, job transfer, moving for work
- "Family / Personal" — keywords: family, personal, relationship, married
- "Found Better Housing" — keywords: found somewhere, better place, facebook marketplace, cheaper

Other clusters get simpler 2-3 sub-reason maps. Fallback for any cluster: the cluster name itself.

### 2. `src/hooks/useReasonCodeCounts.ts` — Use `extractSubReason()` instead of `reason_detail`
- Also fetch `case_brief` from `research_classification` in the loop
- Replace the `subKey` logic: `const subKey = extractSubReason(reasonCode, cls?.case_brief || '')`
- Keep the "< 3 records → Other in this category" grouping

### Files
| File | Action |
|------|--------|
| `src/utils/reason-code-mapping.ts` | Add `extractSubReason()` with per-cluster keyword maps |
| `src/hooks/useReasonCodeCounts.ts` | Use `extractSubReason()` for sub-reason grouping |

