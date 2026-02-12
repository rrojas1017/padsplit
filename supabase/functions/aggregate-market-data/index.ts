import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize city names: trim, title case, strip neighborhood prefixes
function normalizeName(name: string | null | undefined): string {
  if (!name) return "Unknown";
  let n = name.trim();
  if (!n) return "Unknown";
  // Strip neighborhood prefix (e.g., "Northline, Houston" → "Houston")
  if (n.includes(",")) {
    const parts = n.split(",").map(p => p.trim()).filter(Boolean);
    n = parts[parts.length - 1]; // take last part (the city)
  }
  // Title case
  return n.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Normalize state values: uppercase abbreviations, map full names, filter junk
const STATE_NAME_MAP: Record<string, string> = {
  "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR",
  "CALIFORNIA": "CA", "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE",
  "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID",
  "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
  "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
  "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS",
  "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
  "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT",
  "VERMONT": "VT", "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV",
  "WISCONSIN": "WI", "WYOMING": "WY", "DISTRICT OF COLUMBIA": "DC",
};

const VALID_STATES = new Set(Object.values(STATE_NAME_MAP));
VALID_STATES.add("DC");

const JUNK_VALUES = new Set(["NONE", "NULL", "N/A", "NA", "UNKNOWN", ""]);

function normalizeState(val: string | null | undefined): string {
  if (!val) return "Unknown";
  let s = val.trim().toUpperCase();
  if (!s || JUNK_VALUES.has(s)) return "Unknown";

  // Handle multi-state: take first
  if (s.includes(",")) s = s.split(",")[0].trim();
  if (s.includes("/")) s = s.split("/")[0].trim();

  // Map full names
  if (STATE_NAME_MAP[s]) return STATE_NAME_MAP[s];

  // If it's a valid 2-letter abbreviation, return it
  if (s.length === 2 && VALID_STATES.has(s)) return s;

  // Otherwise unknown
  return "Unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { dateFrom, dateTo, minRecords = 1 } = await req.json().catch(() => ({}));

    const cacheKey = `${dateFrom || "all"}_${dateTo || "all"}_${minRecords}`;

    // Check cache (valid for 15 minutes)
    const { data: cached } = await supabase
      .from("market_intelligence_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.generated_at).getTime();
      if (age < 15 * 60 * 1000) {
        return new Response(JSON.stringify({
          stateData: cached.state_data,
          cityData: cached.city_data,
          generatedAt: cached.generated_at,
          fromCache: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch all bookings in batches of 500 to avoid 1,000-row limit
    const BATCH_SIZE = 500;
    const bookings: any[] = [];
    let offset = 0;
    while (true) {
      let q = supabase
        .from("bookings")
        .select("id, market_city, market_state, status, booking_date, move_in_date, call_duration_seconds, communication_method, booking_type")
        .range(offset, offset + BATCH_SIZE - 1);
      if (dateFrom) q = q.gte("booking_date", dateFrom);
      if (dateTo) q = q.lte("booking_date", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      bookings.push(...data);
      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
    console.log(`Fetched ${bookings.length} bookings in ${Math.ceil(bookings.length / BATCH_SIZE)} batches`);

    // Fetch all transcriptions with key points using range-based pagination
    const allTranscriptions: any[] = [];
    let transOffset = 0;
    while (true) {
      const { data: transData, error: transError } = await supabase
        .from("booking_transcriptions")
        .select("booking_id, call_key_points")
        .not("call_key_points", "is", null)
        .range(transOffset, transOffset + BATCH_SIZE - 1);

      if (transError) {
        console.error("Transcription batch error:", transError.message);
        break;
      }
      if (!transData || transData.length === 0) break;
      allTranscriptions.push(...transData);
      if (transData.length < BATCH_SIZE) break;
      transOffset += BATCH_SIZE;
    }

    console.log(`Fetched ${allTranscriptions.length} transcriptions in ${Math.ceil(allTranscriptions.length / BATCH_SIZE)} batches`);

    const transcriptionMap = new Map<string, any>();
    for (const t of allTranscriptions) {
      transcriptionMap.set(t.booking_id, t);
    }

    // Aggregate by state
    const stateMap = new Map<string, any>();
    const cityMap = new Map<string, any>();

    for (const b of bookings || []) {
      const state = normalizeState(b.market_state);
      const city = normalizeName(b.market_city);
      const cityKey = `${state}|${city}`;

      // State aggregation
      if (!stateMap.has(state)) {
        stateMap.set(state, {
          state,
          total: 0, bookings: 0, nonBookings: 0,
          movedIn: 0, pendingMoveIn: 0, rejected: 0, noShow: 0, cancelled: 0, postponed: 0,
          totalDuration: 0, durationCount: 0,
          sentiments: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
          totalBuyerIntent: 0, buyerIntentCount: 0,
          totalBudget: 0, budgetCount: 0,
          objections: {} as Record<string, number>,
        });
      }

      // City aggregation
      if (!cityMap.has(cityKey)) {
        cityMap.set(cityKey, {
          state, city,
          total: 0, bookings: 0, nonBookings: 0,
          movedIn: 0, pendingMoveIn: 0, rejected: 0, noShow: 0, cancelled: 0, postponed: 0,
          totalDuration: 0, durationCount: 0,
          sentiments: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
          totalBuyerIntent: 0, buyerIntentCount: 0,
          totalBudget: 0, budgetCount: 0,
          objections: {} as Record<string, number>,
        });
      }

      const stateAgg = stateMap.get(state)!;
      const cityAgg = cityMap.get(cityKey)!;

      for (const agg of [stateAgg, cityAgg]) {
        agg.total++;
        if (b.status === "Non Booking") agg.nonBookings++;
        else agg.bookings++;
        if (b.status === "Moved In") agg.movedIn++;
        if (b.status === "Pending Move-In") agg.pendingMoveIn++;
        if (b.status === "Member Rejected") agg.rejected++;
        if (b.status === "No Show") agg.noShow++;
        if (b.status === "Cancelled") agg.cancelled++;
        if (b.status === "Postponed") agg.postponed++;

        if (b.call_duration_seconds && b.call_duration_seconds > 0) {
          agg.totalDuration += b.call_duration_seconds;
          agg.durationCount++;
        }
      }

      // Transcription data
      const trans = transcriptionMap.get(b.id);
      if (trans?.call_key_points) {
        const kp = typeof trans.call_key_points === "string" 
          ? JSON.parse(trans.call_key_points) 
          : trans.call_key_points;

        for (const agg of [stateAgg, cityAgg]) {
          // Sentiment
          const sentiment = kp.callSentiment?.toLowerCase?.() || "";
          if (sentiment.includes("positive")) agg.sentiments.positive++;
          else if (sentiment.includes("negative")) agg.sentiments.negative++;
          else if (sentiment.includes("mixed")) agg.sentiments.mixed++;
          else if (sentiment) agg.sentiments.neutral++;

          // Buyer intent
          const intentScore = kp.buyerIntent?.score;
          if (typeof intentScore === "number") {
            agg.totalBuyerIntent += intentScore;
            agg.buyerIntentCount++;
          }

          // Weekly budget
          const budget = kp.memberDetails?.weeklyBudget;
          if (typeof budget === "number" && budget > 0) {
            agg.totalBudget += budget;
            agg.budgetCount++;
          }

          // Objections
          const objections = kp.objections;
          if (Array.isArray(objections)) {
            for (const obj of objections) {
              const label = typeof obj === "string" ? obj : obj?.type || obj?.concern || String(obj);
              if (label) {
                agg.objections[label] = (agg.objections[label] || 0) + 1;
              }
            }
          }
        }
      }
    }

    // Format results
    const formatAgg = (agg: any) => {
      const convRate = agg.bookings > 0 ? (agg.movedIn / agg.bookings) * 100 : 0;
      const churnRate = agg.bookings > 0 ? ((agg.rejected + agg.noShow + agg.cancelled) / agg.bookings) * 100 : 0;
      const avgDuration = agg.durationCount > 0 ? agg.totalDuration / agg.durationCount : 0;
      const avgBuyerIntent = agg.buyerIntentCount > 0 ? agg.totalBuyerIntent / agg.buyerIntentCount : null;
      const avgBudget = agg.budgetCount > 0 ? agg.totalBudget / agg.budgetCount : null;

      // Dominant sentiment
      const sentimentEntries = Object.entries(agg.sentiments) as [string, number][];
      const dominantSentiment = sentimentEntries.sort((a, b) => (b[1] as number) - (a[1] as number))[0];

      // Top objections
      const topObjections = Object.entries(agg.objections)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([label, count]) => ({ label, count }));

      return {
        total: agg.total,
        bookings: agg.bookings,
        nonBookings: agg.nonBookings,
        movedIn: agg.movedIn,
        pendingMoveIn: agg.pendingMoveIn,
        rejected: agg.rejected,
        noShow: agg.noShow,
        cancelled: agg.cancelled,
        postponed: agg.postponed,
        conversionRate: Math.round(convRate * 10) / 10,
        churnRate: Math.round(churnRate * 10) / 10,
        avgCallDuration: Math.round(avgDuration),
        dominantSentiment: dominantSentiment ? dominantSentiment[0] : "unknown",
        sentimentBreakdown: agg.sentiments,
        avgBuyerIntent: avgBuyerIntent !== null ? Math.round(avgBuyerIntent) : null,
        avgWeeklyBudget: avgBudget !== null ? Math.round(avgBudget) : null,
        topObjections,
      };
    };

    const stateData = Array.from(stateMap.entries())
      .map(([state, agg]) => ({ state, ...formatAgg(agg) }))
      .filter(s => s.total >= minRecords)
      .sort((a, b) => b.total - a.total);

    const cityData = Array.from(cityMap.entries())
      .map(([key, agg]) => ({ state: agg.state, city: agg.city, ...formatAgg(agg) }))
      .filter(c => c.total >= minRecords)
      .sort((a, b) => b.total - a.total);

    // Upsert cache
    await supabase
      .from("market_intelligence_cache")
      .upsert({
        cache_key: cacheKey,
        state_data: stateData,
        city_data: cityData,
        generated_at: new Date().toISOString(),
        filters: { dateFrom, dateTo, minRecords },
      }, { onConflict: "cache_key" });

    return new Response(JSON.stringify({
      stateData,
      cityData,
      rawTotal: (bookings || []).length,
      generatedAt: new Date().toISOString(),
      fromCache: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error aggregating market data:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
