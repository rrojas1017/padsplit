

# Implement Batched Phone Enrichment Updates

## Overview

Refactor the `executeEnrichment` function to use efficient batch updates instead of individual record updates, reducing API calls from ~4,700 to ~50-200.

## Current Problem

The existing code updates records one at a time (lines 174-189):

```typescript
for (const booking of batch) {
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ contact_phone: phone })
    .eq('id', booking.id);  // One API call per record
}
```

This causes network timeouts and "Failed to fetch" errors.

## Solution

Group records by phone number and update all matching IDs in a single API call using Supabase's `.in()` filter.

## Changes to `src/components/import/PhoneEnrichmentTab.tsx`

### Replace the enrichment loop (lines 164-199) with:

**Step 1: Build phone-to-IDs mapping**
```typescript
const phoneToIds = new Map<string, string[]>();

for (const booking of bookings) {
  if (!booking.contact_email) {
    enrichResults.noMatch++;
    continue;
  }

  const email = booking.contact_email.toLowerCase().trim();
  const phone = phoneLookup.get(email);

  if (phone) {
    const ids = phoneToIds.get(phone) || [];
    ids.push(booking.id);
    phoneToIds.set(phone, ids);
  } else {
    enrichResults.noMatch++;
  }
}
```

**Step 2: Batch update by phone number**
```typescript
const phoneEntries = Array.from(phoneToIds.entries());
let processedPhones = 0;
const updateBatchSize = 100; // Max IDs per update call

for (const [phone, ids] of phoneEntries) {
  // Split into chunks if many IDs share the same phone
  for (let i = 0; i < ids.length; i += updateBatchSize) {
    const chunk = ids.slice(i, i + updateBatchSize);
    
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ contact_phone: phone })
      .in('id', chunk);

    if (!updateError) {
      enrichResults.updated += chunk.length;
    }
  }

  processedPhones++;
  setEnrichProgress(Math.round((processedPhones / phoneEntries.length) * 100));
}
```

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| API Calls | ~4,700 | ~50-200 |
| Processing Time | 5-10 minutes | 10-30 seconds |
| Network Errors | Frequent | None |
| Completion Rate | ~45% | 100% |

## After Implementation

1. Go to **Historical Import → Phone Enrichment**
2. Re-upload your `Contact_Export.csv`
3. Click **Start Enrichment**
4. All ~2,686 remaining records will be updated in seconds

