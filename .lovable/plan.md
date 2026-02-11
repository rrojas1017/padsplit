

# Fix: Sidebar Scroll Position Race Condition

## Root Cause
When clicking a sidebar link:
1. Route changes, React re-renders
2. The `<nav>` element's scroll resets to 0 during re-render
3. The `onScroll` handler fires, overwriting `scrollPos.current` with 0
4. The restoration `useEffect` runs, but reads `scrollPos.current` which is now 0
5. Result: sidebar stays at top

## Solution
Add a guard flag that prevents the `onScroll` handler from overwriting the saved position during the brief window after a route change.

### File: `src/components/layout/AppSidebar.tsx`

1. Add a `isRestoring` ref initialized to `false`
2. In the route-change `useEffect`, set `isRestoring.current = true` before restoring, then set it back to `false` after restoration completes
3. In the `onScroll` handler, skip saving when `isRestoring.current` is `true`

```typescript
const isRestoring = useRef(false);

// Restore scroll after route change
useEffect(() => {
  const nav = navRef.current;
  if (nav) {
    isRestoring.current = true;
    requestAnimationFrame(() => {
      nav.scrollTop = scrollPos.current;
      // Allow onScroll to save again after restoration settles
      requestAnimationFrame(() => {
        isRestoring.current = false;
      });
    });
  }
}, [location.pathname]);

// onScroll handler (guarded)
onScroll={() => {
  if (navRef.current && !isRestoring.current) {
    scrollPos.current = navRef.current.scrollTop;
  }
}}
```

### Why This Works
- The `isRestoring` flag blocks the `onScroll` handler from saving the spurious "0" position during re-render
- Double `requestAnimationFrame` ensures the flag stays active through the full restoration cycle (set scroll + browser reflow)
- After restoration completes, normal scroll tracking resumes

### No Impact
- Same approach, just adds a 1-line guard -- no changes to drag-and-drop, routing, or any other behavior

