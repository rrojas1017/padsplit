

# SOW-Based Billing & Invoicing System

## Overview
Rebuild the billing and invoicing UI to align with the Appendify x PadSplit Statement of Work (SOW). The current system uses raw API costs with markup percentages. The new system needs to bill based on **fixed per-record/per-unit SOW pricing** across multiple service categories, with volume discount tiers, optional add-on services, and professional invoice generation.

---

## What Changes

### 1. New Database Table: `sow_pricing_config`
Stores the SOW pricing tiers so rates can be adjusted without code changes.

| Column | Purpose |
|--------|---------|
| `service_category` | voice_processing, text_processing, data_appending, email_delivery, sms_delivery, chat_delivery, telephony, voice_coaching |
| `base_rate` | e.g., $0.15, $0.04, $0.55 |
| `volume_tier_1_threshold` | Records/month threshold for discount |
| `volume_tier_1_rate` | Discounted rate (e.g., $0.12, $0.025) |
| `unit` | per_record, per_segment, per_email, per_minute, per_interaction |
| `is_optional` | Whether this is an add-on service |

### 2. New Database Table: `invoice_line_items`
Each invoice gets itemized line items instead of a single lump cost.

| Column | Purpose |
|--------|---------|
| `invoice_id` | FK to billing_invoices |
| `service_category` | Maps to SOW section (voice_processing, text_processing, etc.) |
| `description` | Human-readable label |
| `quantity` | Number of records/messages/minutes |
| `unit_rate` | Price per unit applied |
| `subtotal` | quantity x unit_rate |
| `is_optional` | Flag for optional services |

### 3. Update `billing_invoices` Table
Add columns:
- `invoice_number` (auto-incrementing display number like `INV-2026-001`)
- `payment_terms` (Net 15 / Net 30)
- `due_date` (calculated from created_at + payment_terms)

### 4. Update `clients` Table
Remove `markup_percentage` dependency. Add:
- `payment_terms_days` (15 or 30)
- `volume_tier` (standard / tier_1) -- or auto-calculated
- `enabled_services` (jsonb array of opted-in service categories)

---

## UI Components to Build/Rebuild

### A. Invoice Generator (Complete Rebuild)
Replace the current raw-cost-based generator with a SOW-aligned version:

- **Record Classification**: Auto-count records by source type (voice vs. text) from `api_costs` + `bookings` data for the selected period
- **Service Line Items**: Auto-populate line items based on the SOW categories:
  - Voice-Based Records: count x $0.15
  - Text-Based Records: count x $0.04
  - Voice Coaching: count x $0.55 (if enabled)
  - Data Appending: count x $0.30 (if enabled)
  - Email Delivery: count x $0.01
  - SMS Delivery: count x $0.05
  - Chat Delivery: count x $0.02
  - Telephony: minutes x $0.012
- **Volume Discount Auto-Apply**: If monthly volume exceeds tier thresholds, automatically apply discounted rates
- **Invoice Preview**: Professional layout showing all line items, subtotals per category, and grand total
- **Notes & Payment Terms**: Net 15/30 selector, custom notes field

### B. Invoice PDF Export
Generate a professional PDF invoice using jsPDF (already installed) with:
- Appendify branding/logo
- Invoice number, date, due date
- Client details
- Itemized line items table with quantities, unit rates, subtotals
- Category subtotals (Core Processing, Optional Services, Communication, Telephony)
- Grand total
- Payment terms and "No hidden fees" transparency note
- Footer referencing the SOW

### C. Invoice History (Enhanced)
- Show invoice number (INV-2026-001)
- Show due date and overdue status
- Add PDF download button per invoice
- Filter by status (draft/sent/paid/overdue)
- Show itemized breakdown on expand

### D. Client Management (Enhanced)
- Replace markup % with payment terms (Net 15/30)
- Add enabled services toggles (which optional services the client has opted into)
- Show volume tier status

### E. SOW Pricing Configuration Tab
New admin tab in billing to view/edit the SOW pricing table:
- Table showing all service categories with current base rates and volume discount rates
- Edit capability for super_admin to adjust rates
- "SOW Terms" reference card showing the key commercial terms (no platform fees, no seat fees, usage-based only)

### F. Cost Overview Cards (Updated)
Replace raw-cost focused cards with SOW-revenue focused cards:
- **Billable Revenue** (what we charge the client per SOW rates)
- **Internal Cost** (our actual API costs)
- **Margin** (revenue minus cost)
- **Records Processed** (voice + text breakdown)

---

## Technical Details

### Database Migrations
1. Create `sow_pricing_config` table with RLS (super_admin only)
2. Create `invoice_line_items` table with RLS (super_admin only)
3. Add `invoice_number`, `payment_terms`, `due_date` columns to `billing_invoices`
4. Add `payment_terms_days`, `enabled_services` columns to `clients`
5. Create a DB function to auto-generate invoice numbers

### Record Classification Logic
To determine voice vs. text records for billing:
- Voice-Based: Records in `api_costs` with `service_type = 'stt_transcription'` (has audio processing)
- Text-Based: Records processed without STT (chat/email/SMS analysis only)
- Voice Coaching: Records with `service_type IN ('tts_coaching', 'tts_qa_coaching')`
- Communication counts: Query `contact_communications` table filtered by type and period

### Files Modified
- `src/pages/Billing.tsx` -- Add SOW Pricing tab, restructure tabs
- `src/hooks/useBillingData.ts` -- Add SOW pricing fetch, line item generation, invoice number support
- `src/components/billing/InvoiceGenerator.tsx` -- Complete rebuild for SOW line items
- `src/components/billing/InvoiceHistory.tsx` -- Add PDF download, invoice numbers, due dates
- `src/components/billing/ClientManagement.tsx` -- Replace markup with payment terms and enabled services
- `src/components/billing/CostOverviewCards.tsx` -- Revenue vs. cost vs. margin cards
- `src/utils/billingCalculations.ts` -- Add SOW pricing constants and calculation helpers

### New Files
- `src/components/billing/SOWPricingConfig.tsx` -- Pricing configuration table
- `src/components/billing/InvoicePDFGenerator.tsx` -- PDF generation using jsPDF
- `src/components/billing/InvoiceLineItemsTable.tsx` -- Reusable line items display

