

## Add Affordability Gap Analysis to Market Intelligence

### What This Solves

Right now, the "Avg Budget" column in Market Intelligence only shows what callers said they could afford. There's no data on what rooms actually cost in each market, so the red/green color coding just compares each market against the system-wide average budget -- which isn't very meaningful.

This change adds a second data point: the **quoted room price** (what the agent actually quoted during the call). With both numbers, we can show a real **affordability gap** per market: are rooms priced above or below what callers can afford?

### How It Works

1. The AI already analyzes each call transcription. We add a new numeric field `quotedRoomPrice` to the analysis output, extracted from the pricing discussion details (e.g., "$185/week" becomes 185).
2. The Market Intelligence backend aggregates both `avgWeeklyBudget` (customer side) and `avgQuotedPrice` (market side) per state and city.
3. The UI shows both numbers plus an affordability gap indicator.

### What You'll See

- **State Heat Table**: New "Avg Quoted" column alongside "Avg Budget", plus a color-coded "Gap" column
  - Green: Market is affordable (budget >= quoted price)
  - Red: Affordability gap (budget < quoted price, showing the dollar difference)
- **Top 10 Markets cards**: Both budget and quoted price shown, with gap indicator
- **City drill-down**: Same dual metrics with gap
- **Summary cards**: New "Avg Affordability Gap" card at the top level

### Technical Details

**1. Update AI prompt** (`supabase/functions/transcribe-call/index.ts`)
- Add `quotedRoomPrice` numeric field to the `pricingDiscussed` object in the JSON schema
- Instruction: extract the weekly room rate quoted by the agent as a number (null if not quoted)
- Updated structure:
  ```
  pricingDiscussed: {
    mentioned: boolean,
    details: string,
    agentInitiated: boolean,
    quotedRoomPrice: number | null  // NEW - weekly rate in dollars
  }
  ```

**2. Update TypeScript types** (`src/types/index.ts`)
- Add `quotedRoomPrice?: number | null` to the `pricingDiscussed` type in `CallKeyPoints`

**3. Update backend aggregation** (`supabase/functions/aggregate-market-data/index.ts`)
- Add `totalQuotedPrice` and `quotedPriceCount` accumulators to both state and city aggregation
- Extract `kp.pricingDiscussed?.quotedRoomPrice` from transcription data
- Output new fields: `avgQuotedPrice` and `affordabilityGap` (avgBudget - avgQuotedPrice) per market

**4. Update Market Intelligence hook** (`src/hooks/useMarketIntelligence.ts`)
- Add `avgQuotedPrice` and `affordabilityGap` to `MarketStateData` and `MarketCityData` interfaces
- Compute `systemAvgQuotedPrice` alongside `systemAvgBudget`

**5. Update UI components**
- `StateHeatTable.tsx`: Add "Avg Quoted" and "Gap" columns
- `MarketComparisonCards.tsx`: Show both budget and quoted price with gap indicator
- `CityDrillDown.tsx`: Show quoted price and gap alongside budget
- `MarketIntelligence.tsx`: Add "Avg Quoted Price" and "Avg Affordability Gap" summary cards

**6. Deploy edge functions**
- Redeploy `transcribe-call` and `aggregate-market-data`

### Data Notes
- Only newly transcribed calls will have `quotedRoomPrice` (existing records won't until reanalyzed)
- Markets where no pricing was quoted will show "—" for quoted price and gap
- The gap is calculated as: `avgBudget - avgQuotedPrice` (positive = affordable, negative = gap)

