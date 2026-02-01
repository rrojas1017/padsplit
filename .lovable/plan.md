
# Fix: Priority Badges Showing All Records as Urgent

## Problem Analysis

All records are showing as **URGENT** because of the "unresolved objections" rule in the priority logic. The issue has two parts:

### Root Cause #1: Objections Are Rarely "Unresolved"
The transcription AI extracts **all objections mentioned** during a call, not just unresolved ones. Looking at the data:
- "No objections were raised; the member was fully prepared" → Still stored as an objection entry
- "The member did not raise any direct objections, but did question..." → Stored as objection

The current logic treats ANY entry in the `objections` array as an urgent follow-up signal, which is incorrect.

### Root Cause #2: Low Threshold (2 days)
The rule `hasObjections && daysSinceContact >= 2` is too aggressive:
- A booking from 2 days ago with ANY objection mentioned = URGENT
- Combined with the fact that most calls have objections noted = Everything is urgent

---

## Solution

### 1. Remove or Demote the "Objections" Rule

The `objections` field captures conversation context, not follow-up signals. The AI's extraction includes resolved objections, clarification questions, and even "no objections raised" notes.

**Change**: Remove objections from URGENT triggers. Move to HIGH priority only when combined with other signals (medium readiness).

### 2. Increase Time Thresholds

Current thresholds are too short for a booking workflow:
| Rule | Current | Proposed |
|------|---------|----------|
| High readiness, no contact | 3+ days | 5+ days |
| Objections trigger | 2+ days | Remove from urgent |
| Move-in approaching | 3 days | 3 days (keep) |

### 3. Add "Resolution Indicator" Check

Only flag objections as requiring follow-up if the transcription explicitly indicates they weren't resolved. This requires checking if the call ended positively (booking completed = objections were addressed).

---

## Implementation

### File: `src/utils/followUpPriority.ts`

**Changes:**

1. **Update URGENT triggers** (remove objections rule from urgent, adjust thresholds):

```typescript
// 🔴 URGENT Priority Logic
// 1. High readiness + no contact in 5+ days (increased from 3)
if (readiness === 'high' && daysSinceContact >= 5) {
  return { 
    level: 'urgent', 
    reason: `High readiness, no contact in ${daysSinceContact} days` 
  };
}

// 2. Pending Move-In with move-in within 3 days and no recent contact (keep as-is)
// ...

// REMOVED: Objections rule from urgent - objections in transcripts are typically addressed
```

2. **Move objections to HIGH priority with stricter conditions**:

```typescript
// 🟠 HIGH Priority Logic
// Only flag objections for Non-Booking status (where they likely weren't resolved)
if (booking.status === 'Non Booking' && hasObjections && daysSinceContact >= 3) {
  return { 
    level: 'high', 
    reason: 'Non-booking with objections to address' 
  };
}
```

3. **Add status-aware logic** - For "Pending Move-In" status, the member booked successfully, so objections were resolved:

```typescript
// For Pending Move-In, objections were resolved (they booked!) - don't use as priority signal
const effectiveHasUnresolvedObjections = booking.status === 'Non Booking' && hasObjections;
```

---

## Updated Priority Logic Table

| Trigger | Level | Condition | Rationale |
|---------|-------|-----------|-----------|
| High readiness + stale | URGENT | `readiness=high` + 5+ days no contact | Hot lead going cold |
| Move-in imminent | URGENT | Pending + ≤3 days to move-in + 1+ day no contact | Confirmation needed |
| High readiness + recent | HIGH | `readiness=high` + 1-4 days no contact | Maintain momentum |
| Non-booking + objections | HIGH | Non-booking status + has objections + 3+ days | Recovery opportunity |
| Non-booking + high readiness | HIGH | Non-booking + `readiness=high` | Recovery opportunity |
| Move-in approaching | HIGH | Pending + 4-7 days to move-in + 2+ days no contact | Planning ahead |
| Medium readiness + concerns | HIGH | `readiness=medium` + has concerns | Nurture lead |
| Medium readiness + stale | MEDIUM | `readiness=medium` + 5+ days no contact | Re-engage |
| Postponed + stale | MEDIUM | Postponed status + 5+ days no contact | Check-in time |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/followUpPriority.ts` | Update priority rules, remove objections from urgent, add status-aware logic |

---

## Expected Result After Fix

For today's records (Jan 30-31 bookings viewed on Feb 1):

| Record | Status | Readiness | Days Since | Expected Priority |
|--------|--------|-----------|------------|-------------------|
| Rashan Baham | Pending Move-In | high | 2 | HIGH (maintain momentum) |
| uvaldo lopez | Pending Move-In | high | 2 | HIGH (maintain momentum) |
| Travis Smalls | Pending Move-In | medium | 2 | LOW (recently contacted) |

Records with "Moved In" / "Cancelled" / "No Show" / "Member Rejected" status will continue to show no badge.
