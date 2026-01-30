

# Move Call Insights to Admin Section

## Summary

Move the "Call Insights" menu item from the main navigation area to the collapsible Admin section in the sidebar, and restrict access to super_admin and admin roles only (removing supervisor access).

## Current Configuration

```typescript
{
  icon: Lightbulb,
  label: 'Call Insights',
  path: '/call-insights',
  roles: ['super_admin', 'admin', 'supervisor'],
  group: 'core'
}
```

## New Configuration

```typescript
{
  icon: Lightbulb,
  label: 'Call Insights',
  path: '/call-insights',
  roles: ['super_admin', 'admin'],
  group: 'admin'
}
```

## Changes

| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Update Call Insights menu item: change `group` from `'core'` to `'admin'`, remove `'supervisor'` from roles |

## Result

- Call Insights will appear under the collapsible "Admin" section
- Only super_admin and admin users will see and access the page
- Supervisors will no longer have access to Call Insights

