import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isPlaceholderName(name: string): boolean {
  if (!name) return true;
  return name.startsWith('API Submission') || name.startsWith('api submission');
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5) return false;
  // Basic email pattern check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  // Skip bogus values that look like descriptions
  const bogus = ['n/a', 'none', 'unknown', 'not provided', 'no email'];
  if (bogus.includes(email.toLowerCase())) return false;
  return true;
}

function isValidLocation(value: string | null): boolean {
  if (!value || value.trim().length < 2) return false;
  const bogus = ['n/a', 'none', 'unknown', 'not provided', 'null', 'undefined'];
  return !bogus.includes(value.toLowerCase().trim());
}

// Extract a person's name from a greeting pattern in transcript
function extractNameFromGreeting(transcription: string): string | null {
  const firstChunk = transcription.substring(0, 500);
  const patterns = [
    /(?:Agent|Member|Speaker\s*\d):\s*(?:Hi|Hello|Hey|Good\s+(?:morning|afternoon|evening)),?\s+([A-Z][a-z]{1,15})/,
    /^(?:Hi|Hello|Hey|Good\s+(?:morning|afternoon|evening)),?\s+([A-Z][a-z]{1,15})/m,
  ];
  const skipWords = new Set([
    'there', 'everyone', 'all', 'guys', 'team', 'sir', 'ma', 'madam',
    'this', 'how', 'thank', 'thanks', 'yes', 'no', 'so', 'um', 'well',
    'good', 'great', 'nice', 'right', 'okay',
  ]);
  for (const pattern of patterns) {
    const match = firstChunk.match(pattern);
    if (match && match[1] && !skipWords.has(match[1].toLowerCase())) {
      return match[1];
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let dryRun = false;
    let batchSize = 50;
    try {
      const body = await req.json();
      if (body.dryRun) dryRun = true;
      if (body.batchSize) batchSize = Math.min(body.batchSize, 200);
    } catch {
      // defaults
    }

    console.log(`[BackfillMemberDetails] Starting - dryRun: ${dryRun}, batchSize: ${batchSize}`);

    // Get research bookings with transcriptions that have memberDetails
    const { data: transcriptions, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, call_key_points')
      .not('call_key_points', 'is', null)
      .limit(batchSize);

    if (fetchError) throw fetchError;

    // Filter to those with memberDetails
    const withDetails = (transcriptions || []).filter((t: any) => 
      t.call_key_points?.memberDetails
    );

    console.log(`[BackfillMemberDetails] Found ${withDetails.length} transcriptions with memberDetails`);

    if (withDetails.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, message: 'No records with memberDetails found', 
        processed: 0, updated: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch corresponding bookings
    const bookingIds = withDetails.map((t: any) => t.booking_id);
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, member_name, contact_email, market_city, market_state, record_type')
      .in('id', bookingIds);

    if (bookingsError) throw bookingsError;

    const bookingMap = new Map((bookings || []).map((b: any) => [b.id, b]));

    let updatedCount = 0;
    let skippedCount = 0;
    const updates: Array<{ id: string; changes: Record<string, string> }> = [];

    for (const trans of withDetails) {
      const booking = bookingMap.get(trans.booking_id);
      if (!booking) { skippedCount++; continue; }

      const md = trans.call_key_points.memberDetails;
      const changes: Record<string, string> = {};

      // member_name: update if placeholder
      if (isPlaceholderName(booking.member_name)) {
        const first = md.firstName?.trim();
        const last = md.lastName?.trim();
        if (first) {
          changes.member_name = last ? `${first} ${last}` : first;
        }
      }

      // contact_email: update if null
      if (!booking.contact_email && md.email && isValidEmail(md.email)) {
        changes.contact_email = md.email;
      }

      // market_city: update if null
      if (!booking.market_city && isValidLocation(md.marketCity || md.city)) {
        changes.market_city = (md.marketCity || md.city).trim();
      }

      // market_state: update if null
      if (!booking.market_state && isValidLocation(md.marketState || md.state)) {
        changes.market_state = (md.marketState || md.state).trim();
      }

      if (Object.keys(changes).length > 0) {
        updates.push({ id: booking.id, changes });
      } else {
        skippedCount++;
      }
    }

    console.log(`[BackfillMemberDetails] Prepared ${updates.length} updates, ${skippedCount} skipped`);

    if (!dryRun && updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update(update.changes)
          .eq('id', update.id);

        if (updateError) {
          console.error(`[BackfillMemberDetails] Failed to update ${update.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }

    // ===== PASS 2: Cross-reference research_calls for placeholder names =====
    console.log('[BackfillMemberDetails] Starting Pass 2: research_calls cross-reference...');
    let researchUpdatedCount = 0;

    // Find bookings with placeholder names that are research records
    const { data: placeholderBookings, error: phError } = await supabase
      .from('bookings')
      .select('id, member_name, contact_phone, research_call_id')
      .eq('record_type', 'research')
      .ilike('member_name', 'API Submission%')
      .limit(batchSize);

    if (phError) {
      console.error('[BackfillMemberDetails] Pass 2 fetch error:', phError);
    } else if (placeholderBookings && placeholderBookings.length > 0) {
      console.log(`[BackfillMemberDetails] Pass 2: Found ${placeholderBookings.length} placeholder research bookings`);

      for (const booking of placeholderBookings) {
        let realName: string | null = null;

        // Try by research_call_id first
        if (booking.research_call_id) {
          const { data: rc } = await supabase
            .from('research_calls')
            .select('caller_name')
            .eq('id', booking.research_call_id)
            .maybeSingle();
          if (rc?.caller_name && !rc.caller_name.startsWith('API Submission')) {
            realName = rc.caller_name;
          }
        }

        // Try by phone number
        if (!realName && booking.contact_phone) {
          const normalizedPhone = booking.contact_phone.replace(/\D/g, '').slice(-10);
          if (normalizedPhone.length >= 10) {
            const { data: rcByPhone } = await supabase
              .from('research_calls')
              .select('caller_name')
              .ilike('caller_phone', `%${normalizedPhone}`)
              .not('caller_name', 'ilike', 'API Submission%')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (rcByPhone?.caller_name) {
              realName = rcByPhone.caller_name;
            }
          }
        }

        if (realName && !dryRun) {
          const { error: updateErr } = await supabase
            .from('bookings')
            .update({ member_name: realName })
            .eq('id', booking.id);

          if (updateErr) {
            console.error(`[BackfillMemberDetails] Pass 2 failed for ${booking.id}:`, updateErr);
          } else {
            researchUpdatedCount++;
            console.log(`[BackfillMemberDetails] Pass 2: "${booking.member_name}" → "${realName}"`);
          }
        } else if (realName) {
          researchUpdatedCount++; // count for dry run
        }
      }
    }

    console.log(`[BackfillMemberDetails] Pass 2 complete: ${researchUpdatedCount} research names updated`);

    const response = {
      success: true,
      dryRun,
      totalWithMemberDetails: withDetails.length,
      prepared: updates.length,
      updated: dryRun ? 0 : updatedCount,
      skipped: skippedCount,
      researchNamesUpdated: dryRun ? 0 : researchUpdatedCount,
      researchPlaceholdersFound: placeholderBookings?.length || 0,
      sampleUpdates: updates.slice(0, 10).map(u => ({
        id: u.id,
        changes: u.changes
      }))
    };

    console.log('[BackfillMemberDetails] Complete:', JSON.stringify(response));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[BackfillMemberDetails] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
