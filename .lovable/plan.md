

## Remove Alternative Endpoints Section from API Docs

### Change
Remove the "Alternative Endpoints" card (lines 56-64) from `src/pages/ApiDocs.tsx` that shows the legacy `api.padsplit.tools/functions/v1` URL.

### File: `src/pages/ApiDocs.tsx`
Delete the entire `<div className="mt-4 rounded-xl ...">` block containing "Alternative Endpoints" and the Legacy URL entry.

