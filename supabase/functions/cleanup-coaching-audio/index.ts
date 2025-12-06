import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETENTION_DAYS = 15;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting coaching audio cleanup...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff date (15 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    console.log(`Finding audio older than ${RETENTION_DAYS} days (before ${cutoffIso})...`);

    // Find transcriptions with audio older than retention period
    const { data: oldAudio, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('id, coaching_audio_url, coaching_audio_generated_at')
      .not('coaching_audio_url', 'is', null)
      .lt('coaching_audio_generated_at', cutoffIso)
      .limit(100); // Process in batches

    if (fetchError) {
      console.error('Error fetching old audio:', fetchError);
      throw fetchError;
    }

    if (!oldAudio || oldAudio.length === 0) {
      console.log('No audio files older than 15 days found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No audio to clean up',
          deleted: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${oldAudio.length} audio files to clean up`);

    let deletedCount = 0;
    let errorCount = 0;

    for (const record of oldAudio) {
      try {
        const audioUrl = record.coaching_audio_url;
        
        // Extract file path from storage URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/coaching-audio/filename.mp3
        if (audioUrl && audioUrl.includes('/coaching-audio/')) {
          const filePath = audioUrl.split('/coaching-audio/').pop();
          
          if (filePath) {
            // Delete from storage
            const { error: deleteStorageError } = await supabase
              .storage
              .from('coaching-audio')
              .remove([filePath]);

            if (deleteStorageError) {
              console.error(`Error deleting storage file ${filePath}:`, deleteStorageError);
              // Continue anyway to clear the URL reference
            } else {
              console.log(`Deleted storage file: ${filePath}`);
            }
          }
        }

        // Clear the URL in database (keep timestamps for historical record)
        const { error: updateError } = await supabase
          .from('booking_transcriptions')
          .update({ coaching_audio_url: null })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Error clearing URL for ${record.id}:`, updateError);
          errorCount++;
        } else {
          deletedCount++;
          console.log(`Cleared audio URL for transcription: ${record.id}`);
        }
      } catch (err) {
        console.error(`Error processing record ${record.id}:`, err);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Cleanup complete`,
      deleted: deletedCount,
      errors: errorCount,
      cutoffDate: cutoffIso
    };

    console.log('Cleanup result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

