

# Fix: Hide LLM/Provider Names from UI

## Problem

The Call Insights modal displays raw provider names like "deepgram" in a badge. Per the white-label policy, no third-party provider names should be exposed to users. The current code at line 448 of `TranscriptionModal.tsx` has a `super_admin` role check, but it's either not working correctly or the user viewing it is a super_admin who should still see a properly formatted label.

## Fix

### 1. `src/components/booking/TranscriptionModal.tsx`

Update the STT provider badge (lines 447-452) to:
- Import and use `getProviderLabel` from `src/utils/providerLabels.ts`
- For super_admins: show the proper capitalized name (e.g., "Deepgram" not "deepgram")
- For all other roles: hide the badge entirely (current behavior, but verify the check works)

Change from:
```tsx
{loadedDetails.sttProvider === 'elevenlabs' ? 'ElevenLabs' : loadedDetails.sttProvider}
```

To:
```tsx
{getProviderLabel(loadedDetails.sttProvider, true)}
```

### 2. Audit other files for raw provider name exposure

Check and fix any other locations where provider names leak:
- `src/components/billing/LLMCostCalculator.tsx` -- lines 319-329 show raw "Deepgram" and "ElevenLabs" labels; these should use `getProviderLabel` based on role
- Any other components rendering `sttProvider` values directly

## Files to Edit

- `src/components/booking/TranscriptionModal.tsx` -- use `getProviderLabel` for the STT badge
- `src/components/billing/LLMCostCalculator.tsx` -- wrap provider labels with role-based anonymization

