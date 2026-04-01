

## Show Campaign ID in Campaign Manager Cards

### Change
Add the campaign UUID below the campaign name in each card, styled as a small monospace copyable ID (similar to how IDs are shown in other admin UIs).

### File changed (1)

| File | Change |
|---|---|
| `src/pages/research/CampaignManager.tsx` | Add campaign ID display below the script name line in each card header |

### Implementation detail
After the script name line (line 141), add a row showing a truncated campaign ID with a copy-to-clipboard button:
- Display format: `ID: 12fd2184...` (first 8 chars) with a small copy icon
- Clicking copies the full UUID to clipboard with a toast confirmation
- Styled with `font-mono text-[10px] text-muted-foreground` to keep it subtle

