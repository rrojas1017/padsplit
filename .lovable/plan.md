## Rename Dashboard Sections

### Goal
Update the visible labels for two dashboard sections across the UI.

### Changes
1. **"Coaching Hub" → "Jeff's Hub"**
   - `src/components/layout/AppSidebar.tsx:64` — sidebar navigation label
   - `src/pages/CoachingHub.tsx:162` — page `<title>`
   - `src/pages/AuditLog.tsx:51` — audit log action label

2. **"QA Dashboard" → "Katty's Hub"**
   - `src/components/layout/AppSidebar.tsx:65` — sidebar navigation label
   - `src/pages/QADashboard.tsx:234` — page `<title>` (loading state)
   - `src/pages/QADashboard.tsx:244` — page `<title>`
   - `src/utils/qaDocumentation.ts:264` — documentation text
   - `src/components/ai-management/QARubricSettings.tsx:274` — help text referencing the dashboard

### Technical Notes
- URL paths (`/coaching-hub`, `/qa-dashboard`) remain unchanged.
- No backend or database changes required.
- No component renames required.