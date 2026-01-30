
# Broadcast Messaging System for Agents

## Overview

Create a dynamic broadcast messaging system that allows supervisors and admins to send rolling announcements to agents. These messages will appear in a marquee-style banner on agent pages.

## Feature Components

### 1. Database Table: `broadcast_messages`

Stores all broadcast messages with scheduling and targeting capabilities.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| message | text | The broadcast message content |
| created_by | uuid | User who created the message (FK to profiles) |
| created_at | timestamp | When the message was created |
| expires_at | timestamp | When the message should stop showing (nullable for permanent) |
| is_active | boolean | Whether the message is currently active |
| priority | integer | Display order priority (higher = first) |
| site_id | uuid | Optional site targeting (nullable = all sites) |
| target_role | text | Target audience: 'all' or 'agent' |

### 2. RLS Policies

- **SELECT**: Agents can read active, non-expired messages for their site (or all-sites messages)
- **INSERT/UPDATE/DELETE**: Only supervisor, admin, super_admin roles

### 3. Frontend Components

#### A. Reusable `BroadcastBanner` Component

A new component that fetches and displays active broadcast messages in the marquee style.

**Location**: `src/components/broadcast/BroadcastBanner.tsx`

**Features**:
- Fetches active messages from `broadcast_messages` table
- Displays messages in the existing marquee animation style
- Handles empty state gracefully (no banner shown)
- Real-time subscription for new messages
- Respects site filtering for agents

#### B. Agent Pages Integration

Add `<BroadcastBanner />` to agent-facing pages:
- `src/pages/MyQA.tsx`
- `src/pages/MyPerformance.tsx`
- `src/pages/MyBookings.tsx`

#### C. Broadcast Management UI

Add a management section accessible to supervisors and admins.

**Location**: New tab in Settings page OR standalone page in Admin section

**Features**:
- View all active/inactive broadcasts
- Create new broadcast with:
  - Message content
  - Optional expiration date
  - Site targeting (supervisor limited to their site)
  - Priority ordering
- Edit existing broadcasts
- Deactivate/delete broadcasts

---

## Implementation Details

### Database Migration

```sql
-- Create broadcast_messages table
CREATE TABLE public.broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  target_role text DEFAULT 'agent' CHECK (target_role IN ('all', 'agent'))
);

-- Enable RLS
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Agents can read active messages targeting them
CREATE POLICY "Agents can read active broadcasts"
  ON public.broadcast_messages FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      site_id IS NULL 
      OR site_id = public.get_my_site_id()
    )
    AND (target_role = 'all' OR target_role = 'agent')
  );

-- Supervisors+ can manage broadcasts
CREATE POLICY "Supervisors can manage broadcasts"
  ON public.broadcast_messages FOR ALL
  TO authenticated
  USING (
    public.get_my_role() IN ('super_admin', 'admin', 'supervisor')
  )
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'admin', 'supervisor')
  );

-- Enable realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_messages;
```

### Component: BroadcastBanner.tsx

```text
+-----------------------------------------------------------------------------------+
| 📢 [Message 1]  •  [Message 2]  •  [Message 3]  •  (repeating marquee)            |
+-----------------------------------------------------------------------------------+
```

**Key Features**:
- Uses existing `animate-marquee` animation
- Pink/purple gradient (matching QA style) or accent gradient
- Pauses on hover
- Shows nothing if no active messages

### Component: BroadcastManagement.tsx

```text
+-----------------------------------------------------------------------------------+
| Broadcast Messages                                          [+ New Broadcast]    |
+-----------------------------------------------------------------------------------+
| Status | Message                                | Expires    | Site    | Actions |
|--------|----------------------------------------|------------|---------|---------|
| 🟢     | Welcome to January! Stay focused...   | Feb 1      | All     | Edit 🗑️ |
| 🟢     | Reminder: QA scores due by EOD        | Today 5pm  | Vixicom | Edit 🗑️ |
| 🔴     | Holiday schedule posted               | Expired    | All     | 🗑️      |
+-----------------------------------------------------------------------------------+
```

### Hook: useBroadcastMessages.ts

**Location**: `src/hooks/useBroadcastMessages.ts`

**Features**:
- Fetch active broadcasts for display
- Real-time subscription for live updates
- CRUD operations for management
- Site-scoped filtering for supervisors

---

## Access Control

| Role | View Broadcasts | Create | Edit | Delete |
|------|-----------------|--------|------|--------|
| Agent | ✅ (their site) | ❌ | ❌ | ❌ |
| Supervisor | ✅ (their site) | ✅ (their site only) | ✅ (their site) | ✅ (their site) |
| Admin | ✅ (all) | ✅ (all sites) | ✅ (all) | ✅ (all) |
| Super Admin | ✅ (all) | ✅ (all sites) | ✅ (all) | ✅ (all) |

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/broadcast/BroadcastBanner.tsx` | Reusable marquee banner component |
| `src/components/broadcast/BroadcastManagement.tsx` | Admin UI for managing broadcasts |
| `src/components/broadcast/BroadcastDialog.tsx` | Create/edit broadcast dialog |
| `src/hooks/useBroadcastMessages.ts` | Data fetching and real-time subscription |
| `src/pages/BroadcastMessages.tsx` | Admin page for broadcast management |

### Modified Files
| File | Change |
|------|--------|
| `src/pages/MyQA.tsx` | Add `<BroadcastBanner />` at top |
| `src/pages/MyPerformance.tsx` | Add `<BroadcastBanner />` at top |
| `src/pages/MyBookings.tsx` | Add `<BroadcastBanner />` at top |
| `src/components/layout/AppSidebar.tsx` | Add "Broadcasts" menu item for supervisors+ |
| `src/App.tsx` | Add route for `/broadcasts` |

---

## User Experience

**For Agents**:
- See rolling announcements on their dashboard pages
- Messages update in real-time when supervisors post new ones
- Banner only shows when there are active messages

**For Supervisors/Admins**:
- New "Broadcasts" item in admin section of sidebar
- Simple form to create announcements
- Can set expiration dates and target specific sites
- See message history and manage active broadcasts

---

## Summary

This feature creates a complete broadcast messaging system that:
1. Shows rolling announcements to agents on their key pages
2. Allows supervisors to manage broadcasts for their site
3. Allows admins to manage broadcasts for all sites
4. Uses real-time updates for instant message delivery
5. Follows existing design patterns (marquee animation, role-based access)
