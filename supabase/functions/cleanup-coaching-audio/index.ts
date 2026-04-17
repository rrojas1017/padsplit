import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETENTION_DAYS = 60;
const BATCH_LIMIT = 500;

interface CleanupResult {
  deleted: number;
  errors: number;
}

async function cleanupAudioColumn(
  supabase: ReturnType<typeof createClient>,
  cutoffIso: string,
  urlColumn: 'coaching_audio_url' | 'qa_coaching_audio_url',
  timestampColumn: 'coaching_audio_generated_at' | 'qa_coaching_audio_generated_at',
  label: string
): Promise<CleanupResult> {
  console.log(`[${label}] Searching for audio older than ${cutoffIso}...`);

  const { data: oldAudio, error: fetchError } = await supabase
    .from('booking_transcriptions')
    .select(`id, ${urlColumn}, ${timestampColumn}`)
    .not(urlColumn, 'is', null)
    .lt(timestampColumn, cutoffIso)
    .limit(BATCH_LIMIT);

  if (fetchError) {
    console.error(`[${label}] Error fetching old audio:`, fetchError);
    throw fetchError;
  }

  if (!oldAudio || oldAudio.length === 0) {
    console.log(`[${label}] No audio files older than ${RETENTION_DAYS} days found`);
    return { deleted: 0, errors: 0 };
  }

  console.log(`[${label}] Found ${oldAudio.length} audio files to clean up`);

  let deleted = 0;
  let errors = 0;

  for (const record of oldAudio as any[]) {
    try {
      const audioUrl = record[urlColumn] as string | null;

      if (audioUrl && audioUrl.includes('/coaching-audio/')) {
        const filePath = audioUrl.split('/coaching-audio/').pop();
        if (filePath) {
          const { error: deleteStorageError } = await supabase
            .storage
            .from('coaching-audio')
            .remove([filePath]);

          if (deleteStorageError) {
            console.error(`[${label}] Error deleting storage file ${filePath}:`, deleteStorageError);
          } else {
            console.log(`[${label}] Deleted storage file: ${filePath}`);
          }
        }
      }

      const { error: updateError } = await supabase
        .from('booking_transcriptions')
        .update({ [urlColumn]: null })
        .eq('id', record.id);

      if (updateError) {
        console.error(`[${label}] Error clearing URL for ${record.id}:`, updateError);
        errors++;
      } else {
        deleted++;
      }
    } catch (err) {
      console.error(`[${label}] Error processing record ${record.id}:`, err);
      errors++;
    }
  }

  console.log(`[${label}] Done. Deleted: ${deleted}, Errors: ${errors}`);
  return { deleted, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`Starting coaching + QA audio cleanup (retention: ${RETENTION_DAYS} days)...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    // Pass 1: Coaching audio (Jeff)
    const coaching = await cleanupAudioColumn(
      supabase,
      cutoffIso,
      'coaching_audio_url',
      'coaching_audio_generated_at',
      'COACHING'
    );

    // Pass 2: QA Coaching audio (Katty)
    const qa = await cleanupAudioColumn(
      supabase,
      cutoffIso,
      'qa_coaching_audio_url',
      'qa_coaching_audio_generated_at',
      'QA-COACHING'
    );

    const result = {
      success: true,
      message: 'Cleanup complete',
      coaching_deleted: coaching.deleted,
      qa_deleted: qa.deleted,
      total_deleted: coaching.deleted + qa.deleted,
      errors: coaching.errors + qa.errors,
      cutoffDate: cutoffIso,
      retention_days: RETENTION_DAYS,
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
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
