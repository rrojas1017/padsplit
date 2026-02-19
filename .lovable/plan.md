

## API Credentials Module + Public API Docs Page

### Overview
A new admin-only module for generating and managing API credentials (Client ID / Client Secret) for external integrations, plus a lightweight public API documentation page.

---

### 1. Database: `api_credentials` table

Create via migration:

- `id` UUID primary key
- `application_name` text, not null
- `client_id` text, unique, not null (cryptographically generated)
- `client_secret_hash` text, not null (bcrypt/SHA-256 hash -- never plaintext)
- `status` text, not null, default `'active'` (values: `active`, `revoked`, `expired`)
- `rate_limit` integer, nullable
- `last_used_at` timestamptz, nullable
- `expires_at` timestamptz, nullable
- `created_by` UUID, nullable (references the creating admin's user ID)
- `created_at` timestamptz, default `now()`
- `updated_at` timestamptz, default `now()`
- `deleted_at` timestamptz, nullable (soft delete)

RLS policies:
- SELECT/INSERT/UPDATE/DELETE restricted to `super_admin` and `admin` roles using `has_role()`
- Soft-deleted rows excluded from SELECT by default (`deleted_at IS NULL`)

Trigger: `update_updated_at_column` on UPDATE.

---

### 2. Edge Function: `manage-api-credentials`

A single edge function handling all operations via POST with an `action` field:

- **create**: Generates a cryptographically secure `client_id` (prefix `app_`) and `client_secret` (prefix `sk_`). Hashes the secret with SHA-256 before storing. Returns the plaintext secret exactly once.
- **revoke**: Sets `status = 'revoked'`, logs to `access_logs`.
- **regenerate**: Generates a new secret, hashes and stores it, returns the new plaintext secret once. Logs to `access_logs`.
- **delete**: Sets `deleted_at = now()` (soft delete). Logs to `access_logs`.

All actions verify the caller is `super_admin` or `admin` via JWT claims. All mutations are logged to the existing `access_logs` table with action like `api_credential_created`, `api_credential_revoked`, etc.

---

### 3. New Page: `src/pages/ApiCredentials.tsx`

Admin-only page at route `/api-credentials`.

**UI Components:**

- **Credentials Table**: Lists all non-deleted credentials with columns: Application Name, Client ID (copyable), Status badge (green/red/amber), Created At, Last Used, Expires At, Actions (Revoke/Regenerate/Delete).
- **Create Credential Dialog**: Form with Application Name (required), optional Expiration Date, optional Rate Limit. On submit, calls the edge function and shows the Secret Display Modal.
- **Secret Display Modal**: Shows the plaintext secret once with copy-to-clipboard, a prominent warning ("This secret will not be shown again"), and a confirmation checkbox before closing.
- **Confirmation Dialogs**: For revoke, regenerate, and delete actions with clear warnings.

---

### 4. New Page: `src/pages/ApiDocs.tsx`

Public (unauthenticated) page at route `/api-docs`.

- Clean, documentation-friendly layout (no sidebar, no auth required)
- Page title: "API Documentation"
- Placeholder sections: Authentication, Endpoints, Rate Limiting, Error Codes
- Easily extendable structure for future content

---

### 5. Routing and Navigation

**App.tsx changes:**
- Add protected route `/api-credentials` with `allowedRoles: ['super_admin', 'admin']`
- Add public route `/api-docs` (no ProtectedRoute wrapper)

**AppSidebar.tsx changes:**
- Add `{ icon: Key, label: 'API Credentials', path: '/api-credentials', roles: ['super_admin', 'admin'], group: 'admin' }` to the menu items array

---

### 6. Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `api_credentials` table with RLS |
| `supabase/functions/manage-api-credentials/index.ts` | New edge function |
| `supabase/config.toml` | Add `verify_jwt = false` for the new function |
| `src/pages/ApiCredentials.tsx` | New page with credentials table + dialogs |
| `src/pages/ApiDocs.tsx` | New public documentation page |
| `src/hooks/useApiCredentials.ts` | New hook for CRUD operations via edge function |
| `src/App.tsx` | Add two new routes |
| `src/components/layout/AppSidebar.tsx` | Add sidebar menu item |

---

### 7. Security Considerations

- Client secrets are SHA-256 hashed before storage; plaintext is never persisted
- Secrets displayed only once at creation/regeneration
- All credential lifecycle events are audit-logged
- RLS restricts table access to admin roles only
- Edge function validates JWT claims before any operation
- Soft delete preserves audit trail
- Rate limit field stored per credential for future enforcement

