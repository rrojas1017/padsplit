

## Create Campaign Detection Utility

### New file: `src/utils/campaign-detection.ts`

Exports:
- **`CampaignType`** — type alias: `'move_out_survey' | 'audience_survey' | 'unknown'`
- **`detectCampaignType(opts)`** — waterfall detection: script_id → campaign_type → audience → transcript keywords → `'unknown'`
- **`getCampaignLabel(type)`** — returns `"Move-Out Research"` / `"Audience Survey"` / `"Unknown"`
- **`isQualitativeCampaign(type)`** — `true` for `move_out_survey`, `false` otherwise

Single file, no dependencies, pure functions.

