

# Add Bulk Processing UI to Settings Page

## Problem Identified
The `BulkProcessingTab` component (a complete, functional UI for managing bulk transcription jobs with 10-second pacing) exists in the codebase but was **never added to the Settings page**. This is why you only see "Data Import" on the Data tab - the Bulk Processing section is missing.

## Solution
Import and add the `BulkProcessingTab` component to the Settings page, either:
1. **Option A**: Add it to the existing Data tab (below Data Import)
2. **Option B**: Create a dedicated sub-section in the Data tab

## Technical Details

### File to Modify
`src/pages/Settings.tsx`

### Changes Required
1. **Add import** at the top of the file:
   ```typescript
   import { BulkProcessingTab } from '@/components/import/BulkProcessingTab';
   ```

2. **Add component to Data tab** (around line 237, after the Data Import card closes):
   ```tsx
   {/* Bulk Transcription Processing */}
   {canAccessAIManagement && <BulkProcessingTab />}
   ```

   This ensures only admins/super_admins can see the bulk processing controls.

## What You'll See After This Change
Once implemented, the Data tab will show:
1. **Data Import** section (existing - Google Sheets URL, Upload CSV)
2. **Bulk Processing** section (NEW - with pending stats cards, job creation form, and active job monitoring)

The Bulk Processing UI includes:
- Pending transcription counts (Vixicom vs PadSplit vs Total)
- Create new job form with:
  - Job name
  - Site filter (Vixicom Only, Non-Vixicom, All)
  - Pacing slider (5-30 seconds, default 10s)
  - TTS toggle
  - Cost/time estimates
- Active job monitoring with progress, ETA, stall detection
- Job history

## Estimated Implementation Time
~2 minutes - just adding an import and one component line

