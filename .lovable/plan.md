

# Fix: Sidebar Scroll Position Resets on Navigation

## Problem
When clicking any sidebar option, the sidebar scrolls back to the top. This happens because the route change causes a React re-render, and the `<nav>` element with `overflow-y-auto` loses its scroll position.

## Solution
Add a `ref` to the `<nav>` element and preserve its scroll position across re-renders using a simple ref-based approach.

## Technical Details

### File: `src/components/layout/AppSidebar.tsx`

1. Add a `useRef` for the nav element:
   ```typescript
   const navRef = useRef<HTMLDivElement>(null);
   ```

2. Save and restore scroll position around route changes using a `useEffect` on `location.pathname`:
   ```typescript
   const scrollPos = useRef(0);
   
   // Save scroll position before re-render
   useEffect(() => {
     const nav = navRef.current;
     if (nav) {
       // Restore after route change re-render
       requestAnimationFrame(() => {
         nav.scrollTop = scrollPos.current;
       });
     }
   }, [location.pathname]);
   ```

3. Attach an `onScroll` handler to the `<nav>` to continuously track scroll position:
   ```typescript
   <nav 
     ref={navRef}
     onScroll={() => {
       if (navRef.current) {
         scrollPos.current = navRef.current.scrollTop;
       }
     }}
     className="flex-1 p-3 space-y-1 overflow-y-auto"
   >
   ```

### Why This Works
- The `onScroll` handler saves the current scroll position to a ref (not state, so no re-renders)
- After a route change triggers a re-render, `requestAnimationFrame` restores the saved position once the DOM has updated
- Zero visual flicker since restoration happens in the next animation frame

### Files Changed
- `src/components/layout/AppSidebar.tsx` -- Add navRef, scrollPos ref, onScroll handler, and restoration useEffect (~10 lines added)

### No Impact
- No changes to routing, auth, drag-and-drop, or any other sidebar behavior
- Works identically for all user roles
