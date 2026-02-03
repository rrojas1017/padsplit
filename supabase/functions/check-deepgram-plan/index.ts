import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepgramProject {
  project_id: string;
  name: string;
  company?: string;
}

interface DeepgramBalance {
  balance_id: string;
  amount: number;
  units: string;
  purchase?: string;
}

interface UsageBreakdownResult {
  hours: number;
  total_hours: number;
  requests: number;
  grouping?: {
    models?: string;
    start?: string;
    end?: string;
  };
}

interface UsageBreakdownResponse {
  start: string;
  end: string;
  resolution: { units: string; amount: number };
  results: UsageBreakdownResult[];
}

interface BillingBreakdownResult {
  dollars: number;
  grouping?: {
    start?: string;
    end?: string;
    line_item?: string;
    deployment?: string;
  };
}

interface BillingBreakdownResponse {
  start: string;
  end: string;
  resolution: { units: string; amount: number };
  results: BillingBreakdownResult[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    const DEEPGRAM_PROJECT_ID = Deno.env.get('DEEPGRAM_PROJECT_ID');
    
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    let projectId = DEEPGRAM_PROJECT_ID;
    let projects: DeepgramProject[] = [];

    // If no explicit project ID, try to discover projects
    if (!projectId) {
      console.log('No DEEPGRAM_PROJECT_ID set, attempting auto-discovery...');
      const projectsResponse = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!projectsResponse.ok) {
        const errorText = await projectsResponse.text();
        if (projectsResponse.status === 401) {
          throw new Error('Invalid or expired Deepgram API key');
        }
        if (projectsResponse.status === 403) {
          throw new Error('API key lacks management permissions. Set DEEPGRAM_PROJECT_ID manually or use a key with "member" access.');
        }
        throw new Error(`Deepgram API error: ${projectsResponse.status} - ${errorText}`);
      }

      const projectsData = await projectsResponse.json();
      projects = projectsData.projects || [];
      
      if (projects.length > 0) {
        projectId = projects[0].project_id;
        console.log(`Auto-discovered project: ${projects[0].name} (${projectId})`);
      }
    } else {
      console.log(`Using configured DEEPGRAM_PROJECT_ID: ${projectId}`);
    }

    if (!projectId) {
      throw new Error('No Deepgram project found. Please set DEEPGRAM_PROJECT_ID secret.');
    }

    // Fetch balances for the project
    let balances: DeepgramBalance[] = [];
    let balanceError: string | null = null;
    
    try {
      const balancesResponse = await fetch(
        `https://api.deepgram.com/v1/projects/${projectId}/balances`,
        {
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json();
        balances = (balancesData.balances || []).map((b: DeepgramBalance) => ({
          balance_id: b.balance_id,
          amount: b.amount,
          units: b.units,
          purchase: b.purchase,
        }));
      } else if (balancesResponse.status === 403) {
        balanceError = 'API key lacks permission to view balances';
        console.log('Balance fetch returned 403 - permission denied');
      } else {
        balanceError = `Failed to fetch balances: ${balancesResponse.status}`;
      }
    } catch (error) {
      balanceError = error instanceof Error ? error.message : 'Unknown error fetching balances';
    }

    // Date range for current month
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];

    // Fetch usage breakdown for current month
    let usage: {
      period: { start: string; end: string };
      total_hours: number;
      total_requests: number;
      estimated_cost_usd: number;
      breakdown_by_model: { model: string; hours: number; requests: number }[];
    } | null = null;
    let usageError: string | null = null;

    try {
      console.log(`Fetching usage breakdown from ${startOfMonth} to ${today}...`);
      const usageResponse = await fetch(
        `https://api.deepgram.com/v1/projects/${projectId}/usage/breakdown?start=${startOfMonth}&end=${today}&grouping=models`,
        {
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (usageResponse.ok) {
        const usageData: UsageBreakdownResponse = await usageResponse.json();
        console.log('Usage data received:', JSON.stringify(usageData, null, 2));
        
        let totalHours = 0;
        let totalRequests = 0;
        const breakdownByModel: { model: string; hours: number; requests: number }[] = [];

        for (const result of usageData.results || []) {
          totalHours += result.hours || 0;
          totalRequests += result.requests || 0;
          
          if (result.grouping?.models) {
            breakdownByModel.push({
              model: result.grouping.models,
              hours: result.hours || 0,
              requests: result.requests || 0,
            });
          }
        }

        // Deepgram Nova-2 pricing: $0.0043/minute = $0.258/hour
        const estimatedCost = totalHours * 0.258;

        usage = {
          period: { start: startOfMonth, end: today },
          total_hours: Math.round(totalHours * 1000) / 1000,
          total_requests: totalRequests,
          estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
          breakdown_by_model: breakdownByModel,
        };
      } else if (usageResponse.status === 403) {
        usageError = 'API key lacks permission to view usage breakdown';
        console.log('Usage fetch returned 403 - permission denied');
      } else {
        const errorText = await usageResponse.text();
        usageError = `Failed to fetch usage: ${usageResponse.status} - ${errorText}`;
        console.error(usageError);
      }
    } catch (error) {
      usageError = error instanceof Error ? error.message : 'Unknown error fetching usage';
      console.error('Usage fetch error:', usageError);
    }

    // Fetch billing breakdown for current month (actual costs)
    let billing: {
      period: { start: string; end: string };
      total_cost_usd: number;
      breakdown_by_line_item: { line_item: string; dollars: number }[];
    } | null = null;
    let billingError: string | null = null;

    try {
      console.log(`Fetching billing breakdown from ${startOfMonth} to ${today}...`);
      const billingResponse = await fetch(
        `https://api.deepgram.com/v1/projects/${projectId}/billing/breakdown?start=${startOfMonth}&end=${today}&grouping=line_item`,
        {
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (billingResponse.ok) {
        const billingData: BillingBreakdownResponse = await billingResponse.json();
        console.log('Billing data received:', JSON.stringify(billingData, null, 2));
        
        let totalCost = 0;
        const breakdownByLineItem: { line_item: string; dollars: number }[] = [];

        for (const result of billingData.results || []) {
          totalCost += result.dollars || 0;
          
          if (result.grouping?.line_item) {
            breakdownByLineItem.push({
              line_item: result.grouping.line_item,
              dollars: Math.round(result.dollars * 100) / 100,
            });
          }
        }

        billing = {
          period: { start: billingData.start || startOfMonth, end: billingData.end || today },
          total_cost_usd: Math.round(totalCost * 100) / 100,
          breakdown_by_line_item: breakdownByLineItem,
        };
      } else if (billingResponse.status === 403) {
        billingError = 'API key lacks permission to view billing breakdown';
        console.log('Billing fetch returned 403 - permission denied');
      } else {
        const errorText = await billingResponse.text();
        billingError = `Failed to fetch billing: ${billingResponse.status} - ${errorText}`;
        console.error(billingError);
      }
    } catch (error) {
      billingError = error instanceof Error ? error.message : 'Unknown error fetching billing';
      console.error('Billing fetch error:', billingError);
    }

    // Calculate total credits
    let totalCredits = 0;
    let creditUnits = 'USD';
    for (const balance of balances) {
      if (balance.units === 'usd' || balance.units === 'USD') {
        totalCredits += balance.amount;
        creditUnits = 'USD';
      }
    }

    // Build pricing note - prioritize actual billing over estimates
    let pricingNote = '';
    if (totalCredits > 0) {
      pricingNote = `✅ Account has $${totalCredits.toFixed(2)} ${creditUnits} credits remaining.`;
    } else if (balanceError) {
      pricingNote = `⚠️ Could not check credits (${balanceError}). Account may be pay-as-you-go.`;
    } else {
      pricingNote = '⚠️ No credit balance found. Account is on pay-as-you-go billing.';
    }
    
    // Prioritize actual billing data over estimated cost
    if (billing && usage) {
      pricingNote += ` This month: ${usage.total_hours.toFixed(3)} hours processed ($${billing.total_cost_usd.toFixed(2)} actual).`;
    } else if (billing) {
      pricingNote += ` This month: $${billing.total_cost_usd.toFixed(2)} actual cost.`;
    } else if (usage) {
      pricingNote += ` This month: ${usage.total_hours.toFixed(3)} hours processed (~$${usage.estimated_cost_usd.toFixed(2)} estimated).`;
    }

    console.log('Deepgram plan check complete');

    return new Response(JSON.stringify({
      success: true,
      key_type: 'api_key',
      project_id: projectId,
      projects: projects.length > 0 ? projects.map(p => ({
        project_id: p.project_id,
        name: p.name,
        company: p.company,
      })) : [{ project_id: projectId, name: 'Configured Project' }],
      balances,
      usage,
      billing,
      summary: {
        total_projects: projects.length || 1,
        total_credits: totalCredits,
        credit_units: creditUnits,
      },
      errors: {
        balance_error: balanceError,
        usage_error: usageError,
        billing_error: billingError,
      },
      pricing_note: pricingNote,
      stt_pricing: {
        model: 'Nova-2',
        rate_per_minute: 0.0043,
        rate_per_hour: 0.258,
        currency: 'USD',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error checking Deepgram plan:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
