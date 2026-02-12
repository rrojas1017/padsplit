

# Campaign Manager Implementation Plan

## Overview

Build an admin-facing page (`/research/manage-campaigns`) that allows super_admin and admin users to:
1. **Create new campaigns** by selecting a research script and assigning researchers
2. **Manage campaign lifecycle** (draft → active → paused → completed)
3. **Assign/reassign researchers** to campaigns
4. **Track progress** against target call counts
5. **Edit and delete campaigns**

The Campaign Manager acts as the bridge between Scripts (created in Script Builder) and Call Logging (by Researchers). Once a campaign is active and assigned to a researcher, they can select it in the Log Survey Call form.

---

## Technical Architecture

### Data Flow
```
Admin creates Script
         ↓
Admin creates Campaign
  (selects script + assigns researchers)
         ↓
Campaign stored in research_campaigns table
  with assigned_researchers UUID array
         ↓
Researcher sees campaign in their
  "Active Campaigns" list and
  uses it to log calls
```

### Key Relationships
- **research_campaigns → research_scripts**: Campaign links to one script (foreign key)
- **research_campaigns.assigned_researchers**: Array of researcher user IDs from profiles table
- **RLS Security**: Admins can CRUD all campaigns; researchers can only SELECT campaigns they're assigned to

---

## Part 1: New Hook - `useResearchCampaigns.ts`

**Purpose**: Manage campaign CRUD operations and data fetching

**Operations**:
- `fetchCampaigns()`: Query all campaigns with related script data
- `createCampaign()`: Insert new campaign record
- `updateCampaign()`: Update campaign details (name, status, dates, researchers, targets)
- `deleteCampaign()`: Delete campaign (must check for orphaned calls first)
- Fetch researchers list for multiselect dropdowns (query profiles table for users with 'researcher' role)

**State**:
```typescript
campaigns: ResearchCampaign[]
isLoading: boolean
researchers: ResearcherProfile[]
```

**Error handling**: Toast notifications for failures; prevent deletion if campaign has active calls

---

## Part 2: New Component - `ResearchCampaignDialog.tsx`

**Purpose**: Modal dialog for creating/editing campaigns

**Features**:
- **Script selector**: Dropdown to choose which script this campaign uses (required)
- **Campaign metadata**: Name, description, status, dates
- **Target settings**: target_count (goal number of calls)
- **Researcher assignment**: Multi-select dropdown of available researchers with "researcher" role
  - Shows researcher name + email
  - Allow selecting multiple researchers
  - Display selected researchers as removable badges
- **Date range**: Optional start_date and end_date
- **Status selector**: draft / active / paused / completed
- **Form validation**:
  - Name is required
  - Script must be selected
  - At least one researcher must be assigned
  - End date must be after start date (if both provided)
  - Target count must be > 0
- **Save/Update logic**: Prepare payload with assigned_researchers as UUID array

**UI Pattern**: Match ResearchScriptDialog (same dialog size, field layout, validation feedback)

---

## Part 3: Campaign Manager Page - `src/pages/research/CampaignManager.tsx`

**Replace the stub** with functional dashboard

**Layout**:
1. **Header** with title, subtitle, "New Campaign" button
2. **Filter/Search bar**:
   - Status filter (All / Draft / Active / Paused / Completed)
   - Optional search by campaign name
3. **Campaign cards grid** (similar to Script Builder):
   - Card shows:
     - Campaign name + script name (linked, for context)
     - Status badge (color-coded: blue=draft, green=active, yellow=paused, gray=completed)
     - Progress bar: "X / Y calls completed" (show completed calls from research_calls table)
     - Date range (if set)
     - Target count
     - Number of assigned researchers
     - Action buttons: Edit, Delete, View Details (hover actions)
4. **Empty state**: "No campaigns found" with CTA to create first campaign
5. **Loading skeletons** while fetching

**Details on card interactions**:
- **Edit**: Click edit icon → opens ResearchCampaignDialog with populated data
- **Delete**: Click trash icon → confirmation dialog → delete if no active calls
- **Status management**: Show status selector inline or in edit dialog (quick-toggle or full edit)
- **Progress tracking**: Query research_calls table to count completed calls for this campaign

---

## Part 4: Progress Calculation Logic

**Query pattern** (in hook or utility):
```typescript
// For each campaign, count calls by outcome
const callStats = await supabase
  .from('research_calls')
  .select('call_outcome', { count: 'exact' })
  .eq('campaign_id', campaignId)
  .eq('call_outcome', 'completed');

// Display: "15 / 50 calls completed"
```

This data is **not stored** but **calculated on-the-fly** from research_calls, enabling real-time progress tracking.

---

## Part 5: Researcher Selector Implementation

**Fetch researchers**:
```typescript
// Get all users with 'researcher' role
const researchersData = await supabase
  .from('profiles')
  .select('id, name, email')
  .in('id', (await getResearcherIds())); // filtered by user_roles table
```

**Or simpler**: Query profiles where they have a researcher role (join with user_roles if needed)

**Multi-select UI**:
- Dropdown showing list of researchers (name + email)
- Selected researchers shown as blue badges with × to remove
- Minimum 1 required validation

---

## Part 6: Integration Points

### With Script Builder
- Campaign must reference a valid script_id
- If a script is deleted, campaigns using it should show a warning/be marked as invalid
- Admin can still edit the campaign but cannot select that script again

### With Log Survey Call (Future)
- When a researcher logs in and selects a campaign, the form loads the associated script automatically
- Only "active" campaigns appear in the researcher's campaign dropdown

### With Research Calls Table
- Each call is tagged with campaign_id, enabling attribution
- Enables progress tracking and insights aggregation

---

## Part 7: Database Considerations

**research_campaigns table (already created)**:
- `name`: Campaign title
- `script_id`: FK to research_scripts
- `status`: 'draft' | 'active' | 'paused' | 'completed'
- `target_count`: Goal number of calls (e.g., 50)
- `start_date`, `end_date`: Campaign period
- `assigned_researchers`: UUID array of researcher IDs
- `created_by`: Who created the campaign
- `created_at`, `updated_at`: Timestamps

**RLS is already in place**:
- Admins can manage all campaigns
- Researchers can view only campaigns they're assigned to

---

## Part 8: User Experience Flow

1. **Admin navigates to** `/research/manage-campaigns`
2. **Sees existing campaigns** with progress bars and status badges
3. **Clicks "New Campaign"** → Dialog opens
4. **Selects a script** (e.g., "Q1 Member Satisfaction Survey")
5. **Fills in campaign metadata** (name: "January NPS Check", target: 100 calls)
6. **Selects researchers** (e.g., Sarah, Michael, Jessica)
7. **Sets dates** (Jan 1 - Jan 31)
8. **Saves** → Campaign created, assigned researchers can now see it in their "Active Campaigns"
9. **Can edit later** to adjust target, dates, or researcher assignments
10. **Can delete** (with warning if calls already logged)

---

## Part 9: Implementation Order

1. Create `useResearchCampaigns.ts` hook with all CRUD + data fetching
2. Create `ResearchCampaignDialog.tsx` component
3. Replace `src/pages/research/CampaignManager.tsx` stub with full page
4. Add researcher role validation and filtering
5. Test end-to-end: create campaign → verify researcher can see it in dropdown

---

## Part 10: Technical Details

**TypeScript interfaces** (add to hook or types file):
```typescript
export interface ResearchCampaign {
  id: string;
  name: string;
  script_id: string;
  script_name?: string; // For display
  status: 'draft' | 'active' | 'paused' | 'completed';
  target_count: number;
  start_date: string | null;
  end_date: string | null;
  assigned_researchers: string[]; // UUID array
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_calls?: number; // Calculated, not stored
}

export interface ResearcherProfile {
  id: string;
  name: string | null;
  email: string | null;
}
```

**Key validation rules**:
- Campaign name required and non-empty
- Script selection required
- At least 1 researcher required
- target_count must be > 0
- end_date > start_date (if both provided)
- Cannot delete campaign with active calls (status = 'completed' or show warning)

---

## Summary

The Campaign Manager enables admins to:
- **Organize research efforts** into campaigns with clear goals
- **Assign researchers** to specific initiatives
- **Track progress** in real-time via call counts
- **Manage lifecycle** (draft → active → paused → completed)

This is the prerequisite for researchers being able to log calls, as it links Scripts → Campaigns → Call Logging.

