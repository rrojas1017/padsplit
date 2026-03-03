

## Remove Telephony from Billing

### Why
No telephony provider (Telnyx, Twilio, etc.) is integrated. The telephony line item was added preemptively but has never produced real costs. It should be removed from all billing surfaces to avoid confusion.

### Changes

**1. `src/utils/billingCalculations.ts`**
- Remove `telephony` entry from `SOW_PRICING`
- Remove `telephony` from `SOW_CATEGORY_LABELS` and `SOW_UNIT_LABELS` (`per_minute`)

**2. `src/components/billing/UsageDetailPDFGenerator.ts`**
- Remove the entire "Telephony Detail" page/section that queries platform-originated calls and calculates billable minutes
- Remove telephony from the cover summary table

**3. `src/components/billing/InvoiceGenerator.tsx`** (if it references telephony)
- Remove telephony line item generation

**4. Database: `sow_pricing_config` table**
- If a `telephony` row exists, deactivate it (`is_active = false`) via migration

### What stays
- `call_duration_seconds` on bookings remains (it's used for STT cost calculation, not telephony billing)
- The `api_costs` table structure is unchanged

### Files to modify
| File | Change |
|------|--------|
| `src/utils/billingCalculations.ts` | Remove telephony from SOW constants |
| `src/components/billing/UsageDetailPDFGenerator.ts` | Remove telephony section from PDF |
| `src/components/billing/InvoiceGenerator.tsx` | Remove telephony line if present |
| Database migration | Set `is_active = false` on telephony SOW row |

