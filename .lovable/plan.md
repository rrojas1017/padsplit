
## Root Cause: Published Site Is Out of Date

The interactive wizard code is already correctly implemented in `src/pages/PublicScriptView.tsx` — it has all the phase states, RadioGroups, Sliders, Textareas, Yes/No consent buttons, branching probes, and progress bar.

The problem is that the **published production URL** (`https://padsplit.lovable.app/script/...`) is still running the old flat-text version. When you regenerated the link from the Scripts page, the new URL points to the live site, which has not been republished since the wizard was added.

### What Needs to Happen

The app needs to be republished to push the interactive wizard code to the live URL. No code changes are required — the wizard is already fully built and working in the preview environment.

### Why the Preview Looks Different From Live

- Preview URL (`https://id-preview--...lovable.app`) = always reflects the latest code changes (what you see while building)
- Published URL (`https://padsplit.lovable.app`) = only updates when you explicitly publish/deploy

### Steps to Fix

1. Click the **Publish** button in the Lovable editor (top right area)
2. Wait for the deployment to complete (typically ~1-2 minutes)
3. Revisit the external script link — it will now show the full interactive wizard

No file changes are needed. This is purely a deployment issue.
