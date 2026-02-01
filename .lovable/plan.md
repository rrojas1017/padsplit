
# Follow-Up Priority Badges Implementation

## Overview

Add intelligent follow-up priority badges to records in the Reports page and Contact Profile Hover Card. These badges will identify which contacts need immediate attention based on conversation insights, status, and recency of contact.

---

## Priority Logic

### Statuses That Need Follow-Up

| Status | Follow-Up Needed? | Notes |
|--------|------------------|-------|
| Pending Move-In | Yes | Active lead, may need confirmation |
| Postponed | Yes | Re-engage when ready |
| Non Booking | Yes | Recovery opportunity |
| Moved In | No | Completed journey |
| Member Rejected | No | Closed out |
| No Show | No | Closed out |
| Cancelled | No | Closed out |

### Priority Levels

**🔴 URGENT** - Highest priority, needs immediate attention
- High move-in readiness + no recent contact (3+ days)
- Pending Move-In with move-in date within 3 days and no recent contact
- Has unresolved objections that need addressing

**🟠 HIGH** - Should follow up today
- High move-in readiness with recent contact
- Medium readiness + unresolved concerns
- Non-Booking with high readiness (recovery opportunity)

**🟡 MEDIUM** - Follow up this week
- Medium move-in readiness
- Has preferences captured but no recent follow-up

**⚪ LOW / No Badge** - No immediate action needed
- Low readiness, just exploring
- Recently contacted (within 24 hours)
- No call insights available

---

## Implementation Details

### New Utility: `calculateFollowUpPriority`

Create `src/utils/followUpPriority.ts`:

```text
Function: calculateFollowUpPriority(booking, lastContactDate?)

Inputs:
- booking.status
- booking.callKeyPoints?.moveInReadiness
- booking.callKeyPoints?.objections
- booking.callKeyPoints?.memberConcerns
- booking.moveInDate
- lastContactDate (from contact_communications)

Returns:
- { level: 'urgent' | 'high' | 'medium' | 'low' | null, reason: string }

Logic:
1. If status is Moved In / Cancelled / No Show / Member Rejected → null (no badge)
2. If status is Pending Move-In / Postponed / Non Booking:
   - Check move-in date proximity (for Pending)
   - Check readiness level
   - Check objections/concerns count
   - Check last contact date
   - Return appropriate level with reason
```

### Changes to Reports Page Table

Add a "Priority" column after the Status column:

```text
| Record Date | Move-In | Contact | ... | Status | Priority | Method | ... |
```

The Priority cell shows:
- A colored badge (Urgent/High/Medium)
- Tooltip with the reason
- Only for actionable statuses

### Changes to Contact Profile Hover Card

In the header section (next to the Readiness badge), show:
- Follow-up priority badge if applicable
- Reason for priority on hover

---

## Visual Design

### Priority Badges

| Level | Badge Style | Icon |
|-------|-------------|------|
| Urgent | `bg-destructive/20 text-destructive` | AlertTriangle |
| High | `bg-orange-500/20 text-orange-600` | ArrowUp |
| Medium | `bg-amber-500/20 text-amber-600` | Clock |
| Low/None | No badge shown | — |

### Example Badge

```text
<Badge className="bg-destructive/20 text-destructive text-xs">
  <AlertTriangle className="h-3 w-3 mr-1" />
  URGENT
</Badge>
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `src/utils/followUpPriority.ts` | NEW - Priority calculation logic |
| `src/pages/Reports.tsx` | Add Priority column to table |
| `src/components/reports/ContactProfileHoverCard.tsx` | Add priority badge in header |
| `src/components/reports/FollowUpPriorityBadge.tsx` | NEW - Reusable badge component |

---

## Technical Considerations

### Data Requirements

The priority calculation needs:
1. **Booking data** - already available in Reports records
2. **Last contact date** - need to fetch from `contact_communications` table

For efficiency, batch-fetch last contact dates for visible records rather than individual queries per row.

### Performance

- Calculate priority client-side from available data
- Optional: Add server-side precomputation for sorted/filtered views
- Cache last contact dates per booking ID

---

## User Experience

### Reports Page

1. New "Priority" column appears between Status and Method
2. Badges only show for actionable statuses
3. Clicking/hovering shows reason (e.g., "High readiness, no contact in 5 days")
4. Can filter by priority level (future enhancement)

### Hover Card

1. Priority badge appears in header next to readiness
2. Shows at-a-glance which contacts need attention
3. Consistent with table view

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No transcription data | Show "No Insights" - no priority calculated |
| Record just created today | Lower priority (just spoke to them) |
| Moved In status | No priority badge ever |
| Non Booking with low readiness | Low priority or no badge |
| Pending Move-In, move-in tomorrow, no contact | URGENT |
