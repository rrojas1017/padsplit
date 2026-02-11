

# Fix: Sidebar Scroll Jump on Admin Item Click

## Root Cause

The current approach restores scroll position in a `useEffect` on `location.pathname`. But when clicking an admin item, **multiple re-renders** occur in sequence:

1. Route changes -- scroll resets to 0, restoration effect queued
2. Restoration effect fires via `requestAnimationFrame` -- scroll restored correctly
3. `isInAdminGroup` becomes true -- `setAdminExpanded(true)` triggers **another re-render**
4. The Collapsible component animates open, content shifts, scroll resets to 0 again
5. No second restoration runs because `location.pathname` didn't change again

## Solution

Instead of saving scroll position via the `onScroll` event (which is fragile), capture it **on click** right before navigation happens, and restore it more robustly.

### File: `src/components/layout/AppSidebar.tsx`

**Change 1**: Add an `onClick` handler to each `NavLink` that snapshots the scroll position immediately before navigation:

```typescript
<NavLink
  to={item.path}
  onClick={() => {
    if (navRef.current) {
      scrollPos.current = navRef.current.scrollTop;
    }
  }}
  ...
>
```

**Change 2**: Remove the `onScroll` handler from the `<nav>` element entirely -- it's the source of the race condition where the reset-to-0 overwrites the saved position.

**Change 3**: Make restoration more resilient by using a short `setTimeout` (e.g. 50ms) after `requestAnimationFrame`, which waits for the Collapsible animation and any cascading state updates to settle:

```typescript
useEffect(() => {
  const nav = navRef.current;
  if (nav) {
    isRestoring.current = true;
    requestAnimationFrame(() => {
      nav.scrollTop = scrollPos.current;
      // Also restore after Collapsible animation settles
      setTimeout(() => {
        if (navRef.current) {
          navRef.current.scrollTop = scrollPos.current;
        }
        isRestoring.current = false;
      }, 80);
    });
  }
}, [location.pathname]);
```

## Why This Works

- Scroll position is captured at the exact moment of click, before any re-renders
- No `onScroll` handler means no risk of the saved position being overwritten by re-render-induced scroll resets
- The delayed second restoration catches any scroll resets caused by the Collapsible component expanding or `adminExpanded` state changes
- The `isRestoring` guard remains to prevent any accidental overwrites

## Files Changed
- `src/components/layout/AppSidebar.tsx` -- modify onClick, remove onScroll, update useEffect restoration logic

## No Impact
- Drag-and-drop, routing, auth, collapse toggle all unchanged
- All user roles behave identically

