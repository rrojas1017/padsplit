

# Pain Point Issue Tagging on Records

## Goal

Enable PadSplit to filter and audit individual records by the specific pain point categories detected during call analysis (e.g., "Payment Confusion", "Host Approval Issues", "Transportation Barriers"). This turns the aggregated insights from Booking Insights into actionable, record-level audit capability in the Reports page.

## How It Works

When a call is transcribed and analyzed, the AI already extracts `memberConcerns`, `objections`, and `callSentiment` into `call_key_points`. This feature adds a classification step that maps those raw data points into standardized issue categories and stores them directly on the booking record. PadSplit can then filter Reports by any issue category to see exactly which accounts experienced it.

## Standardized Issue Categories

The system will classify each record into one or more of these categories (based on what the AI insights already surface):

- **Payment & Pricing Confusion** -- promo codes, weekly rates, deposits, payment methods
- **Booking Process Issues** -- platform navigation, booking flow confusion, listing accuracy
- **Host & Approval Concerns** -- host responsiveness, approval delays, rejection fears
- **Trust & Legitimacy** -- scam concerns, safety worries, company legitimacy questions
- **Transportation Barriers** -- distance to work, public transit, car access
- **Move-In Barriers** -- timing conflicts, background check worries, documentation
- **Property & Amenity Mismatch** -- room size, amenities, location preferences
- **Financial Constraints** -- budget limitations, income verification, affordability

## Database Changes

**New column on `bookings` table:**
- `detected_issues` (text[], nullable) -- array of standardized issue category strings

This column lives on the main `bookings` table (not `booking_transcriptions`) so it can be filtered efficiently with server-side queries without requiring a JOIN.

## Backend Changes

### 1. Update `transcribe-call` Edge Function

After the AI generates `call_key_points`, add a classification step that scans `memberConcerns`, `objections`, and the call summary to map them to standardized categories. This uses keyword/semantic matching (not an additional AI call) to keep it fast and free:

```text
memberConcerns: ["worried about deposit amount", "confused about promo code"]
  -> detected_issues: ["Payment & Pricing Confusion"]

objections: ["too far from work", "no car"]
  -> detected_issues: ["Transportation Barriers"]
```

The classification runs inline after key points extraction and writes the `detected_issues` array back to the `bookings` row.

### 2. New Edge Function: `backfill-detected-issues`

Processes all existing records that have `call_key_points` but no `detected_issues`. Reads the stored key points from `booking_transcriptions`, runs the same classification logic, and updates the `bookings` row. Uses batch pagination (500 per batch) to handle the full dataset.

## Frontend Changes

### 1. Reports Page -- New Filter Dropdown

Add a "Pain Point Issues" multi-select filter alongside existing filters (Status, Type, Method, etc.):

- Dropdown shows all standardized issue categories
- Selecting one or more categories filters to records tagged with ANY of those issues
- Badge count shows how many records match each category
- Works with server-side pagination via the existing `useReportsData` hook

### 2. Reports Table -- Issue Badges Column

Add a new column "Issues" to the reports table that displays small colored badges for each detected issue on a record. Badges use the same iconography as the Pain Points panel (CreditCard for payment, Car for transportation, etc.).

### 3. Reports Summary Cards

Add an "Issues Detected" summary card showing total records with at least one flagged issue out of the current filtered set.

### 4. CSV Export Update

Include `detected_issues` as a comma-separated column in the CSV export so PadSplit can process the data externally.

## Data Flow

```text
Call Transcribed (existing)
        |
        v
AI extracts call_key_points (existing)
  - memberConcerns, objections, callSentiment
        |
        v
Classification Engine (NEW)
  - Scans concerns, objections, summary
  - Maps to standardized issue categories
  - Keyword + pattern matching (no extra AI cost)
        |
        v
bookings.detected_issues = ["Payment & Pricing Confusion", "Transportation Barriers"]
        |
        v
Reports page shows issue badges + filter dropdown
        |
        v
PadSplit filters by "Payment & Pricing Confusion"
  -> sees all 47 records with that issue
  -> can audit each account individually
```

## Technical Details

### Classification Logic (keyword matching)

The classifier scans `memberConcerns`, `objections`, `summary`, and `memberPreferences` for keyword patterns:

| Category | Keywords/Patterns |
|---|---|
| Payment & Pricing Confusion | payment, promo, deposit, weekly rate, cost, price, fee, afford |
| Booking Process Issues | booking, navigate, website, platform, listing, process, confus |
| Host & Approval Concerns | host, approval, approv, reject, landlord, response, wait |
| Trust & Legitimacy | scam, legit, trust, safe, real, fraud, concern about company |
| Transportation Barriers | transport, drive, car, bus, transit, distance, commute, far from |
| Move-In Barriers | move-in, background check, document, timing, ready, schedule |
| Property & Amenity Mismatch | room, amenity, size, location, neighborhood, noisy, space |
| Financial Constraints | budget, income, afford, expensive, money, unemploy, verification |

### Server-Side Filter (useReportsData update)

Add `issueFilter: string[]` to `ReportsFilters`. When populated, adds an `&&` (overlap) operator query:

```sql
WHERE detected_issues && ARRAY['Payment & Pricing Confusion']
```

This leverages PostgreSQL array overlap for efficient filtering.

### Backfill Strategy

The backfill function processes records in batches of 500, reads `call_key_points` from `booking_transcriptions`, runs the classifier, and updates `bookings.detected_issues`. Expected to process the full historical dataset in under 2 minutes.

## Files to Create

- `supabase/functions/backfill-detected-issues/index.ts` -- one-time backfill for existing records

## Files to Edit

- `supabase/functions/transcribe-call/index.ts` -- add classification step after key points extraction
- `src/hooks/useReportsData.ts` -- add `issueFilter` to filters and query logic
- `src/pages/Reports.tsx` -- add issue filter dropdown, issue badges column, summary card
- `src/types/index.ts` -- add `detectedIssues` to Booking interface

## Implementation Order

1. Database migration (add `detected_issues` column)
2. Build classification utility (shared between transcribe-call and backfill)
3. Update `transcribe-call` to classify new records
4. Create `backfill-detected-issues` for existing records
5. Update `useReportsData` with issue filter
6. Update Reports UI (filter dropdown, badges column, CSV export)
7. Run backfill to tag all historical records

