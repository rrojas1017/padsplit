

# Contact Profile Hover Card - Focus on Contact's Perspective

## Overview

Redesign the hover card to prioritize **contact-centric information** that helps with follow-up communication. Remove the call summary (which describes how the conversation went) and instead show what matters from the contact's perspective.

## Current vs. Proposed Layout

| Current (Call-Focused) | Proposed (Contact-Focused) |
|------------------------|---------------------------|
| Call Summary (how the call went) | Contact's Needs & Preferences |
| Key Follow-up Points (3 items) | Budget & Timeline (structured) |
| Sentiment & Readiness | Concerns to Address |
| Contact Info + Buttons | Household Details |
|  | Contact Info + Buttons |

## New Card Structure

```text
┌─────────────────────────────────────────────────────────────┐
│ 👤 Jason Sorensen                              🎯 HIGH       │
│ ────────────────────────────────────────────────────────────│
│                                                             │
│ 💰 BUDGET & TIMELINE                                        │
│ $149/week  ·  Move: Thu, Feb 6  ·  3 months                │
│                                                             │
│ 🏠 HOUSEHOLD                                                │
│ 2 people  ·  Cash payment preferred                        │
│                                                             │
│ ✨ LOOKING FOR                                              │
│ • Private room, ground floor access                        │
│ • No moving fee                                             │
│                                                             │
│ ⚠️ CONCERNS                                                 │
│ • Background check process                                  │
│ • Security deposit amount                                   │
│                                                             │
│ ────────────────────────────────────────────────────────────│
│ 📧 jason@email.com  ·  📱 678-463-1178                      │
│                                                             │
│ ┌──────────────┐   ┌──────────────┐                        │
│ │  📧 Email    │   │  📱 SMS      │                        │
│ └──────────────┘   └──────────────┘                        │
│                                                             │
│ 📬 Last Contacted: Jan 28 via SMS                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Changes

| Section | What Changes |
|---------|--------------|
| **Header** | Keep name + readiness badge. Remove sentiment icon (call-focused) |
| **Remove** | "Quick Summary" section entirely |
| **Add** | "Budget & Timeline" - structured row with budget, move-in date, commitment |
| **Add** | "Household" - household size, payment method preference |
| **Rename** | "Key Follow-up" → "Looking For" - show member preferences |
| **Add** | "Concerns" section - show member concerns to address |
| **Keep** | Contact info section with Email/SMS buttons |
| **Keep** | Last Contacted timestamp |

## File to Modify

| File | Changes |
|------|---------|
| `src/components/reports/ContactProfileHoverCard.tsx` | Restructure content sections |

---

## Technical Details

### Remove Call Summary Section

Delete lines 198-207 that show the "Quick Summary" paragraph describing how the call went.

### Replace with Contact-Centric Sections

**1. Budget & Timeline Row**
```typescript
// Display budget, move-in date, commitment in a single row
const memberDetails = callKeyPoints.memberDetails;
<div className="flex flex-wrap gap-2 text-xs">
  {memberDetails?.weeklyBudget && (
    <span className="font-medium">${memberDetails.weeklyBudget}/wk</span>
  )}
  {memberDetails?.moveInDate && (
    <span>Move: {memberDetails.moveInDate}</span>
  )}
  {memberDetails?.commitmentWeeks && (
    <span>{formatCommitment(memberDetails.commitmentWeeks)}</span>
  )}
</div>
```

**2. Household Details**
```typescript
// Household size and payment preference
<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
  {memberDetails?.householdSize && (
    <span>{memberDetails.householdSize} {memberDetails.householdSize === 1 ? 'person' : 'people'}</span>
  )}
  {memberDetails?.preferredPaymentMethod && (
    <span>{memberDetails.preferredPaymentMethod} preferred</span>
  )}
</div>
```

**3. Looking For (Preferences)**
```typescript
// Show top 2-3 preferences
{callKeyPoints.memberPreferences?.slice(0, 3).map((pref, i) => (
  <li key={i} className="text-xs flex items-start gap-2">
    <span className="text-primary">•</span>
    <span className="line-clamp-1">{pref}</span>
  </li>
))}
```

**4. Concerns Section**
```typescript
// Show top 2 concerns
{callKeyPoints.memberConcerns?.slice(0, 2).map((concern, i) => (
  <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
    <span>•</span>
    <span className="line-clamp-1">{concern}</span>
  </li>
))}
```

### Simplify Header

Remove the `SentimentIcon` component from the header (it's call-focused). Keep only the readiness badge which indicates how ready the contact is to move forward.

### Remove Unused Props

The `callSummary` prop will no longer be used in the display, but keep it in the interface for backward compatibility.

---

## Data Mapping

All data comes from `callKeyPoints`:

| UI Section | Data Source |
|------------|-------------|
| Budget | `callKeyPoints.memberDetails.weeklyBudget` |
| Move-in | `callKeyPoints.memberDetails.moveInDate` |
| Commitment | `callKeyPoints.memberDetails.commitmentWeeks` |
| Household | `callKeyPoints.memberDetails.householdSize` |
| Payment | `callKeyPoints.memberDetails.preferredPaymentMethod` |
| Looking For | `callKeyPoints.memberPreferences[]` |
| Concerns | `callKeyPoints.memberConcerns[]` |
| Readiness | `callKeyPoints.moveInReadiness` |

---

## Empty State Handling

If no insights exist but contact info is available, show:
- Contact email/phone
- Email/SMS buttons
- Message: "Add call insights for richer context"

If insights exist but sections are empty:
- Hide empty sections (e.g., if no concerns, don't show "Concerns" header)
- Always show what's available

