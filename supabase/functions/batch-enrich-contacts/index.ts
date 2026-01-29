import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract email from member_name field if it contains email pattern
 * Format: "Name (email@example.com)" or just "email@example.com"
 */
function extractEmailFromMemberName(memberName: string): string | null {
  if (!memberName) return null;
  
  // Check for "Name (email)" format
  const match = memberName.match(/\(([^)]+@[^)]+)\)/);
  if (match) {
    return match[1].trim();
  }
  
  // Check if the whole string is an email
  if (memberName.includes('@') && !memberName.includes(' ')) {
    return memberName.trim();
  }
  
  return null;
}

/**
 * Extract phone from notes using direction-aware logic
 * For outbound: returns TO number
 * For inbound: returns FROM number
 */
function extractPhoneFromNotes(notes: string, bookingType: string): string | null {
  if (!notes) return null;
  
  // Pattern: "call was made from +1XXXXXXXXXX to +1YYYYYYYYYY"
  const match = notes.match(/call was made from (\+?\d{10,14}) to (\+?\d{10,14})/i);
  if (!match) return null;
  
  const fromNumber = match[1];
  const toNumber = match[2];
  
  // Outbound: agent called TO the contact → return TO number
  // Inbound: contact called FROM their phone → return FROM number
  if (bookingType.toLowerCase() === 'outbound') {
    return toNumber;
  } else {
    return fromNumber;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    let batchSize = 100;
    let dryRun = false;
    
    try {
      const body = await req.json();
      if (body.batchSize) batchSize = Math.min(body.batchSize, 500);
      if (body.dryRun) dryRun = true;
    } catch {
      // No body, use defaults
    }

    console.log(`Starting contact enrichment - batchSize: ${batchSize}, dryRun: ${dryRun}`);

    // Get all records that need enrichment (missing contact_email OR contact_phone)
    const { data: records, error: fetchError } = await supabase
      .from('bookings')
      .select('id, member_name, notes, booking_type, contact_email, contact_phone')
      .or('contact_email.is.null,contact_phone.is.null')
      .not('import_batch_id', 'is', null) // Only imported records
      .limit(batchSize);

    if (fetchError) {
      console.error('Error fetching records:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${records?.length || 0} records to process`);

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No records need enrichment',
          processed: 0,
          updated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedCount = 0;
    const updates: Array<{ id: string; contact_email?: string; contact_phone?: string }> = [];

    for (const record of records) {
      let needsUpdate = false;
      const updateData: { contact_email?: string; contact_phone?: string } = {};

      // Extract email if missing
      if (!record.contact_email) {
        const email = extractEmailFromMemberName(record.member_name);
        if (email) {
          updateData.contact_email = email;
          needsUpdate = true;
        }
      }

      // Extract phone if missing
      if (!record.contact_phone) {
        const phone = extractPhoneFromNotes(record.notes, record.booking_type);
        if (phone) {
          updateData.contact_phone = phone;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        updates.push({ id: record.id, ...updateData });
      }
    }

    console.log(`Prepared ${updates.length} updates`);

    // Perform updates (unless dry run)
    if (!dryRun && updates.length > 0) {
      for (const update of updates) {
        const { id, ...data } = update;
        const { error: updateError } = await supabase
          .from('bookings')
          .update(data)
          .eq('id', id);

        if (updateError) {
          console.error(`Failed to update record ${id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }

    // Get remaining count for progress tracking
    const { count: remainingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or('contact_email.is.null,contact_phone.is.null')
      .not('import_batch_id', 'is', null);

    const response = {
      success: true,
      processed: records.length,
      updated: dryRun ? 0 : updatedCount,
      prepared: updates.length,
      remaining: remainingCount || 0,
      dryRun,
      sampleUpdates: updates.slice(0, 5).map(u => ({
        id: u.id,
        email: u.contact_email || '(no change)',
        phone: u.contact_phone || '(no change)'
      }))
    };

    console.log('Enrichment complete:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch-enrich-contacts:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
