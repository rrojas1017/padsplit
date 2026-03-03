import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decode JWT to get user info (JWT is already verified by verify_jwt=true in config.toml)
function decodeJWT(token: string): { sub: string; email?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Extract the token and decode it (JWT is already verified by gateway)
    const token = authHeader.replace('Bearer ', '')
    const decoded = decodeJWT(token)

    if (!decoded || !decoded.sub) {
      console.log('Failed to decode JWT')
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestingUserId = decoded.sub
    const requestingUserEmail = decoded.email

    console.log(`Role change request from user ${requestingUserId} (${requestingUserEmail})`)

    // Service role client for privileged database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if requesting user is super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUserId)
      .single()

    console.log(`Requesting user role: ${roleData?.role}`)

    if (roleError || !roleData?.role || !['super_admin', 'admin'].includes(roleData.role)) {
      console.log('Permission denied - not a super_admin or admin')
      return new Response(
        JSON.stringify({ error: 'Only super admins and admins can change user roles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestingRole = roleData.role

    // Parse request body
    const { userId, newRole, siteId } = await req.json()

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-role change
    if (userId === requestingUserId) {
      return new Response(
        JSON.stringify({ error: 'Cannot change your own role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'supervisor', 'agent', 'researcher']
    if (!newRole || !validRoles.includes(newRole)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be one of: super_admin, admin, supervisor, agent, researcher' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate site_id for supervisor/agent roles
    if ((newRole === 'supervisor' || newRole === 'agent') && !siteId) {
      return new Response(
        JSON.stringify({ error: 'Site ID is required for supervisor and agent roles' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin-specific restrictions
    if (requestingRole === 'admin') {
      // Admins can only assign agent, supervisor, researcher
      if (['super_admin', 'admin'].includes(newRole)) {
        return new Response(
          JSON.stringify({ error: 'Admins can only assign agent, supervisor, or researcher roles' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (siteId && !uuidRegex.test(siteId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid site ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current role
    const { data: currentRoleData, error: currentRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (currentRoleError) {
      console.error('Error fetching current role:', currentRoleError)
      return new Response(
        JSON.stringify({ error: 'User not found or has no role' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const previousRole = currentRoleData.role

    // Block admins from changing roles of super_admin or admin users
    if (requestingRole === 'admin' && ['super_admin', 'admin'].includes(previousRole)) {
      return new Response(
        JSON.stringify({ error: 'Admins cannot change the role of super admins or other admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the role
    const { error: updateRoleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId)

    if (updateRoleError) {
      console.error('Error updating role:', updateRoleError)
      return new Response(
        JSON.stringify({ error: 'Failed to update role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For researcher role, auto-assign Vixicom site if no siteId provided
    let resolvedSiteId = siteId || null
    if (newRole === 'researcher' && !resolvedSiteId) {
      const { data: vixicomSite } = await supabaseAdmin
        .from('sites')
        .select('id')
        .ilike('name', '%vixicom%')
        .single()
      if (vixicomSite) {
        resolvedSiteId = vixicomSite.id
        console.log(`Auto-assigned Vixicom site ${resolvedSiteId} for researcher role`)
      }
    }

    // Update site_id in profiles
    const profileUpdate: { site_id: string | null } = {
      site_id: (newRole === 'supervisor' || newRole === 'agent' || newRole === 'researcher') ? resolvedSiteId : null
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)

    if (updateProfileError) {
      console.error('Error updating profile site_id:', updateProfileError)
      // Don't fail the request, role was updated successfully
    }

    // Get target user's info for audit log
    const { data: targetUserData } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    // Get requesting user's info for audit log
    const { data: requestingUserData } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', requestingUserId)
      .single()

    // Log the role change to access_logs
    const { error: logError } = await supabaseAdmin
      .from('access_logs')
      .insert({
        action: 'role_change',
        resource: `Changed role for ${targetUserData?.name || targetUserData?.email || userId} from ${previousRole} to ${newRole}`,
        user_id: requestingUserId,
        user_name: requestingUserData?.name || requestingUserEmail,
      })

    if (logError) {
      console.error('Error logging role change:', logError)
      // Don't fail the request, role was updated successfully
    }

    console.log(`Role updated: ${userId} from ${previousRole} to ${newRole} by ${requestingUserId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        previousRole, 
        newRole,
        message: `Role changed from ${previousRole} to ${newRole}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error in update-user-role:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
