
# IP Login Restriction for Agents

## Overview
Implement an IP allowlist feature that restricts agent login to approved office IP addresses only. Administrators can configure allowed IP addresses per site, and agents attempting to login from non-approved IPs will be blocked.

## Current System Analysis
- **4 user roles**: `super_admin`, `admin`, `supervisor`, `agent`
- **2 sites**: Vixicom (outsourced) and PadSplit Internal
- **Authentication**: Supabase Auth with edge functions for privileged operations
- **Existing IP tracking**: `access_logs` table already has an `ip_address` column

## Solution Architecture

```text
+-------------------+       +----------------------+       +------------------+
|   Login Page      |  -->  |  validate-login-ip   |  -->  |  ip_allowlists   |
|   (client)        |       |  (edge function)     |       |  (database)      |
+-------------------+       +----------------------+       +------------------+
        |                           |
        |                           v
        |                   +------------------+
        |                   | Check if:        |
        |                   | 1. User is agent |
        |                   | 2. IP is allowed |
        +------------------>| 3. Block/Allow   |
                            +------------------+
```

## Business Rules
1. **Agents only**: IP restrictions apply ONLY to agent role
2. **Super Admin/Admin/Supervisor**: Can login from anywhere (no restrictions)
3. **Site-based allowlists**: Each site can have its own set of allowed IPs
4. **Global allowlist**: Optional fallback for IPs that should work for all sites
5. **Graceful bypass**: If no IP allowlist is configured for a site, agents can login (prevents lockout)

---

## Technical Implementation

### 1. Database Schema

**New table: `ip_allowlists`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `site_id` | uuid | FK to sites (nullable for global IPs) |
| `ip_address` | text | Single IP or CIDR range (e.g., "192.168.1.0/24") |
| `description` | text | Label like "Main Office", "Remote Office" |
| `is_active` | boolean | Enable/disable without deleting |
| `created_by` | uuid | Who added this IP |
| `created_at` | timestamp | When added |

**RLS Policies**:
- `SELECT`: super_admin, admin (all), supervisor (own site only)
- `INSERT/UPDATE/DELETE`: super_admin, admin only

### 2. Edge Function: `validate-login-ip`

Called AFTER successful Supabase auth but BEFORE granting access.

```typescript
// Pseudocode flow:
1. Extract client IP from request headers
2. Get user's role from user_roles table
3. If role is NOT 'agent' → ALLOW (return success)
4. Get user's site_id from profiles
5. Query ip_allowlists for:
   - Entries matching site_id, OR
   - Global entries (site_id IS NULL)
6. If no allowlist entries exist for site → ALLOW (no restrictions configured)
7. Check if client IP matches any allowed IP/CIDR
8. If match → ALLOW; else → BLOCK with clear error message
```

### 3. Client-Side Integration (AuthContext)

Modify the login flow:

```typescript
// In login() function:
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (data.user) {
  // Validate IP restriction for agents
  const ipCheck = await supabase.functions.invoke('validate-login-ip');
  
  if (ipCheck.data?.blocked) {
    // Sign out immediately and show error
    await supabase.auth.signOut();
    return { 
      success: false, 
      error: 'Login not allowed from this location. Please contact your supervisor.' 
    };
  }
}
```

### 4. Admin UI - Settings Page

Add "Security" tab to Settings page (super_admin/admin only):

**Features**:
- View all configured IP allowlists grouped by site
- Add new IP addresses with description
- Edit/Delete existing entries
- Toggle active/inactive status
- Support for CIDR notation with validation
- "Test IP" button to verify if an IP would be allowed

### 5. Audit Logging

Log blocked login attempts to `access_logs`:
- `action`: "blocked_login_ip"
- `ip_address`: The rejected IP
- `resource`: Site name or user email

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_create_ip_allowlists.sql` | Create | New table + RLS |
| `supabase/functions/validate-login-ip/index.ts` | Create | IP validation logic |
| `src/contexts/AuthContext.tsx` | Modify | Add IP check to login flow |
| `src/pages/Settings.tsx` | Modify | Add Security tab |
| `src/components/security/IPAllowlistManager.tsx` | Create | UI for managing IPs |
| `supabase/config.toml` | Modify | Register new function |

---

## User Experience

**For Agents**:
- If logging in from office: Normal login experience
- If logging in from home: 
  - "Login not allowed from this location. Please contact your supervisor."
  - Login is immediately revoked

**For Admins**:
- New "Security" tab in Settings
- Easy-to-use table for managing allowed IPs
- Clear feedback on what IPs are configured per site

---

## Edge Cases Handled

1. **No IPs configured**: Agents can login (avoids lockout scenario)
2. **VPN users**: Admins can add VPN exit IP to allowlist
3. **Multiple offices**: Support for multiple IPs per site
4. **CIDR ranges**: Support for subnet notation (e.g., 10.0.0.0/8)
5. **IPv6**: Support for IPv6 addresses
6. **Proxy/Load Balancer**: Edge function checks `x-forwarded-for` header

---

## Security Considerations

- IP validation happens server-side in edge function (cannot be bypassed)
- Even if someone gets credentials, they can't login from unauthorized locations
- All blocked attempts are logged for security auditing
- Admins can quickly add/remove IPs in emergencies
