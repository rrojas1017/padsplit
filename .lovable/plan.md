

## Fix: Unknown States and Dirty Market Data

### Problems Found
1. **2,104 bookings (35%) have NULL `market_state`** but many have recognizable cities (Atlanta=40, Jacksonville=31, Baltimore=19, Las Vegas=17, Phoenix=17, etc.) that should map to known states
2. **State abbreviations display as title-case** ("Tx", "Fl", "Ga") instead of proper uppercase ("TX", "FL", "GA") because the `normalizeName` function lowercases then title-cases everything
3. **Junk state values** like "None", "Null", "Cl" (should be CO), "Ka" (should be KS), "Pe", "Vg", "Vi", "Mb" pollute the table
4. **Multi-state entries** like "Ga, Fl", "De / Md", "Md / Dc" create extra rows
5. **Full state names** ("Georgia", "Maryland") not merged with their abbreviations

### Solution (Two Parts)

#### Part 1: Database Cleanup (SQL migration)
Run a SQL update to fix existing data in the `bookings` table:

- **Uppercase all state abbreviations** (e.g., "Tx" to "TX", "Fl" to "FL")
- **Map known cities to states** for the 2,104 NULL-state records (e.g., Atlanta to GA, Jacksonville to FL, Las Vegas to NV, Phoenix to AZ, etc.)
- **Fix junk values**: "None"/"Null" to NULL, "Cl" to "CO", "Ka" to "KS"
- **Normalize full names**: "Georgia" to "GA", "Maryland" to "MD"
- **Handle multi-state**: Take the first state from entries like "Ga, Fl" (becomes "GA")

This covers the ~30 most common city-to-state mappings which will resolve the vast majority of NULL-state records.

#### Part 2: Edge Function Update
Modify `supabase/functions/aggregate-market-data/index.ts`:

- Add a **`normalizeState` function** that uppercases state abbreviations, maps full names to abbreviations, and filters out junk values
- Keep the existing `normalizeName` function for cities (title case is correct for city names)
- Apply `normalizeState` instead of `normalizeName` for the state field during aggregation

### Technical Details

**SQL Migration** (data cleanup):
```sql
-- Fix case: uppercase all state abbreviations
UPDATE bookings SET market_state = UPPER(TRIM(market_state))
WHERE market_state IS NOT NULL AND TRIM(market_state) != '';

-- Fix junk values
UPDATE bookings SET market_state = NULL WHERE market_state IN ('NONE', 'NULL', 'MB', 'PE', 'VG', 'VI');
UPDATE bookings SET market_state = 'CO' WHERE market_state = 'CL';
UPDATE bookings SET market_state = 'KS' WHERE market_state = 'KA';

-- Fix full names
UPDATE bookings SET market_state = 'GA' WHERE market_state = 'GEORGIA';
UPDATE bookings SET market_state = 'MD' WHERE market_state = 'MARYLAND';

-- Fix multi-state (take first)
UPDATE bookings SET market_state = 'GA' WHERE market_state = 'GA, FL';
UPDATE bookings SET market_state = 'GA' WHERE market_state = 'GA, TX, DC, FL';
UPDATE bookings SET market_state = 'DE' WHERE market_state = 'DE / MD';
UPDATE bookings SET market_state = 'MD' WHERE market_state = 'MD / DC';
UPDATE bookings SET market_state = 'MD' WHERE market_state = 'MD/DC';
UPDATE bookings SET market_state = 'NC' WHERE market_state = 'NC, FL';
UPDATE bookings SET market_state = 'NV' WHERE market_state = 'NV, FL, GA';

-- Map known cities to states (for NULL state records)
UPDATE bookings SET market_state = 'GA' WHERE market_state IS NULL AND market_city IN ('Atlanta','Riverdale','Forest Park','Stone Mountain','Decatur','Jonesboro','Marietta','East Point','College Park','Lithonia','Conyers','Morrow','Ellenwood','Lawrenceville','Snellville','Duluth','Norcross','Kennesaw','Smyrna','Stockbridge','Hampton','McDonough','Fairburn','Union City','Austell','Powder Springs','Clarkston','Tucker','Chamblee','Brookhaven','Sandy Springs','Roswell','Alpharetta','Peachtree City','Newnan','Fayetteville','Covington','Rex','Redan','Scottdale','Avondale Estates');
UPDATE bookings SET market_state = 'FL' WHERE market_state IS NULL AND market_city IN ('Jacksonville','Orlando','Tampa','Gainesville','Miami','Fort Lauderdale','Kissimmee','Lakeland','Clearwater','St. Petersburg','Daytona Beach','Cape Coral','Bradenton','Ocala','Tallahassee','Pensacola','Sanford','Deltona','Port Charlotte','Sarasota','Palm Bay','Melbourne','Brandon','Largo','Hollywood','Pompano Beach','Fort Myers');
UPDATE bookings SET market_state = 'TX' WHERE market_state IS NULL AND market_city IN ('Houston','Dallas','San Antonio','Austin','Fort Worth','Arlington','El Paso','Plano','Irving','Garland','McKinney','Frisco','Denton','Killeen','Waco','Beaumont','Tyler','Midland','Odessa','Lubbock','Amarillo','Pasadena','Mesquite','Katy','Spring','Humble','Sugar Land','Conroe','Round Rock','Cedar Park');
UPDATE bookings SET market_state = 'NV' WHERE market_state IS NULL AND market_city IN ('Las Vegas','Henderson','North Las Vegas','Reno','Vegas');
UPDATE bookings SET market_state = 'AZ' WHERE market_state IS NULL AND market_city IN ('Phoenix','Mesa','Tempe','Scottsdale','Glendale','Chandler','Gilbert','Peoria','Surprise','Avondale','Goodyear','Buckeye','Casa Grande','Tolleson');
UPDATE bookings SET market_state = 'MD' WHERE market_state IS NULL AND market_city IN ('Baltimore','Silver Spring','Columbia','Germantown','Waldorf','Frederick','Bowie','Rockville','Glen Burnie','Laurel','Salisbury','Hagerstown','Annapolis');
UPDATE bookings SET market_state = 'NC' WHERE market_state IS NULL AND market_city IN ('Charlotte','Raleigh','Durham','Greensboro','Winston-Salem','Fayetteville','High Point','Asheville','Wilmington','Concord','Gastonia','Huntersville');
UPDATE bookings SET market_state = 'PA' WHERE market_state IS NULL AND market_city IN ('Philadelphia','Pittsburgh','Allentown','Reading','Bethlehem','Lancaster','Harrisburg','Scranton','York');
UPDATE bookings SET market_state = 'IN' WHERE market_state IS NULL AND market_city IN ('Indianapolis','Fort Wayne','Evansville','South Bend','Carmel','Fishers','Bloomington','Hammond','Gary','Muncie');
UPDATE bookings SET market_state = 'MO' WHERE market_state IS NULL AND market_city IN ('Kansas City','St. Louis','Springfield','Columbia','Independence','Lee''s Summit');
UPDATE bookings SET market_state = 'VA' WHERE market_state IS NULL AND market_city IN ('Richmond','Virginia Beach','Norfolk','Chesapeake','Newport News','Hampton','Alexandria','Roanoke','Lynchburg','Portsmouth');
UPDATE bookings SET market_state = 'IL' WHERE market_state IS NULL AND market_city IN ('Chicago','Aurora','Joliet','Naperville','Rockford','Springfield','Elgin','Peoria');
UPDATE bookings SET market_state = 'LA' WHERE market_state IS NULL AND market_city IN ('New Orleans','Baton Rouge','Shreveport','Metairie','Lafayette','Lake Charles','Kenner','Marrero','Harvey');
UPDATE bookings SET market_state = 'TN' WHERE market_state IS NULL AND market_city IN ('Nashville','Memphis','Knoxville','Chattanooga','Clarksville','Murfreesboro','Franklin','Jackson','Johnson City');
UPDATE bookings SET market_state = 'OH' WHERE market_state IS NULL AND market_city IN ('Columbus','Cleveland','Cincinnati','Toledo','Akron','Dayton','Canton','Youngstown');
UPDATE bookings SET market_state = 'DC' WHERE market_state IS NULL AND market_city IN ('Washington','Washington D.C.','Washington DC');
UPDATE bookings SET market_state = 'MA' WHERE market_state IS NULL AND market_city IN ('Boston','Worcester','Springfield','Cambridge','Lowell','Brockton');
UPDATE bookings SET market_state = 'CA' WHERE market_state IS NULL AND market_city IN ('Los Angeles','San Diego','San Francisco','Sacramento','San Jose','Fresno','Long Beach','Oakland','Bakersfield','Riverside');
UPDATE bookings SET market_state = 'NY' WHERE market_state IS NULL AND market_city IN ('New York','Buffalo','Rochester','Syracuse','Albany','Yonkers');
UPDATE bookings SET market_state = 'WI' WHERE market_state IS NULL AND market_city IN ('Milwaukee','Madison','Green Bay','Kenosha','Racine');
UPDATE bookings SET market_state = 'KS' WHERE market_state IS NULL AND market_city IN ('Wichita','Overland Park','Kansas City','Olathe','Topeka');
UPDATE bookings SET market_state = 'MI' WHERE market_state IS NULL AND market_city IN ('Detroit','Grand Rapids','Warren','Sterling Heights','Ann Arbor','Lansing','Flint');
UPDATE bookings SET market_state = 'SC' WHERE market_state IS NULL AND market_city IN ('Columbia','Charleston','North Charleston','Greenville','Rock Hill','Mount Pleasant');
UPDATE bookings SET market_state = 'OK' WHERE market_state IS NULL AND market_city IN ('Oklahoma City','Tulsa','Norman','Broken Arrow','Edmond','Lawton');
UPDATE bookings SET market_state = 'CO' WHERE market_state IS NULL AND market_city IN ('Denver','Colorado Springs','Aurora','Fort Collins','Lakewood','Thornton','Arvada','Westminster','Boulder');
```

**Edge Function Changes** (`supabase/functions/aggregate-market-data/index.ts`):
- Add `normalizeState()` function that uppercases the state and maps known full names to abbreviations
- Use `normalizeState()` for the state field and keep `normalizeName()` for cities
- Filter out records where normalized state is still "Unknown" from a separate "Unknown" bucket that users can optionally view

**Cache Cleanup**: Delete all cache entries so fresh data is computed with the cleaned-up values.

### Expected Result
- The "Unknown" state row will shrink dramatically (from 2,104 to likely under 200)
- No more duplicate states from case differences
- Clean, uppercase state abbreviations (TX, FL, GA, etc.)
- Junk entries removed entirely
