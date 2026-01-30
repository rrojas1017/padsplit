

# Rename "Call Insights" to "Communication Insights"

## Overview

Rename the "Call Insights" section to **"Communication Insights"** to reflect the future multi-channel direction (phone, SMS, email, chat). This is a straightforward text change with no logic modifications.

## Scope

Only updating the **section/page name** - not individual booking "Call Insights" modals which refer to specific call analysis.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Sidebar menu label: "Call Insights" → "Communication Insights" |
| `src/pages/CallInsights.tsx` | Page title, header text, and subtitle |

## Detailed Changes

### 1. AppSidebar.tsx (Line 127)

```text
Before: label: 'Call Insights'
After:  label: 'Communication Insights'
```

### 2. CallInsights.tsx

| Location | Before | After |
|----------|--------|-------|
| Line 60 (DashboardLayout title) | "Call Insights" | "Communication Insights" |
| Line 61 (subtitle) | "AI-powered analysis of call patterns..." | "AI-powered analysis of communication patterns and conversion trends" |
| Line 71 (h1 header) | "Call Insights" | "Communication Insights" |
| Line 74 (description) | "Analyze booking and non-booking call patterns..." | "Analyze booking and non-booking communication patterns to improve conversion" |

## What Stays the Same

- **Route path**: `/call-insights` (no URL change needed)
- **File name**: `CallInsights.tsx` (internal, no user impact)
- **TranscriptionModal title**: "Call Insights - {memberName}" (this refers to individual call analysis)
- **Reports/MyBookings tooltips**: "View Call Insights" (individual booking modals)
- **Icon**: Lightbulb icon remains appropriate for insights

## Visual Result

**Sidebar (After)**:
```
Admin ▼
  ├── Communication Insights  ← Updated
  ├── User Management
  └── ...
```

**Page Header (After)**:
```
💡 Communication Insights
   Analyze booking and non-booking communication patterns to improve conversion
```

