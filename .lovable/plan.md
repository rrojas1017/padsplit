

# Persist Super Admin Sidebar Order in Database

## Problem
The custom sidebar order (drag-and-drop reordering) is stored in browser `localStorage`. This means:
- It resets when the browser cache is cleared or the app reloads fresh
- It doesn't carry across different browsers or devices
- Preview/deployment rebuilds can wipe it

You moved Market Intelligence to the Admin section, but the change was lost because `localStorage` was cleared.

## Solution
Store the sidebar order in the database so it persists permanently and syncs across sessions/devices.

## Changes

### 1. Database Migration -- New `user_preferences` Table

Create a lightweight key-value preferences table tied to each user:

```sql
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, preference_key)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
```

### 2. Update `src/hooks/useSidebarOrder.ts`

- On mount: query `user_preferences` for key `sidebar_custom_order` for the current user
- On save: upsert to `user_preferences` instead of (or in addition to) `localStorage`
- Keep `localStorage` as a fast cache so the sidebar doesn't flash on load -- write to both, but database is the source of truth
- On reset: delete the database row and clear `localStorage`

### 3. Minor Update to `src/components/layout/AppSidebar.tsx`

- Pass the current user ID into `useSidebarOrder` so it can query the database
- No other changes needed -- the hook API (`getOrderedItems`, `moveItem`, `resetOrder`) stays the same

## Files Changed
- 1 new database migration
- `src/hooks/useSidebarOrder.ts` -- persist to database, load from database on mount
- `src/components/layout/AppSidebar.tsx` -- pass user ID to hook
