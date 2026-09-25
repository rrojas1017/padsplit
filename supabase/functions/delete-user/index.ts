import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser, ADMINS } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const auth = await requireUser(req, ADMINS)
    if (!auth.ok) {
      const b = await auth.response.text()
      return new Response(b, { status: auth.response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const requestingUserId = auth.ctx.userId

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Service role client for privileged database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const roleData = { role: auth.ctx.role as string }

    if (!['super_admin', 'admin'].includes(roleData.role)) {
      console.log('User does not have admin privileges:', roleData.role)
      return new Response(
        JSON.stringify({ error: 'Insufficient privileges. Only super_admin or admin can delete users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid userId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-deletion
    if (userId === requestingUserId) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check target user's roles - admins cannot delete super_admins or other admins
    const { data: targetRoleRows, error: targetRoleErr } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    if (targetRoleErr) {
      console.error('Target role lookup failed:', targetRoleErr)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const targetRoles = (targetRoleRows || []).map((r: { role: string }) => r.role)

    if (targetRoles.includes('super_admin') && roleData.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super_admin can delete super_admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (roleData.role === 'admin' && targetRoles.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'Admins cannot delete other admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deleting user:', userId)

    // Delete user using admin client (cascades to profiles and user_roles)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user: ' + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully deleted user:', userId)

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
