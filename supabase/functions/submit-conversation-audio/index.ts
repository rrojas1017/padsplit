import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, adminClient as sharedAdmin } from '../_shared/auth.ts';
import { isAllowedRecordingUrl } from '../_shared/url.ts';
import { resolveCallStart } from '../_shared/callTime.ts';

// CR-005 input hygiene (local copy; also in submit-public-script).
function cleanDialer(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // deno-lint-ignore no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s && s.length <= 64 ? s : null;
}
function phoneDigits(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '').slice(0, 15);
  return d || null;
}
function isDialerKeyConflict(e: any): boolean {
  return e?.code === '23505' &&
    /research_calls_campaign_dialer_call_key/.test(`${e?.message ?? ''} ${e?.details ?? ''}`);
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- Authenticate via API Credentials (client_id + client_secret) ---
    const clientId = req.headers.get('x-client-id');
    const clientSecret = req.headers.get('x-client-secret');

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing API credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretHash = await sha256Hex(clientSecret);

    const { data: credential, error: credError } = await adminClient
      .from('api_credentials')
      .select('id, status, expires_at, rate_limit')
      .eq('client_id', clientId)
      .eq('client_secret_hash', secretHash)
      .is('deleted_at', null)
      .single();

    if (credError || !credential) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid API credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (credential.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Unauthorized: credential is ' + credential.status }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Unauthorized: credential expired' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Rate limit (fail open if the limiter itself errors) ---
    let rateRemaining: number | null = null;
    {
      const { data: rlRows, error: rlErr } = await sharedAdmin().rpc('api_rate_limit_hit', {
        p_client_id: clientId,
        p_limit: credential.rate_limit ?? 60,
      });
      const rl = Array.isArray(rlRows) ? rlRows[0] : rlRows;
      if (rlErr) {
        console.error('[submit] rate limiter error, continuing:', rlErr.message);
      } else if (rl && rl.allowed === false) {
        const retry = Math.max(1, Math.ceil((new Date(rl.reset_at).getTime() - Date.now()) / 1000));
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retry), 'X-RateLimit-Remaining': '0' },
        });
      } else if (rl) {
        rateRemaining = rl.remaining;
      }
    }

    // Update last_used_at
    await adminClient.from('api_credentials').update({ last_used_at: new Date().toISOString() }).eq('id', credential.id);

    // --- Parse & validate body ---
    const body = await req.json();
    const { audioUrl, dialerAgentUser, phoneNumber, campaign, type, callTimestamp } = body;

    const errors: string[] = [];
    if (!audioUrl || typeof audioUrl !== 'string') errors.push('audioUrl is required');
    if (!dialerAgentUser || typeof dialerAgentUser !== 'string') errors.push('dialerAgentUser is required');
    if (!phoneNumber || typeof phoneNumber !== 'string') errors.push('phoneNumber is required');
    if (!campaign || typeof campaign !== 'string') errors.push('campaign is required');
    if (!type || typeof type !== 'string') errors.push('type is required');
    if (type && type !== 'research') errors.push('type must be "research"');

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAllowedRecordingUrl(audioUrl)) {
      return new Response(JSON.stringify({ error: 'audioUrl host not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // deno-lint-ignore no-control-regex
    if (campaign.length > 200 || /[\u0000-\u001f\u007f]/.test(campaign)) {
      return new Response(JSON.stringify({ error: 'Invalid campaign' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Match dialerAgentUser to internal agent ---
    const { data: agent, error: agentError } = await adminClient
      .from('agents')
      .select('id, name, site_id')
      .eq('dialer_agent_user', dialerAgentUser)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: 'Agent not found for dialerAgentUser: ' + dialerAgentUser }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Resolve research_campaign by id OR campaign_key (Phase 1C) ---
    // Some dialers send the campaign UUID, others send the campaign_key string.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaign);
    let matchedCampaignId: string | null = null;
    let matchedScriptId: string | null = null;
    {
      // Parameterized lookups (no string-built filters): campaign_key first, then id when UUID.
      let { data: campaignData } = await adminClient
        .from('research_campaigns')
        .select('id, script_id')
        .eq('campaign_key', campaign)
        .maybeSingle();
      if (!campaignData && isUuid) {
        ({ data: campaignData } = await adminClient
          .from('research_campaigns')
          .select('id, script_id')
          .eq('id', campaign)
          .maybeSingle());
      }

      if (campaignData) {
        matchedCampaignId = campaignData.id;
        matchedScriptId = campaignData.script_id ?? null;
        console.log(`[submit] Matched campaign "${campaign}" → campaign=${matchedCampaignId}, script=${matchedScriptId}`);
      } else {
        console.log(`[submit] No research_campaigns match for "${campaign}"`);
      }
    }

    // --- Resolve canonical research_campaign_type from script (mirrors process-research-record) ---
    // Kept in sync with SCRIPT_ID_MAP in supabase/functions/process-research-record/index.ts.
    const SCRIPT_ID_MAP: Record<string, string> = {
      'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
      '6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey',
    };
    let resolvedCampaignType: string | null = null;
    if (matchedScriptId) {
      const { data: script } = await adminClient
        .from('research_scripts')
        .select('id, slug, campaign_type')
        .eq('id', matchedScriptId)
        .maybeSingle();
      if (script) {
        if (SCRIPT_ID_MAP[script.id]) {
          resolvedCampaignType = SCRIPT_ID_MAP[script.id];
        } else if (script.slug && ['payment_experience', 'audience_survey'].includes(script.slug)) {
          resolvedCampaignType = script.slug;
        } else {
          resolvedCampaignType = script.slug || `script_${String(script.id).slice(0, 8)}`;
        }
      }
    }

    const callStart = resolveCallStart({ explicit: callTimestamp, audioUrl });
    if (callTimestamp !== undefined && callStart.source !== 'body') {
      console.log('[submit] callTimestamp invalid or out of range, falling back');
    }
    console.log(`[submit] call_start source=${callStart.source} date=${callStart.date}`);
    const today = callStart.date;

    // --- CR-005: link to the ViciDial form row of the same call (only with a matched campaign) ---
    const uniqueid = cleanDialer(body.uniqueid);
    const leadId = cleanDialer(body.leadId);
    const phone10 = (phoneDigits(phoneNumber) ?? '').slice(-10) || null;
    let linked: 'uid' | 'fallback' | null = null;
    let notesSuffix = '';
    let linkRow: any = null;
    let researchCallId: string | null = null;
    let researchCallHandled = false;

    const RC_SELECT = 'id, kixie_link, caller_phone, dialer_lead_id, dialer_agent_user';
    const readByUid = async () => {
      const { data } = await adminClient
        .from('research_calls')
        .select(RC_SELECT)
        .eq('campaign_id', matchedCampaignId)
        .eq('dialer_call_id', uniqueid)
        .maybeSingle();
      return data as any;
    };
    const respondDuplicate = async (rcId: string) => {
      const { data: b } = await adminClient
        .from('bookings').select('id').eq('research_call_id', rcId).limit(1).maybeSingle();
      return new Response(JSON.stringify({
        success: true, duplicate: true, bookingId: b?.id ?? null, researchCallId: rcId,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    };
    const researchCallInsert = (extra: Record<string, unknown> = {}) =>
      adminClient
        .from('research_calls')
        .insert({
          campaign_id: matchedCampaignId,
          caller_phone: phoneNumber,
          kixie_link: audioUrl,
          call_date: today,
          caller_type: 'existing_member',
          caller_status: 'submitted',
          ...extra,
        })
        .select('id')
        .single();

    if (matchedCampaignId && uniqueid) {
      researchCallHandled = true;
      let found = await readByUid();
      if (!found) {
        const { data: rc, error: rcErr } = await researchCallInsert({
          dialer_call_id: uniqueid,
          dialer_agent_user: dialerAgentUser.slice(0, 64),
          ...(leadId ? { dialer_lead_id: leadId } : {}),
        });
        if (rc) researchCallId = rc.id;
        else if (isDialerKeyConflict(rcErr)) found = await readByUid();
        else console.error('[submit] research_calls insert failed:', rcErr?.message);
      }
      if (found) {
        if (found.kixie_link) return await respondDuplicate(found.id);
        linkRow = found;
        linked = 'uid';
      }
    } else if (matchedCampaignId) {
      const startMs = callStart.startedAt.getTime();
      const { data: windowRows } = await adminClient
        .from('research_calls')
        .select(RC_SELECT)
        .eq('campaign_id', matchedCampaignId)
        .eq('caller_type', 'public')
        .eq('dialer_agent_user', dialerAgentUser)
        .gte('created_at', new Date(startMs - 30 * 60 * 1000).toISOString())
        .lte('created_at', new Date(startMs + 30 * 60 * 1000).toISOString())
        .limit(50);
      const rows = (windowRows ?? []) as any[];
      const candidates = phone10
        ? rows.filter((r) => !r.kixie_link && (phoneDigits(r.caller_phone) ?? '').slice(-10) === phone10)
        : [];
      if (candidates.length === 1) {
        linkRow = candidates[0];
        linked = 'fallback';
        researchCallHandled = true;
      } else if (rows.length > 0) {
        notesSuffix = ' | unlinked';
      }
    }

    // --- Create research_calls row first (so booking can link to it) ---
    if (matchedCampaignId && !researchCallHandled) {
      const { data: rc, error: rcErr } = await researchCallInsert();
      if (rcErr) {
        // Non-fatal: log and proceed without linkage so we don't lose the submission.
        console.error('[submit] research_calls insert failed:', rcErr.message);
      } else {
        researchCallId = rc.id;
      }
    }

    // --- LINK: attach this recording to the form row (guarded against a second recording) ---
    let linkedBookingId: string | null = null;
    if (linkRow) {
      const { data: u, error: uErr } = await adminClient
        .from('research_calls')
        .update({
          kixie_link: audioUrl,
          ...(linkRow.caller_phone == null ? { caller_phone: phoneNumber } : {}),
          ...(linkRow.dialer_lead_id == null && leadId ? { dialer_lead_id: leadId } : {}),
          ...(linkRow.dialer_agent_user == null ? { dialer_agent_user: dialerAgentUser.slice(0, 64) } : {}),
        })
        .eq('id', linkRow.id)
        .is('kixie_link', null)
        .select('id');
      if (uErr) {
        console.error('[submit] link update failed:', uErr.message);
        return new Response(JSON.stringify({ error: 'Failed to store record' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!u || u.length === 0) return await respondDuplicate(linkRow.id);
      researchCallId = linkRow.id;

      const { data: eb } = await adminClient
        .from('bookings')
        .select('id, notes, contact_phone')
        .eq('research_call_id', linkRow.id)
        .limit(1)
        .maybeSingle();
      if (eb) {
        const { data: bu, error: buErr } = await adminClient
          .from('bookings')
          .update({
            agent_id: agent.id,
            kixie_link: audioUrl,
            ...(eb.contact_phone ? {} : { contact_phone: phoneNumber }),
            booking_date: today,
            move_in_date: today,
            call_started_at: callStart.startedAt.toISOString(),
            notes: eb.notes ? `${eb.notes} | API Submission (linked)` : 'API Submission (linked)',
          })
          .eq('id', eb.id)
          .is('kixie_link', null)
          .select('id');
        if (buErr) {
          console.error('[submit] linked booking update failed:', buErr.message);
          return new Response(JSON.stringify({ error: 'Failed to store record' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!bu || bu.length === 0) return await respondDuplicate(linkRow.id);
        linkedBookingId = eb.id;
      }
    }

    // --- Insert booking record (research type) ---
    let booking: { id: string };
    if (linkedBookingId) {
      booking = { id: linkedBookingId };
    } else {
      const { data: inserted, error: bookingError } = await adminClient
        .from('bookings')
        .insert({
          member_name: 'API Submission - ' + phoneNumber,
          booking_type: 'Research',
          status: 'Research',
          record_type: 'research',
          agent_id: agent.id,
          booking_date: today,
          move_in_date: today,
          contact_phone: phoneNumber,
          kixie_link: audioUrl,
          notes: `Campaign: ${campaign} | Dialer Agent: ${dialerAgentUser} | API Submission${notesSuffix}`,
          communication_method: 'Phone',
          import_batch_id: 'api-submission',
          research_call_id: researchCallId,
          call_started_at: callStart.startedAt.toISOString(),
        })
        .select('id')
        .single();

      if (bookingError || !inserted) {
        console.error('Booking insert error:', bookingError);
        return new Response(JSON.stringify({ error: 'Failed to store record' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      booking = inserted;
    }

    // --- Insert audit record ---
    await adminClient.from('conversation_submissions').insert({
      audio_url: audioUrl,
      dialer_agent_user: dialerAgentUser,
      phone_number: phoneNumber,
      campaign,
      submission_type: type,
      matched_agent_id: agent.id,
      api_credential_id: credential.id,
      booking_id: booking.id,
    });

    // --- Stamp resolved campaign type onto booking_transcriptions (race-safe) ---
    // Use UPSERT keyed on booking_id so the stamp lands whether or not the
    // auto-transcription PG trigger has already created the row. Only the two
    // routing columns are in the payload — PostgREST's generated
    // ON CONFLICT DO UPDATE clause therefore only mutates those columns and
    // preserves every other field on an existing row.
    if (resolvedCampaignType) {
      const { data: stampedRow, error: upsertErr } = await adminClient
        .from('booking_transcriptions')
        .upsert(
          {
            booking_id: booking.id,
            research_campaign_type: resolvedCampaignType,
            retag_source: 'script_id_route',
          },
          { onConflict: 'booking_id', ignoreDuplicates: false },
        )
        .select('id, booking_id, research_campaign_type, retag_source')
        .maybeSingle();
      if (upsertErr) {
        console.warn('[submit] booking_transcriptions stamp skipped:', upsertErr.message);
      } else {
        console.log('[submit] booking_transcriptions stamped:', JSON.stringify(stampedRow));
      }
    }

    // --- Audit log ---
    await adminClient.from('access_logs').insert({
      action: 'api_conversation_submitted',
      resource: `conversation_submissions:${booking.id}`,
      user_name: 'API: ' + clientId,
    });

    return new Response(JSON.stringify({
      success: true,
      bookingId: booking.id,
      researchCallId,
      resolvedCampaignType,
      callDate: callStart.date,
      callStartedAt: callStart.startedAt.toISOString(),
      callDateSource: callStart.source,
      matchedAgent: { id: agent.id, name: agent.name },
      linked,
    }), {
      status: 201, headers: {
        ...corsHeaders, 'Content-Type': 'application/json',
        ...(rateRemaining !== null ? { 'X-RateLimit-Remaining': String(rateRemaining) } : {}),
      },
    });

  } catch (err) {
    console.error('submit-conversation-audio error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
