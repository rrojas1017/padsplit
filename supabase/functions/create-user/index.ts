import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valid roles enum
const VALID_ROLES = ['super_admin', 'admin', 'supervisor', 'agent'] as const;
type ValidRole = typeof VALID_ROLES[number];

// Validation functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  return { valid: true };
}

function isValidRole(role: string): role is ValidRole {
  return VALID_ROLES.includes(role as ValidRole);
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidName(name: string): boolean {
  return name.length >= 1 && name.length <= 100;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create a client with the user's token to verify their role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser()
    if (userError || !requestingUser) {
      console.log('Unauthorized user attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role client to check if user has super_admin or admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: userRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single()

    if (!userRole || (userRole.role !== 'super_admin' && userRole.role !== 'admin')) {
      console.log(`Insufficient permissions for user ${requestingUser.id}`);
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      console.log('Invalid JSON in request body');
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, name, role, siteId, linkedAgentId } = requestBody;

    // Validate required fields exist
    if (!email || !password || !name || !role) {
      console.log('Missing required fields');
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, name, and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate email format
    if (typeof email !== 'string' || !isValidEmail(email)) {
      console.log(`Invalid email format: ${email}`);
      return new Response(JSON.stringify({ error: 'Invalid email format or email too long (max 255 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate password strength
    if (typeof password !== 'string') {
      console.log('Password must be a string');
      return new Response(JSON.stringify({ error: 'Password must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      console.log(`Password validation failed: ${passwordValidation.message}`);
      return new Response(JSON.stringify({ error: passwordValidation.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate name
    if (typeof name !== 'string' || !isValidName(name)) {
      console.log(`Invalid name: ${name}`);
      return new Response(JSON.stringify({ error: 'Name must be between 1 and 100 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate role
    if (typeof role !== 'string' || !isValidRole(role)) {
      console.log(`Invalid role: ${role}`);
      return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate siteId if provided
    if (siteId !== undefined && siteId !== null && siteId !== '') {
      if (typeof siteId !== 'string' || !isValidUUID(siteId)) {
        console.log(`Invalid siteId format: ${siteId}`);
        return new Response(JSON.stringify({ error: 'Invalid siteId format. Must be a valid UUID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Validate linkedAgentId if provided
    if (linkedAgentId !== undefined && linkedAgentId !== null && linkedAgentId !== '') {
      if (typeof linkedAgentId !== 'string' || !isValidUUID(linkedAgentId)) {
        console.log(`Invalid linkedAgentId format: ${linkedAgentId}`);
        return new Response(JSON.stringify({ error: 'Invalid linkedAgentId format. Must be a valid UUID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify the agent exists and has no user_id
      const { data: existingAgent, error: agentError } = await adminClient
        .from('agents')
        .select('id, user_id, name')
        .eq('id', linkedAgentId)
        .single();

      if (agentError || !existingAgent) {
        console.log(`Agent not found: ${linkedAgentId}`);
        return new Response(JSON.stringify({ error: 'Linked agent not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (existingAgent.user_id) {
        console.log(`Agent ${linkedAgentId} already has a user linked`);
        return new Response(JSON.stringify({ error: 'This agent is already linked to another user' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Only super_admin can create admin or super_admin users
    if ((role === 'super_admin' || role === 'admin') && userRole.role !== 'super_admin') {
      console.log(`User ${requestingUser.id} attempted to create ${role} without super_admin privileges`);
      return new Response(JSON.stringify({ error: 'Only super admins can create admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the user with admin API
    console.log(`Creating user with email: ${email}, role: ${role}`);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (createError) {
      console.log(`Error creating user: ${createError.message}`);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update the profile with site_id if provided
    if (siteId) {
      await adminClient
        .from('profiles')
        .update({ site_id: siteId })
        .eq('id', newUser.user.id)
    }

    // Create the user role
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role })

    if (roleError) {
      // Rollback: delete the created user if role creation fails
      console.log(`Error creating role, rolling back user: ${roleError.message}`);
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: 'Failed to assign role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle agent record creation/linking for agent role
    let createdAgentId: string | null = null;
    
    if (linkedAgentId) {
      // Link to existing agent
      const { error: linkError } = await adminClient
        .from('agents')
        .update({ user_id: newUser.user.id })
        .eq('id', linkedAgentId);

      if (linkError) {
        console.log(`Error linking agent: ${linkError.message}`);
      } else {
        console.log(`Successfully linked agent ${linkedAgentId} to user ${newUser.user.id}`);
        createdAgentId = linkedAgentId;
      }
    } else if (role === 'agent' && siteId) {
      // Auto-create new agent record for agent users
      const { data: newAgent, error: createAgentError } = await adminClient
        .from('agents')
        .insert({
          name: name,
          site_id: siteId,
          user_id: newUser.user.id,
          active: true
        })
        .select('id')
        .single();

      if (createAgentError) {
        console.log(`Warning: Failed to create agent record: ${createAgentError.message}`);
        // Don't rollback - user exists, admin can create agent manually
      } else {
        console.log(`Created new agent record ${newAgent.id} for user ${newUser.user.id}`);
        createdAgentId = newAgent.id;
      }
    }

    console.log(`Successfully created user ${newUser.user.id} with role ${role}`);
    return new Response(JSON.stringify({ 
      success: true, 
      user: { id: newUser.user.id, email: newUser.user.email },
      agentId: createdAgentId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Unexpected error in create-user function:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})