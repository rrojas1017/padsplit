
# IP Login Logging & History View

## Overview
Enhance the IP restriction feature to:
1. Log IP addresses for ALL logins (successful and blocked) via the edge function
2. Add a new "Login History" tab showing all IPs agents have logged in from
3. Provide quick "Add to Allowlist" action from the history view

## Current State
- `access_logs` table has `ip_address` column but it's NULL for all 475 existing records
- Client-side logging can't capture public IPs (only internal/localhost)
- Edge function (`validate-login-ip`) currently only logs blocked attempts
- IPAllowlistManager shows allowlist entries but no login history

## Solution

### 1. Update Edge Function to Log ALL Logins

Modify `validate-login-ip` to always record the IP address for every login attempt, including:
- Successful agent logins (with matched rule info)
- Non-agent logins (admins/supervisors/super_admins)
- Blocked attempts (already working)

This creates a comprehensive audit trail of who logged in from where.

### 2. Add Login History Panel

Create a new section in the Security tab showing recent login IPs:

| Agent | IP Address | Location | Status | Time | Action |
|-------|-----------|----------|--------|------|--------|
| Jose Garcia | 104.58.64.173 | - | Allowed | 2 min ago | + Add to Allowlist |
| Maria Lopez | 192.168.1.50 | Office Network | Allowed | 5 min ago | Already in list |
| Carlos Rivera | 98.76.54.32 | - | Blocked | 10 min ago | + Add to Allowlist |

Features:
- Filter by agent, site, or status (allowed/blocked)
- Group by unique IP to see which IPs are most common
- Quick "Add to Allowlist" button for IPs not yet approved
- Show if IP is already in the allowlist

### 3. Database Query View

Create a database view or query to aggregate login IPs:
- Distinct IPs per agent
- Login frequency per IP
- Last login timestamp
- Whether IP is in allowlist

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/validate-login-ip/index.ts` | Add logging for successful logins (not just blocked) |
| `src/components/security/IPAllowlistManager.tsx` | Add Login History section with IP table |

### Edge Function Changes

```typescript
// In validate-login-ip/index.ts

// Log ALL logins (not just blocked)
// After determining if login is allowed or blocked:

await supabaseAdmin
  .from('access_logs')
  .insert({
    user_id: userId,
    action: isAllowed ? 'login_ip_allowed' : 'blocked_login_ip',
    ip_address: clientIp,
    resource: JSON.stringify({
      role: userRole,
      site_id: siteId,
      matched_rule: matchedEntry?.description || matchedEntry?.ip_address || null,
      reason: isAllowed ? 'allowed' : (allowedIps.length === 0 ? 'no_restrictions' : 'ip_not_in_allowlist')
    }),
  });
```

### Login History Component

Add a new section to IPAllowlistManager:

```typescript
// New state for login history
const [loginHistory, setLoginHistory] = useState([]);
const [historyFilter, setHistoryFilter] = useState('all'); // all, allowed, blocked

// Fetch login history
const fetchLoginHistory = async () => {
  const { data } = await supabase
    .from('access_logs')
    .select(`
      id,
      user_id,
      ip_address,
      action,
      resource,
      created_at,
      profiles!user_id(name, email, site_id)
    `)
    .in('action', ['login', 'login_ip_allowed', 'blocked_login_ip'])
    .not('ip_address', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  
  setLoginHistory(data || []);
};

// Check if IP is already in allowlist
const isIpInAllowlist = (ip: string) => {
  return entries.some(e => e.ip_address === ip && e.is_active);
};

// Quick add to allowlist
const quickAddToAllowlist = async (ip: string, siteId: string) => {
  // Pre-fill form and open dialog
  setFormIpAddress(ip);
  setFormSiteId(siteId || 'global');
  setFormDescription(`Added from login history`);
  setIsDialogOpen(true);
};
```

### UI Layout

The Security tab will have two sections:

```text
┌─────────────────────────────────────────────────────────────────┐
│ IP Login Restrictions                                           │
│                                                                 │
│ [Current Allowlist Section - Already Implemented]               │
│ - Global IPs table                                              │
│ - Site-specific IPs table                                       │
│ - Add/Edit/Delete functionality                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Recent Login Activity                          [Refresh] 🔄     │
│                                                                 │
│ Filter: [All ▾] [Last 24 hours ▾]                              │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Agent         │ IP Address      │ Status  │ Time   │ Act │  │
│ │───────────────│─────────────────│─────────│────────│─────│  │
│ │ Jose Garcia   │ 104.58.64.173   │ ✓ Allow │ 2m ago │ +   │  │
│ │ Maria Lopez   │ 192.168.1.50    │ ✓ Allow │ 5m ago │ ✓   │  │
│ │ Carlos Rivera │ 98.76.54.32     │ ✗ Block │ 10m    │ +   │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ Unique IPs Summary                                              │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ 104.58.64.173 - 15 logins (last: 2m ago) - Not in list   │  │
│ │ 192.168.1.50  - 45 logins (last: 5m ago) - ✓ Office      │  │
│ │ 98.76.54.32   - 3 attempts (last: 10m)   - Blocked       │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```text
Agent Login
     │
     ▼
┌─────────────────────────┐
│ validate-login-ip       │
│ Edge Function           │
├─────────────────────────┤
│ 1. Extract client IP    │
│ 2. Check role           │
│ 3. Query allowlist      │
│ 4. Determine allow/deny │
│ 5. LOG to access_logs ◄─┼── NEW: Log ALL logins
│ 6. Return result        │
└─────────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ access_logs table       │
├─────────────────────────┤
│ - login_ip_allowed      │  ◄── NEW action type
│ - blocked_login_ip      │
│ - ip_address: captured  │
│ - resource: metadata    │
└─────────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Security Settings Tab   │
│ (Admin View)            │
├─────────────────────────┤
│ - View all login IPs    │
│ - Filter by status      │
│ - Quick-add to allowlist│
└─────────────────────────┘
```

---

## Benefits

1. **Visibility**: Admins can see exactly which IPs agents are using
2. **Easy Setup**: Review actual login IPs before creating allowlist rules
3. **Audit Trail**: Complete history of login locations for security review
4. **One-Click Add**: Quickly approve legitimate IPs from the history view
5. **Blocked Attempt Monitoring**: See when agents try to login from unauthorized locations
