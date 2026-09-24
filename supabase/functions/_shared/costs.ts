// Single price list + cost logger for all edge functions.
// Prices as of 2026-09-23, USD.

// deno-lint-ignore no-explicit-any
type AdminClient = any;

interface LlmPrice { in: number; out: number; inLong?: number; outLong?: number; longThreshold?: number }

export const PRICES = {
  llm: {
    'google/gemini-2.5-pro': { in: 1.25, out: 10, inLong: 2.5, outLong: 15, longThreshold: 200_000 },
    'google/gemini-2.5-flash': { in: 0.30, out: 2.50 },
    'google/gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
    'google/gemini-3-flash-preview': { in: 0.50, out: 3.00 },
    'openai/gpt-5': { in: 1.25, out: 10 },
    'deepseek-v4-flash': { in: 0.30, out: 1.20 },
    'deepseek-chat': { in: 0.30, out: 1.20 },
    'deepseek-flash': { in: 0.30, out: 1.20 },
  } as Record<string, LlmPrice>,
  stt_per_minute: {
    deepgram_nova2: 0.0043,
    deepgram_nova3: 0.0043,
    elevenlabs_scribe: 0.22 / 60,
  } as Record<string, number>,
  tts_per_char: {
    eleven_turbo_v2: 0.00005,
    eleven_flash_v2_5: 0.00005,
    eleven_multilingual_v2: 0.0001,
  } as Record<string, number>,
};

const DEFAULT_LLM = 'google/gemini-2.5-pro';

function gatewayMultiplier(): number {
  const n = Number(Deno.env.get('GATEWAY_MULTIPLIER') ?? '1');
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function findLlmPrice(model: string | undefined | null, providerHint?: string): { key: string; price: LlmPrice } {
  const m = (model || '').trim();
  if (m && PRICES.llm[m]) return { key: m, price: PRICES.llm[m] };
  const tail = m.includes('/') ? m.split('/').pop()! : m;
  if (tail) {
    for (const [k, p] of Object.entries(PRICES.llm)) {
      const kt = k.includes('/') ? k.split('/').pop()! : k;
      if (kt === tail) return { key: k, price: p };
    }
  }
  // DeepSeek models never fall back to the Gemini Pro price.
  if (m.toLowerCase().startsWith('deepseek') || providerHint === 'deepseek') {
    return { key: 'deepseek-v4-flash', price: PRICES.llm['deepseek-v4-flash'] };
  }
  return { key: DEFAULT_LLM, price: PRICES.llm[DEFAULT_LLM] };
}

export function llmCost(model: string | undefined | null, inTok: number, outTok: number, providerHint?: string): number {
  const { key, price } = findLlmPrice(model, providerHint);
  const i = Math.max(0, Number(inTok) || 0);
  const o = Math.max(0, Number(outTok) || 0);
  const long = price.longThreshold !== undefined && i > price.longThreshold;
  const inRate = long && price.inLong !== undefined ? price.inLong : price.in;
  const outRate = long && price.outLong !== undefined ? price.outLong : price.out;
  let cost = (i / 1_000_000) * inRate + (o / 1_000_000) * outRate;
  if (!key.startsWith('deepseek')) cost *= gatewayMultiplier();
  return cost;
}

export function sttCost(provider: string, model: string | undefined | null, seconds: number): number {
  const m = (model || '').toLowerCase();
  let rate: number;
  if (m.includes('nova-3') || m.includes('nova3')) rate = PRICES.stt_per_minute.deepgram_nova3;
  else if (m.includes('nova')) rate = PRICES.stt_per_minute.deepgram_nova2;
  else if (m.includes('scribe')) rate = PRICES.stt_per_minute.elevenlabs_scribe;
  else rate = provider === 'deepgram' ? PRICES.stt_per_minute.deepgram_nova2 : PRICES.stt_per_minute.elevenlabs_scribe;
  return (Math.max(0, Number(seconds) || 0) / 60) * rate;
}

export function ttsCost(model: string | undefined | null, chars: number): number {
  const rate = PRICES.tts_per_char[(model || '').trim()] ?? PRICES.tts_per_char.eleven_turbo_v2;
  return Math.max(0, Number(chars) || 0) * rate;
}

export interface TokenCount { inputTokens: number; outputTokens: number; source: 'usage' | 'estimate' }

// deno-lint-ignore no-explicit-any
export function tokensFromUsage(json: any, promptText: string, outText: string): TokenCount {
  const u = json?.usage;
  const p = u?.prompt_tokens, c = u?.completion_tokens;
  if (typeof p === 'number' && typeof c === 'number') {
    return { inputTokens: p, outputTokens: c, source: 'usage' };
  }
  return {
    inputTokens: Math.ceil((promptText || '').length / 4),
    outputTokens: Math.ceil((outText || '').length / 4),
    source: 'estimate',
  };
}

export type CostProvider = 'elevenlabs' | 'lovable_ai' | 'deepgram' | 'deepseek';

export interface CostRow {
  service_provider: CostProvider;
  service_type: string;
  edge_function: string;
  booking_id?: string | null;
  agent_id?: string | null;
  site_id?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  audio_duration_seconds?: number;
  character_count?: number;
  model?: string;
  token_source?: 'usage' | 'estimate';
  // deno-lint-ignore no-explicit-any
  metadata?: Record<string, any>;
  triggered_by_user_id?: string | null;
  is_internal?: boolean;
}

const ALLOWED: CostProvider[] = ['elevenlabs', 'lovable_ai', 'deepgram', 'deepseek'];

export function computeCost(row: CostRow): number {
  const model = row.model ?? row.metadata?.model ?? row.metadata?.model_id;
  if (row.service_provider === 'lovable_ai' || row.service_provider === 'deepseek') {
    return llmCost(model || (row.service_provider === 'deepseek' ? 'deepseek-v4-flash' : undefined),
      row.input_tokens || 0, row.output_tokens || 0, row.service_provider);
  }
  let cost = 0;
  if (row.audio_duration_seconds) cost += sttCost(row.service_provider, model, row.audio_duration_seconds);
  if (row.character_count) cost += ttsCost(row.metadata?.model_id ?? model, row.character_count);
  return cost;
}

/** Awaitable, never throws. */
export async function logApiCost(admin: AdminClient, row: CostRow): Promise<void> {
  try {
    if (!ALLOWED.includes(row.service_provider)) {
      console.error('[Cost] Invalid service_provider, skipped');
      return;
    }
    const cost = computeCost(row);
    const model = row.model ?? row.metadata?.model ?? row.metadata?.model_id ?? null;
    const metadata = {
      ...(row.metadata || {}),
      model,
      token_source: row.token_source ?? row.metadata?.token_source ??
        (row.input_tokens || row.output_tokens ? 'estimate' : null),
    };
    const { error } = await admin.from('api_costs').insert({
      service_provider: row.service_provider,
      service_type: row.service_type,
      edge_function: row.edge_function,
      booking_id: row.booking_id || null,
      agent_id: row.agent_id || null,
      site_id: row.site_id || null,
      input_tokens: row.input_tokens ?? null,
      output_tokens: row.output_tokens ?? null,
      audio_duration_seconds: row.audio_duration_seconds ?? null,
      character_count: row.character_count ?? null,
      estimated_cost_usd: cost,
      metadata,
      triggered_by_user_id: row.triggered_by_user_id || null,
      is_internal: row.is_internal || false,
    });
    if (error) console.error('[Cost] Insert failed:', error.message);
    else console.log(`[Cost] ${row.service_provider} ${row.service_type}: $${cost.toFixed(6)}`);
  } catch (e) {
    console.error('[Cost] Failed to log API cost:', e instanceof Error ? e.message : 'unknown');
  }
}
