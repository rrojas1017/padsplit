import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same keyword classifier as used in transcribe-call
const ISSUE_KEYWORDS: Record<string, string[]> = {
  'Payment & Pricing Confusion': [
    'payment', 'promo', 'deposit', 'weekly rate', 'cost', 'price', 'fee', 'afford',
    'promo code', 'coupon', 'discount', 'billing', 'charge', 'pay', 'pricing',
    'weekly payment', 'first week', 'move-in cost', 'how much',
  ],
  'Booking Process Issues': [
    'booking', 'navigate', 'website', 'platform', 'listing', 'process', 'confus',
    'sign up', 'signup', 'register', 'account', 'app', 'application', 'apply',
    'how to book', 'book a room', 'reserve',
  ],
  'Host & Approval Concerns': [
    'host', 'approval', 'approv', 'reject', 'landlord', 'response', 'wait',
    'accepted', 'denied', 'pending approval', 'owner', 'property manager',
  ],
  'Trust & Legitimacy': [
    'scam', 'legit', 'trust', 'safe', 'real', 'fraud', 'concern about company',
    'suspicious', 'legitimate', 'verify', 'too good to be true', 'sketchy',
    'is this real', 'reviews', 'reputation',
  ],
  'Transportation Barriers': [
    'transport', 'drive', 'car', 'bus', 'transit', 'distance', 'commute', 'far from',
    'uber', 'lyft', 'ride', 'walk', 'bike', 'train', 'subway', 'public transit',
    'too far', 'close to work', 'near work',
  ],
  'Move-In Barriers': [
    'move-in', 'move in', 'background check', 'document', 'timing', 'ready', 'schedule',
    'when can i move', 'available', 'id', 'identification', 'credit check',
    'criminal', 'eviction', 'screening',
  ],
  'Property & Amenity Mismatch': [
    'room', 'amenity', 'size', 'location', 'neighborhood', 'noisy', 'space',
    'bathroom', 'kitchen', 'parking', 'furnished', 'utilities', 'wifi', 'laundry',
    'shared', 'private', 'small', 'condition', 'clean',
  ],
  'Financial Constraints': [
    'budget', 'income', 'afford', 'expensive', 'money', 'unemploy', 'verification',
    'job', 'employment', 'paycheck', 'financial', "can't afford", 'too expensive',
    'cheaper', 'low income', 'fixed income', 'disability', 'ssi', 'ssdi',
  ],
};

function classifyFromKeyPoints(keyPoints: any): string[] {
  const concerns: string[] = keyPoints?.memberConcerns || [];
  const objections: string[] = keyPoints?.objections || [];
  const summary: string = keyPoints?.summary || '';
  const preferences: string[] = keyPoints?.memberPreferences || [];

  const allText = [...concerns, ...objections, summary, ...preferences].join(' ').toLowerCase();
  if (!allText.trim()) return [];

  const detected: string[] = [];
  for (const [category, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    if (keywords.some(kw => allText.includes(kw.toLowerCase()))) {
      detected.push(category);
    }
  }
  return detected;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const BATCH_SIZE = 500;
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

      // Fetch key points from booking_transcriptions
      const { data: transcriptions, error: tError } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, call_key_points')
        .in('booking_id', bookingIds);

      if (tError) throw tError;

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
