

# Add Contact Profile Hover Card to My Bookings Page

## Problem
The Contact Profile Hover Card currently only appears on the **Reports** page, which agents cannot access. Agents use the **My Bookings** page to view their bookings, but this page doesn't have the hover card feature, so they can't see contact insights.

## Solution
Add the `ContactProfileHoverCard` component to the **My Bookings** page (`src/pages/MyBookings.tsx`). Agents will be able to hover over the member name to see:
- Budget & timeline information
- Household details  
- Member preferences
- Member concerns
- Contact details (masked for agents)
- Action buttons (Email, SMS, Voice) - disabled unless the agent has `can_send_communications` permission enabled

## What Changes

| Current Behavior | New Behavior |
|-----------------|--------------|
| Member name is plain text on My Bookings | Member name shows hover card with contact profile |
| Agents have no access to contact insights | Agents can see all extracted insights from calls |
| Action buttons only on Reports page | Action buttons on My Bookings (permission-gated) |

## Implementation

**File: `src/pages/MyBookings.tsx`**

1. Import the `ContactProfileHoverCard` component
2. Import the contact privacy utility functions (`shouldMaskContactInfo`)
3. Wrap the member name cell content with `ContactProfileHoverCard`
4. Pass all required props: `memberName`, `callKeyPoints`, `transcriptionStatus`, `contactEmail`, `contactPhone`, `bookingId`, and `shouldMaskContact`

**Code snippet for the member name cell (around line 387):**
```tsx
<td className="py-3 px-4">
  <ContactProfileHoverCard
    memberName={booking.memberName}
    callKeyPoints={booking.callKeyPoints}
    transcriptionStatus={booking.transcriptionStatus}
    contactEmail={booking.contactEmail || undefined}
    contactPhone={booking.contactPhone || undefined}
    bookingId={booking.id}
    shouldMaskContact={shouldMaskContactInfo(user?.role)}
  >
    <div className="flex items-center gap-2 cursor-default">
      <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
        {booking.memberName}
      </span>
      {booking.isRebooking && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary">
          <RotateCcw className="w-3 h-3" />
          Rebooking
        </span>
      )}
    </div>
  </ContactProfileHoverCard>
</td>
```

## Permission Behavior
- **Contact masking**: Contact email and phone will be masked (showing `jas***@gmail.com` and `678-***-1178`) for agents as per existing privacy rules
- **Action buttons**: The Email, SMS, and Voice buttons will be **disabled** for agents who don't have `can_send_communications` permission enabled. A subtle message will appear: "Contact admin for communication access"
- **Insights visibility**: All extracted call insights (budget, timeline, preferences, concerns) will be visible to agents

## Files Changed

| File | Change |
|------|--------|
| `src/pages/MyBookings.tsx` | Add ContactProfileHoverCard wrapper + imports |

## Testing
1. Log in as an agent
2. Navigate to My Bookings
3. Hover over a member name - verify the hover card appears
4. Verify contact details are masked (asterisks)
5. Verify action buttons show as disabled (unless agent has permission)
6. Verify call insights (budget, preferences, concerns) are visible when transcription is completed

