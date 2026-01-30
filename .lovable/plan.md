

# Hide Third-Party Service Provider Names from Non-Super Admins

## Overview

The platform currently displays technical service provider names (ElevenLabs, Lovable AI, Gemini, etc.) throughout the UI. These implementation details should only be visible to super_admin users. All other users will see generic, user-friendly labels instead.

## Affected Areas

| Location | Current Display | New Display (Non-Super Admin) |
|----------|-----------------|-------------------------------|
| Transcription Modal Badge | "ElevenLabs" | "Voice AI" or hidden |
| Billing - Cost Breakdown Charts | "ElevenLabs", "Lovable AI" | "Voice Services", "AI Services" |
| Billing - Admin Notifications | "elevenlabs", "lovable_ai" | "Voice Services", "AI Services" |
| Billing Calculations Labels | "ElevenLabs", "Lovable AI" | "Voice Services", "AI Services" |
| QA Documentation PDF | Model names, API endpoints | Generic descriptions |

## Implementation Approach

### Strategy: Role-Based Label Mapping

Create a utility that provides different labels based on user role:

```text
┌─────────────────────────────────────────────────────────┐
│                   getProviderLabel()                     │
├─────────────────────────────────────────────────────────┤
│ Input: provider_key (e.g., "elevenlabs")                │
│ Input: isSuperAdmin (boolean)                           │
├─────────────────────────────────────────────────────────┤
│ If super_admin:                                          │
│   → Return "ElevenLabs", "Lovable AI (Gemini)", etc.    │
│                                                          │
│ If NOT super_admin:                                      │
│   → Return "Voice Services", "AI Services", etc.        │
└─────────────────────────────────────────────────────────┘
```

## Files to Modify

### 1. Create New Utility

**File**: `src/utils/providerLabels.ts` (NEW)

A centralized utility for provider label mapping based on user role:

- `getProviderLabel(provider: string, isSuperAdmin: boolean)` - returns appropriate display label
- `getServiceTypeLabel(type: string, isSuperAdmin: boolean)` - returns appropriate service type label
- Constants for super_admin vs generic labels

### 2. Update Billing Components

**File**: `src/components/billing/CostBreakdownCharts.tsx`

- Import `useAuth` and new label utility
- Replace hardcoded "ElevenLabs" / "Lovable AI" with role-based labels
- Super admins see: "ElevenLabs", "Lovable AI"
- Others see: "Voice Services", "AI Services"

**File**: `src/components/billing/AdminNotifications.tsx`

- Import `useAuth` and new label utility
- Update `getServiceBadge()` to use role-based labels
- Service badge text adapts to user role

**File**: `src/utils/billingCalculations.ts`

- Update `PROVIDER_LABELS` to be a function that accepts role context
- Or: Keep internal names, update consuming components to apply labels

### 3. Update Transcription Modal

**File**: `src/components/booking/TranscriptionModal.tsx`

- Import `useAuth`
- Conditionally show "ElevenLabs" badge only for super_admin
- For others, show "Voice AI" or hide the badge entirely

### 4. Update QA Documentation Generator

**File**: `src/utils/qaDocumentation.ts`

- Add parameter for `isSuperAdmin` 
- Replace specific model names ("google/gemini-2.5-flash", "Lovable AI Gateway") with generic terms for non-super_admins
- Super admins: Full technical details
- Others: "AI Processing System", "Cloud AI Services"

---

## Technical Details

### New Provider Labels Utility

```typescript
// src/utils/providerLabels.ts

export const SUPER_ADMIN_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  lovable_ai: 'Lovable AI (Gemini)',
  google_tts: 'Google Cloud TTS',
};

export const GENERIC_LABELS: Record<string, string> = {
  elevenlabs: 'Voice Services',
  lovable_ai: 'AI Services',
  google_tts: 'Voice Services',
};

export function getProviderLabel(
  provider: string, 
  isSuperAdmin: boolean
): string {
  const labels = isSuperAdmin ? SUPER_ADMIN_LABELS : GENERIC_LABELS;
  return labels[provider] || provider;
}

export const SUPER_ADMIN_SERVICE_LABELS: Record<string, string> = {
  stt_transcription: 'Speech-to-Text (ElevenLabs)',
  tts_coaching: 'Text-to-Speech (ElevenLabs)',
  ai_analysis: 'AI Analysis (Gemini)',
  // ...
};

export const GENERIC_SERVICE_LABELS: Record<string, string> = {
  stt_transcription: 'Call Transcription',
  tts_coaching: 'Coaching Audio',
  ai_analysis: 'AI Analysis',
  // ...
};
```

### Component Updates Pattern

```typescript
// Example: CostBreakdownCharts.tsx
import { useAuth } from '@/contexts/AuthContext';
import { getProviderLabel } from '@/utils/providerLabels';

const CostBreakdownCharts = ({ summary }) => {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(['super_admin']);
  
  const providerData = Object.entries(summary.byProvider).map(([provider, cost]) => ({
    name: getProviderLabel(provider, isSuperAdmin),
    value: cost,
    // ...
  }));
  
  // ...
};
```

### Billing Page Access Control

The Billing page (`/billing`) is already restricted to super_admin only. However, some billing-related information might appear in other contexts (notifications, summaries). The changes ensure consistent labeling regardless of where the data appears.

---

## Summary of Changes

| File | Action |
|------|--------|
| `src/utils/providerLabels.ts` | **CREATE** - New utility for role-based labels |
| `src/components/billing/CostBreakdownCharts.tsx` | **MODIFY** - Use role-based labels |
| `src/components/billing/AdminNotifications.tsx` | **MODIFY** - Use role-based labels in badges |
| `src/utils/billingCalculations.ts` | **MODIFY** - Export both label sets |
| `src/components/booking/TranscriptionModal.tsx` | **MODIFY** - Conditionally show/hide provider badge |
| `src/utils/qaDocumentation.ts` | **MODIFY** - Accept role parameter, use generic terms |

