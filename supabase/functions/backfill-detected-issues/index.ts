import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same keyword classifier as used in transcribe-call (tightened to reduce false positives)
const ISSUE_KEYWORDS: Record<string, string[]> = {
  'Payment & Pricing Confusion': [
    'promo code', 'deposit', 'weekly rate', 'how much', 'move-in cost',
    'coupon', 'discount', 'billing', 'pricing', 'overcharged', 'hidden fee',
    'price confused', 'not sure about the price', 'weekly payment', 'first week',
  ],
  'Booking Process Issues': [
    'how to book', 'confus', 'trouble booking', "can't figure out",
    'hard to navigate', 'stuck on', 'book a room', 'reserve',
  ],
  'Host & Approval Concerns': [
    'approval', 'approv', 'reject', 'landlord', 'denied', 'pending approval',
    "haven't heard back", 'no response', 'still waiting', 'property manager',
  ],
  'Trust & Legitimacy': [
    'scam', 'legit', 'trust', 'fraud', 'concern about company', 'suspicious',
    'legitimate', 'sketchy', 'too good to be true', 'is this a scam',
    'can i trust', 'is this real', 'reviews', 'reputation',
  ],
  'Transportation Barriers': [
    'transport', 'bus', 'transit', 'commute', 'far from', 'too far',
    'close to work', 'near work', 'no transportation', "can't get there", 'public transit',
  ],
  'Move-In Barriers': [
    'background check', 'credit check', 'screening', 'eviction',
    'when can i move', 'criminal', 'failed background', 'denied screening',
    'move-in', 'move in',
  ],
  'Property & Amenity Mismatch': [
    'noisy', 'neighborhood', 'too small', "doesn't have", 'no parking',
    'not what i expected', 'wrong room', 'amenity',
  ],
  'Financial Constraints': [
    'budget', "can't afford", 'too expensive', 'unemploy', 'cheaper',
    'low income', 'fixed income', 'disability', 'ssi', 'ssdi',
    'not enough money', "can't pay",
  ],
};

interface DetectedIssueDetail {
  issue: string;
  matchingKeywords: string[];
  matchingConcerns: string[];
}

function classifyFromKeyPoints(keyPoints: any): DetectedIssueDetail[] {
  const concerns: string[] = keyPoints?.memberConcerns || [];
  const objections: string[] = keyPoints?.objections || [];
  const allSources = [...concerns, ...objections];
  const allText = allSources.join(' ').toLowerCase();
  if (!allText.trim()) return [];

  const detected: DetectedIssueDetail[] = [];
  for (const [category, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    const matchedKeywords = keywords.filter(kw => allText.includes(kw.toLowerCase()));
    if (matchedKeywords.length >= 2) {
      const matchingConcerns = allSources.filter(source => {
        const lower = source.toLowerCase();
        return matchedKeywords.some(kw => lower.includes(kw));
      });
      detected.push({
        issue: category,
        matchingKeywords: matchedKeywords,
        matchingConcerns: [...new Set(matchingConcerns)],
      });
    }
  }
  return detected;
}

async function fetchTranscriptionsInChunks(
  supabase: any,
  bookingIds: string[],
  chunkSize = 50
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < bookingIds.length; i += chunkSize) {
    const chunk = bookingIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, call_key_points')
      .in('booking_id', chunk);
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const BATCH_SIZE = 200;
    let totalProcessed = 0;
    let totalTagged = 0;
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      // Fetch bookings that have transcription data but no detected_issues
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id')
        .is('detected_issues', null)
        .eq('transcription_status', 'completed')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;
      if (!bookings || bookings.length === 0) {
        hasMore = false;
        break;
      }

      const bookingIds = bookings.map(b => b.id);

      // Fetch key points from booking_transcriptions in chunks
      const transcriptions = await fetchTranscriptionsInChunks(supabase, bookingIds);

      // Process each transcription
      for (const t of (transcriptions || [])) {
        if (!t.call_key_points) continue;

        const issues = classifyFromKeyPoints(t.call_key_points);
        
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ detected_issues: issues.length > 0 ? issues : [] })
          .eq('id', t.booking_id);

        if (updateError) {
          console.error(`Failed to update ${t.booking_id}:`, updateError);
        } else {
          if (issues.length > 0) totalTagged++;
        }
        totalProcessed++;
      }

      // Also mark bookings without transcription data as empty array
      const transcribedIds = new Set((transcriptions || []).map(t => t.booking_id));
      const noTranscriptionIds = bookingIds.filter(id => !transcribedIds.has(id));
      
      for (const id of noTranscriptionIds) {
        await supabase.from('bookings').update({ detected_issues: [] }).eq('id', id);
        totalProcessed++;
      }

      console.log(`[Backfill] Batch processed: ${totalProcessed} total, ${totalTagged} tagged`);
      
      if (bookings.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalProcessed,
      totalTagged,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
