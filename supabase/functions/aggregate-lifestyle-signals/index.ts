import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is super_admin via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check role using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse date range from request body
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate } = body;

    // Fetch all booking_transcriptions with call_key_points containing lifestyleSignals
    // Join with bookings to get market info and dates
    let query = supabase
      .from('booking_transcriptions')
      .select('booking_id, call_key_points, bookings!inner(booking_date, market_city, market_state, agent_id, status, member_name)')
      .not('call_key_points', 'is', null);

    if (startDate) {
      query = query.gte('bookings.booking_date', startDate);
    }
    if (endDate) {
      query = query.lte('bookings.booking_date', endDate);
    }

    const { data: transcriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching transcriptions:', fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }

    // Aggregate lifestyle signals
    const categoryStats: Record<string, {
      count: number;
      signals: Array<{ signal: string; confidence: string; opportunity: string; bookingId: string; marketCity: string; marketState: string; date: string }>;
      marketBreakdown: Record<string, number>;
      monthlyTrend: Record<string, number>;
    }> = {};

    const allCategories = ['healthcare', 'pet', 'transportation', 'home_services', 'telephony', 'employment', 'financial', 'moving'];
    allCategories.forEach(cat => {
      categoryStats[cat] = { count: 0, signals: [], marketBreakdown: {}, monthlyTrend: {} };
    });

    let totalSignals = 0;
    let totalTranscriptionsWithSignals = 0;
    const totalTranscriptions = transcriptions?.length || 0;

    for (const t of transcriptions || []) {
      const keyPoints = t.call_key_points as any;
      const booking = t.bookings as any;
      const lifestyleSignals = keyPoints?.lifestyleSignals;
      
      if (!lifestyleSignals || !Array.isArray(lifestyleSignals) || lifestyleSignals.length === 0) continue;
      
      totalTranscriptionsWithSignals++;

      for (const signal of lifestyleSignals) {
        const category = signal.category?.toLowerCase?.();
        if (!category || !categoryStats[category]) continue;

        totalSignals++;
        categoryStats[category].count++;
        
        // Store signal details (limit to top 50 per category for response size)
        if (categoryStats[category].signals.length < 50) {
          categoryStats[category].signals.push({
            signal: signal.signal || '',
            confidence: signal.confidence || 'medium',
            opportunity: signal.opportunity || '',
            bookingId: t.booking_id,
            marketCity: booking?.market_city || 'Unknown',
            marketState: booking?.market_state || 'Unknown',
            date: booking?.booking_date || '',
          });
        }

        // Market breakdown
        const marketKey = `${booking?.market_city || 'Unknown'}, ${booking?.market_state || ''}`.trim();
        categoryStats[category].marketBreakdown[marketKey] = (categoryStats[category].marketBreakdown[marketKey] || 0) + 1;

        // Monthly trend
        const monthKey = booking?.booking_date?.substring(0, 7) || 'unknown'; // YYYY-MM
        categoryStats[category].monthlyTrend[monthKey] = (categoryStats[category].monthlyTrend[monthKey] || 0) + 1;
      }
    }

    // Sort categories by count descending
    const sortedCategories = Object.entries(categoryStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        topSignals: stats.signals.slice(0, 10),
        topMarkets: Object.entries(stats.marketBreakdown)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([market, count]) => ({ market, count })),
        monthlyTrend: Object.entries(stats.monthlyTrend)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ month, count })),
      }));

    return new Response(JSON.stringify({
      success: true,
      totalTranscriptions,
      totalTranscriptionsWithSignals,
      totalSignals,
      categories: sortedCategories,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
