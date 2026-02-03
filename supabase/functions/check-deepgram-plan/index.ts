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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    // Step 1: List all projects to discover project IDs
    console.log('Fetching Deepgram projects...');
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
        throw new Error('API key lacks management permissions. Ensure the key has "member" or higher access.');
      }
      
      throw new Error(`Deepgram API error: ${projectsResponse.status} - ${errorText}`);
    }

    const projectsData = await projectsResponse.json();
    const projects: DeepgramProject[] = projectsData.projects || [];
    
    console.log(`Found ${projects.length} Deepgram project(s)`);

    // Step 2: For each project, fetch balances
    const projectsWithBalances = await Promise.all(
      projects.map(async (project) => {
        try {
          console.log(`Fetching balances for project: ${project.name} (${project.project_id})`);
          
          const balancesResponse = await fetch(
            `https://api.deepgram.com/v1/projects/${project.project_id}/balances`,
            {
              headers: {
                'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!balancesResponse.ok) {
            console.error(`Failed to fetch balances for ${project.project_id}: ${balancesResponse.status}`);
            return {
              project_id: project.project_id,
              name: project.name,
              company: project.company,
              balances: [],
              error: `Failed to fetch balances: ${balancesResponse.status}`,
            };
          }

          const balancesData = await balancesResponse.json();
          const balances: DeepgramBalance[] = balancesData.balances || [];

          return {
            project_id: project.project_id,
            name: project.name,
            company: project.company,
            balances: balances.map((b) => ({
              balance_id: b.balance_id,
              amount: b.amount,
              units: b.units,
              purchase: b.purchase,
            })),
          };
        } catch (error) {
          console.error(`Error fetching balances for ${project.project_id}:`, error);
          return {
            project_id: project.project_id,
            name: project.name,
            company: project.company,
            balances: [],
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Calculate total credits across all projects
    let totalCredits = 0;
    let creditUnits = 'USD';
    
    for (const project of projectsWithBalances) {
      for (const balance of project.balances) {
        if (balance.units === 'usd' || balance.units === 'USD') {
          totalCredits += balance.amount;
          creditUnits = 'USD';
        }
      }
    }

    // Determine pricing note based on available info
    const pricingNote = totalCredits > 0
      ? `✅ Account has $${totalCredits.toFixed(2)} ${creditUnits} credits remaining. Current STT rate: $0.0043/min (Nova-2)`
      : '⚠️ No credit balance found. Account may be on pay-as-you-go or credits depleted.';

    console.log('Deepgram plan check complete');

    return new Response(JSON.stringify({
      success: true,
      key_type: 'api_key',
      projects: projectsWithBalances,
      summary: {
        total_projects: projects.length,
        total_credits: totalCredits,
        credit_units: creditUnits,
      },
      pricing_note: pricingNote,
      stt_pricing: {
        model: 'Nova-2',
        rate_per_minute: 0.0043,
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
