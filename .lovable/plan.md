
# Remove Hardcoded Brand Badge from Call Insights

## Issue

The "ElevenLabs" brand name is visible to all users in the Call Insights modal, violating the provider anonymization policy. This badge is hardcoded and always displayed regardless of user role.

## Root Cause

In `TranscriptionModal.tsx`, there are two badges related to the transcription provider:

1. **Lines 448-451**: A role-restricted STT provider badge (correctly only visible to super_admin)
2. **Lines 469-472**: A hardcoded "ElevenLabs" badge that's **always visible** to everyone

The second badge is the problem - it's redundant and exposes the brand name to non-admin users.

---

## Solution

Remove the hardcoded "ElevenLabs" badge entirely since:
- Super admins already see the provider via the role-restricted badge above
- Non-super_admin users should not see any brand names per the anonymization policy
- The "Transcribed" badge already indicates the call has been transcribed

---

## Change Details

### File: `src/components/booking/TranscriptionModal.tsx`

**Remove lines 469-472:**

```tsx
// DELETE THIS ENTIRE BLOCK (lines 469-472)
<Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
  <Radio className="h-3 w-3 mr-1" />
  ElevenLabs
</Badge>
```

---

## Before/After

| User Role | Before | After |
|-----------|--------|-------|
| Agent | Sees "Transcribed" + "ElevenLabs" badges | Sees only "Transcribed" badge |
| Supervisor | Sees "Transcribed" + "ElevenLabs" badges | Sees only "Transcribed" badge |
| Admin | Sees "Transcribed" + "ElevenLabs" badges | Sees only "Transcribed" badge |
| Super Admin | Sees "Transcribed" + "ElevenLabs" + STT Provider badges | Sees "Transcribed" + STT Provider badges |

---

## Impact

- Agents and other non-super_admin users will no longer see any brand names
- Super admins retain visibility into which provider was used (via the existing role-restricted badge)
- Aligns with the established provider anonymization policy
- No functional changes - only visual/informational
