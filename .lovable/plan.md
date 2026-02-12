

# PadSplit Research Agent Module

## Overview

A standalone module for Research Agents -- a new user role with its own simplified UI, dedicated to conducting structured phone interviews with existing members, former bookings, and rejected leads. Admins build questionnaire scripts; researchers log calls and outcomes; the AI pipeline processes recordings into actionable insights; a dedicated Research Insights dashboard surfaces findings with a summary widget on Market Intelligence.

**Zero impact on existing booking agent flows** -- this is an additive module with its own routes, sidebar, and data tables.

---

## Architecture

```text
+------------------+     +-------------------+     +--------------------+
|  Admin/SuperAdmin |     |  Researcher UI    |     |  AI Pipeline       |
|                  |     |                   |     |                    |
| Script Builder   |---->| My Campaigns      |     | transcribe-call    |
| Campaign Manager |---->| Log Survey Call   |---->| (existing)         |
| Research Insights|<----| My Performance    |     |        |           |
|                  |     |                   |     |        v           |
| Market Intel     |     +-------------------+     | analyze-research   |
| (summary widget) |                               | (new edge fn)      |
+------------------+                               +--------------------+
                                                          |
                                                          v
                                                   +--------------------+
                                                   | research_insights  |
                                                   | (DB table)         |
                                                   +--------------------+
```

---

## Part 1: New "researcher" Role

**Database changes:**
- Add `'researcher'` to the `app_role` enum
- No changes to `profiles` or `user_roles` table structure

**Frontend changes:**
- Add `'researcher'` to the `UserRole` type in `src/types/index.ts`
- Update `AuthContext` role label map to include `researcher: 'Researcher'`
- Update `ProtectedRoute` to redirect researchers to `/research/dashboard` by default
- Create a dedicated `ResearchSidebar` component (simpler than `AppSidebar`) with only research-relevant links
- Create a `ResearchLayout` wrapper (similar to `DashboardLayout`) that uses `ResearchSidebar`

**Researcher sidebar items:**
- My Dashboard (performance stats)
- Active Campaigns (assigned questionnaires)
- Log Survey Call (entry form)
- My Call History (past survey calls)

**Admin sidebar:**
- Add "Research" section under Admin group with:
  - Script Builder (questionnaire creation)
  - Campaign Manager (assign scripts to researchers)
  - Research Insights (AI-processed findings)

---

## Part 2: Script Builder (Admin Tool)

**Purpose:** Admins create structured questionnaires that guide researchers during calls.

**New database table: `research_scripts`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | e.g., "Member Satisfaction Survey Q1" |
| description | text | Purpose of the script |
| campaign_type | text | 'satisfaction' / 'market_research' / 'retention' |
| target_audience | text | 'existing_member' / 'former_booking' / 'rejected' |
| questions | jsonb | Array of structured question objects |
| is_active | boolean | |
| created_by | uuid FK | |
| created_at / updated_at | timestamptz | |

**Question structure (JSONB):**
```text
{
  "order": 1,
  "question": "On a scale of 1-10, how likely are you to recommend PadSplit?",
  "type": "scale" | "open_ended" | "multiple_choice" | "yes_no",
  "options": ["Very Satisfied", "Satisfied", ...],  // for multiple_choice
  "required": true,
  "ai_extraction_hint": "nps_score"  // tells AI what to extract
}
```

**UI: Script Builder page (`/research/scripts`)**
- Card-based list of existing scripts with campaign type badges
- Create/Edit dialog with:
  - Name, description, campaign type, target audience selectors
  - Drag-and-drop question builder (add/reorder/delete questions)
  - Question type selector (scale, open-ended, multiple choice, yes/no)
  - Preview mode showing the script as the researcher would see it
  - AI extraction hints (optional, for advanced users)

---

## Part 3: Campaign Manager

**New database table: `research_campaigns`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | e.g., "Q1 2026 NPS Survey" |
| script_id | uuid FK | Links to research_scripts |
| status | text | 'draft' / 'active' / 'completed' / 'paused' |
| target_count | int | Goal number of calls |
| start_date / end_date | date | |
| assigned_researchers | uuid[] | Array of researcher user IDs |
| created_by | uuid FK | |
| created_at / updated_at | timestamptz | |

**UI: Campaign Manager page (`/research/campaigns`)**
- Campaign cards showing progress (calls made / target)
- Create campaign: select script, assign researchers, set targets/dates
- Status management (activate, pause, complete)

---

## Part 4: Survey Call Logging (Researcher UI)

**New database table: `research_calls`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| campaign_id | uuid FK | |
| researcher_id | uuid FK | profiles.id |
| caller_type | text | 'existing_member' / 'former_booking' / 'rejected' |
| caller_name | text | |
| caller_phone | text | |
| caller_status | text | Original booking status if applicable |
| original_booking_id | uuid FK (nullable) | Link to bookings table |
| call_date | date | |
| call_duration_seconds | int | |
| call_outcome | text | 'completed' / 'no_answer' / 'refused' / 'callback_requested' / 'transferred' |
| transferred_to_agent_id | uuid FK (nullable) | For transfer tracking |
| transfer_notes | text | |
| responses | jsonb | Structured answers keyed by question order |
| researcher_notes | text | Free-form notes |
| kixie_link | text | Call recording URL |
| transcription_status | text | Same pattern as bookings |
| call_transcription | text | |
| call_summary | text | |
| ai_analysis | jsonb | AI-extracted insights |
| created_at | timestamptz | |

**UI: Log Survey Call page (`/research/log-call`)**
- Campaign selector (only active campaigns assigned to this researcher)
- Loads the associated script as a guided form
- Caller info fields (name, phone, type)
- Script questions rendered dynamically by type:
  - Scale: slider or number input
  - Open-ended: text area
  - Multiple choice: radio/checkbox group
  - Yes/No: toggle
- Call outcome selector
- Transfer option: if selected, shows agent picker and transfer notes
- Kixie link field for recording
- Submit logs the call and triggers auto-transcription if link provided

---

## Part 5: Transfer Tracking

When a researcher selects "Transferred" as the call outcome:
- They select the target booking agent from a dropdown
- Add optional transfer notes
- The system logs this in `research_calls.transferred_to_agent_id`
- A `research_transfers` view (or query) joins `research_calls` with `bookings` created by the target agent within 24 hours of the transfer, enabling attribution reporting

**Performance metrics for researchers:**
- Calls completed per day/week
- Completion rate (completed vs total attempts)
- Transfer rate and transfer success rate
- Campaign progress (% of target reached)
- Average call duration

---

## Part 6: AI Analysis Pipeline

**New edge function: `analyze-research-calls`**
- Triggered after transcription completes (same pattern as booking analysis)
- Uses the script's `ai_extraction_hint` fields to guide extraction
- Produces structured output per call:
  - NPS score (if applicable)
  - Sentiment (positive/neutral/negative)
  - Key themes/concerns extracted
  - Competitor mentions
  - Feature requests
  - Churn risk indicators (for retention calls)
  - Verbatim quotes worth highlighting

**New edge function: `aggregate-research-insights`**
- Processes all completed research calls for a campaign
- Groups findings by caller_type and campaign_type
- Produces aggregated insights:
  - Average NPS by segment
  - Top concerns/themes ranked by frequency
  - Sentiment distribution
  - Competitor landscape
  - Actionable recommendations
- Stores results in a `research_insights` table (cached, similar to `market_intelligence_cache`)

---

## Part 7: Research Insights Dashboard

**UI: Research Insights page (`/research/insights`) -- Admin/SuperAdmin only**

**Layout:**
- Campaign selector at top
- Summary KPI cards:
  - Total Calls | Completion Rate | Avg NPS | Sentiment Score
- Tabs by caller type:
  - "Existing Members" | "Former Bookings" | "Rejected Leads"

**Each tab shows:**
- Sentiment distribution chart (pie/bar)
- Top concerns/themes (ranked list with frequency bars)
- NPS trend over time (line chart, for satisfaction campaigns)
- Competitor mentions (word cloud or frequency table)
- Feature requests (categorized list)
- Key verbatim quotes panel
- AI-generated recommendations panel

---

## Part 8: Market Intelligence Integration

**Add a "Research Summary" widget to the existing Market Intelligence page:**
- A collapsible card below the State Heat Table
- Shows latest research campaign results at a glance:
  - Active campaigns count
  - Latest NPS score
  - Top 3 concerns from research
  - Link to full Research Insights page
- Only visible to admin/super_admin
- Does not modify any existing Market Intelligence logic

---

## Part 9: Routing and Navigation

**New routes (all protected):**
| Route | Role | Component |
|-------|------|-----------|
| `/research/dashboard` | researcher | ResearchDashboard |
| `/research/campaigns` | researcher | MyCampaigns |
| `/research/log-call` | researcher | LogSurveyCall |
| `/research/history` | researcher | MyCallHistory |
| `/research/scripts` | super_admin, admin | ScriptBuilder |
| `/research/manage-campaigns` | super_admin, admin | CampaignManager |
| `/research/insights` | super_admin, admin | ResearchInsights |

**Researcher login redirect:** Researchers land on `/research/dashboard` after login (handled in `ProtectedRoute`).

---

## Part 10: Database Security

**RLS policies for all new tables:**
- `research_scripts`: admin/super_admin can CRUD; researchers can SELECT active scripts for their assigned campaigns
- `research_campaigns`: admin/super_admin can CRUD; researchers can SELECT campaigns they're assigned to
- `research_calls`: researchers can INSERT/SELECT their own calls; admin/super_admin can SELECT all
- `research_insights`: admin/super_admin can SELECT; researchers have no access

---

## Implementation Sequence

1. **Database first**: Add researcher to enum, create tables (research_scripts, research_campaigns, research_calls, research_insights), RLS policies
2. **Role and auth**: Update TypeScript types, AuthContext, ProtectedRoute redirects
3. **Research layout**: Create ResearchSidebar + ResearchLayout components
4. **Script Builder**: Admin page for creating questionnaires
5. **Campaign Manager**: Admin page for managing campaigns and assigning researchers
6. **Survey Call Form**: Researcher's guided call logging form
7. **Researcher Dashboard**: Performance stats for the researcher
8. **AI Pipeline**: analyze-research-calls and aggregate-research-insights edge functions
9. **Research Insights Dashboard**: Admin analytics page
10. **Market Intelligence widget**: Summary card on existing page

Each step is independently testable and can be built incrementally without affecting existing booking agent functionality.

