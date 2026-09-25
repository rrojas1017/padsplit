# CR-002 — One sidebar organized by business function

## Files

1. **`src/components/layout/AppSidebar.tsx`**
   - Replace the two-group `core | admin` menu with seven fixed group definitions.
   - Render the same shared sidebar for all five roles, including research pages.
   - Preserve collapse, route highlighting, scroll restoration, navigation, branding, and the complete existing footer.

2. **`src/hooks/useSidebarOrder.ts`**
   - Replace the old flat/group-moving order model with v2 per-group ordering.
   - Persist and reset only the new v2 local and user preference keys.

3. **`src/components/layout/ResearchLayout.tsx`**
   - Import and render `AppSidebar` directly.
   - Make no other layout change.

4. **`src/components/layout/ResearchSidebar.tsx`**
   - Delete the now-unused duplicate sidebar after `ResearchLayout` switches to `AppSidebar`.

`SidebarContext.tsx` does not need to change.

## Group and item structure

Define:

```text
type MenuGroupId =
  | 'my_work'
  | 'sales'
  | 'coaching'
  | 'research'
  | 'insights'
  | 'data'
  | 'admin'

MenuGroup = {
  id: MenuGroupId
  label: string
  icon: LucideIcon
  items: MenuItem[]
}

MenuItem = {
  id: `${groupId}:${path}`
  icon: LucideIcon
  label: string
  path: string
  roles: Role[]
}
```

Group order, labels, icons, item order, paths, and role gates will exactly match the ticket:

- `my_work` / **My Work** / Briefcase — 5 agent items.
- `sales` / **Sales** / BarChart3 — 8 super_admin/admin/supervisor items.
- `coaching` / **Coaching & QA** / GraduationCap — 3 super_admin/admin/supervisor items.
- `research` / **Research** / FlaskConical — the four research workflow items for researcher/super_admin/admin, plus Script Builder, Campaign Manager, and Research Insights with their specified roles. “My Dashboard” becomes **Research Dashboard**; its path remains `/research/dashboard`.
- `insights` / **Insights** / Lightbulb — 2 super_admin/admin items.
- `data` / **Data & Communications** / Database — 4 items with the specified role gates.
- `admin` / **Administration** / Wrench — 6 items with the specified role gates.

The old agent Dashboard entry is removed. `/add-booking` and `/tools/move-in-calculator` remain separate definitions in `my_work` and `sales`; their group-qualified IDs prevent React/order collisions. Each group is filtered through the existing `hasRole` behavior and is omitted when it has no visible items. This produces the requested role counts: agent 5/1, researcher 4/1, supervisor 14/5, admin 28/6, super_admin 30/6.

Each visible group uses the current collapsible Admin-group presentation: existing trigger styles, uppercase label, chevron, group icon, and icon-only collapsed mode. No new visual tokens, spacing, or components are introduced.

## Expanded-state resolution

Use localStorage key **`sidebar-group-expanded-v1`** with:

```text
{ [groupId]: boolean }
```

Resolution for every visible group:

1. If that group has a stored boolean, use it.
2. Otherwise use the role default:
   - agent: `my_work` expanded
   - researcher: `research` expanded
   - supervisor/admin: `sales` expanded
   - super_admin: every visible group expanded
   - all other groups collapsed
3. If the current route belongs to a visible group, force that group open and persist `true` in the same map.
4. User toggles update only that group’s entry while preserving the other entries.

The implementation will stop reading and writing `sidebar-admin-expanded`. It will not remove that legacy key.

## v2 ordering and drag/drop

Persist this value:

```text
{
  [groupId]: string[] // item paths in that group’s chosen order
}
```

Use only:

- localStorage: **`sidebar-custom-order-v2`**
- `user_preferences.preference_key`: **`sidebar_custom_order_v2`**

Read path:

1. Start with the validated local v2 value as the temporary fallback.
2. For a signed-in user, query the v2 database preference as the source of truth.
3. If the database contains a valid v2 map, apply it and refresh the local v2 cache.
4. If no database row exists, retain the valid local v2 value and write that fallback to the v2 database preference.
5. Never inspect or migrate either legacy key.

Ordering resolution is independent per group: known saved paths are applied once in saved order, unknown paths are ignored, and visible items missing from the saved list append in their declared default order.

Drag/drop remains super_admin-only and expanded-sidebar-only. A drag can reorder an item only inside its originating group; a target from another group is ignored. Group order is never draggable. Saving writes the affected per-group path array to the v2 map locally and to the v2 database preference.

“Reset to default” appears under the same existing condition, removes only `sidebar-custom-order-v2`, clears the in-memory v2 order, and deletes only the `sidebar_custom_order_v2` preference row. It never reads, writes, migrates, or deletes `sidebar-custom-order` or `sidebar_custom_order`.

## Shared research layout and unchanged behavior

`ResearchLayout` will render `AppSidebar`; its header, content, margins, and all other behavior remain unchanged. The shared footer continues using the existing `roleLabel[user.role]`, so it shows the real effective role and retains the user card, Change password, Logout, and “Powered by Appendify LLC” for every role.

No changes will be made to routes, `App.tsx`, protected access, headers, page tracking, audit action names, database schema/policies, migrations, edge functions, dependencies, or any file outside the four listed above. Nothing will be published.

## Verification after approval

- Run `tsgo --noEmit -p tsconfig.app.json`.
- Check the preview for the role-specific visible groups/counts, route auto-expansion, collapse mode, within-group drag rejection across groups, v2 persistence/reset, and research pages using the shared footer/sidebar.
