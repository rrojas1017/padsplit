// Backfill member_name for payment_experience research records
// where member_name is still the "API Submission..." placeholder.
// Mirrors the name-enrichment logic from transcribe-call:
//   1) Regex greeting extraction from saved transcript
//   2) Gemini Flash extraction from saved transcript
//   3) research_calls.caller_name (filtered to non-placeholder)
// Only updates bookings.member_name. Does not touch transcripts or progress.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const CHUNK_SIZE = 25;

function extractNameFromGreeting(transcription: string): string | null {
  const firstChunk = transcription.substring(0, 500);
  const patterns = [
    /(?:Agent|Member|Speaker\s*\d):\s*(?:Hi|Hello|Hey|Good\s+(?:morning|afternoon|evening)),?\s+([A-Z][a-z]{1,15})/,
    /^(?:Hi|Hello|Hey|Good\s+(?:morning|afternoon|evening)),?\s+([A-Z][a-z]{1,15})/m,
  ];
  const skipWords = new Set([
    "there","everyone","all","guys","team","sir","ma","madam",
    "this","how","thank","thanks","yes","no","so","um","well",
    "good","great","nice","right","okay",
  ]);
  for (const p of patterns) {
    const m = firstChunk.match(p);
    if (m && m[1] && !skipWords.has(m[1].toLowerCase())) return m[1];
  }
  return null;
}

async function extractNameWithAI(transcription: string): Promise<string | null> {
  try {
    const snippet = transcription.substring(0, 1500);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              'You extract the MEMBER name from a PadSplit research/survey call transcript. The researcher (PadSplit employee) greets the member by name in the first lines (e.g., "Hi Jamie, this is Emily from PadSplit"). Return ONLY a JSON object: {"firstName": "string or null", "lastName": "string or null"}. No prose.',
          },
          { role: "user", content: snippet },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const name = [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim();
    return name || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const bookingIds: string[] = Array.isArray(body.bookingIds)
    ? body.bookingIds.filter((x: unknown) => typeof x === "string")
    : [];
  const dryRun: boolean = !!body.dryRun;
  const offset: number = Number.isFinite(body.offset) ? body.offset : 0;

  if (bookingIds.length === 0) {
    return new Response(JSON.stringify({ error: "bookingIds required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const chunk = bookingIds.slice(offset, offset + CHUNK_SIZE);
  if (chunk.length === 0) {
    return new Response(JSON.stringify({ done: true, total: bookingIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, member_name, research_call_id, contact_phone, booking_transcriptions(call_transcription)")
    .in("id", chunk);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const row of rows ?? []) {
    if (!row.member_name?.startsWith("API Submission")) {
      results.push({ id: row.id, skipped: "not_placeholder" });
      continue;
    }
    const transcription: string =
      (row as any).booking_transcriptions?.[0]?.call_transcription ??
      (row as any).booking_transcriptions?.call_transcription ?? "";

    let resolved: string | null = null;
    let source = "";

    if (transcription && transcription.length > 50) {
      resolved = extractNameFromGreeting(transcription);
      if (resolved) source = "regex";
      if (!resolved) {
        resolved = await extractNameWithAI(transcription);
        if (resolved) source = "ai";
      }
    }

    if (!resolved && row.research_call_id) {
      const { data: rc } = await supabase
        .from("research_calls")
        .select("caller_name")
        .eq("id", row.research_call_id)
        .maybeSingle();
      if (rc?.caller_name && !rc.caller_name.startsWith("API Submission")) {
        resolved = rc.caller_name;
        source = "research_calls_id";
      }
    }
    if (!resolved && row.contact_phone) {
      const { data: rcByPhone } = await supabase
        .from("research_calls")
        .select("caller_name")
        .eq("phone_number", row.contact_phone)
        .not("caller_name", "ilike", "API Submission%")
        .limit(1)
        .maybeSingle();
      if (rcByPhone?.caller_name) {
        resolved = rcByPhone.caller_name;
        source = "research_calls_phone";
      }
    }

    if (resolved) {
      if (!dryRun) {
        await supabase.from("bookings").update({ member_name: resolved }).eq("id", row.id);
      }
      results.push({ id: row.id, name: resolved, source });
    } else {
      results.push({ id: row.id, skipped: "no_name_found" });
    }
  }

  const nextOffset = offset + CHUNK_SIZE;
  if (nextOffset < bookingIds.length && !dryRun) {
    // Self-retrigger (fire and forget)
    fetch(`${SUPABASE_URL}/functions/v1/backfill-payment-experience-names`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ bookingIds, offset: nextOffset }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({
    processed: results.length,
    offset, nextOffset,
    total: bookingIds.length,
    dryRun,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
