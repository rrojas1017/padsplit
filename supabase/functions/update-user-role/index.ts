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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth to verify they're a super_admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is super_admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super admins can change user roles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, newRole, siteId } = await req.json();

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-role change
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot change your own role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'supervisor', 'agent'];
    if (!newRole || !validRoles.includes(newRole)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be one of: super_admin, admin, supervisor, agent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate site_id for supervisor/agent roles
    if ((newRole === 'supervisor' || newRole === 'agent') && !siteId) {
      return new Response(
        JSON.stringify({ error: 'Site ID is required for supervisor and agent roles' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (siteId && !uuidRegex.test(siteId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid site ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current role
    const { data: currentRoleData, error: currentRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (currentRoleError) {
      console.error('Error fetching current role:', currentRoleError);
      return new Response(
        JSON.stringify({ error: 'User not found or has no role' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previousRole = currentRoleData.role;

    // Update the role
    const { error: updateRoleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (updateRoleError) {
      console.error('Error updating role:', updateRoleError);
      return new Response(
        JSON.stringify({ error: 'Failed to update role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update site_id in profiles
    const profileUpdate: { site_id: string | null } = {
      site_id: (newRole === 'supervisor' || newRole === 'agent') ? siteId : null
    };

    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    if (updateProfileError) {
      console.error('Error updating profile site_id:', updateProfileError);
      // Don't fail the request, role was updated successfully
    }

    console.log(`Role updated: ${userId} from ${previousRole} to ${newRole}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        previousRole, 
        newRole,
        message: `Role changed from ${previousRole} to ${newRole}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in update-user-role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
