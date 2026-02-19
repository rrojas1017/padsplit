
## Public External Script Links for Dialers & External Platforms

### What Is Being Built

Every research script needs a **publicly accessible, token-secured URL** that external systems (dialers like Kixie, Five9, NICE, etc.) can open in a browser during a call. The researcher or dialer system navigates to `https://padsplit.lovable.app/script/:token` and sees the full script in a **read-only, clean, print-friendly view** — no login required, no sidebar, just the script content.

This is modeled after the existing public wallboard pattern (`/display/:token` → `display_tokens` table → `validate-display-token` edge function), adapted for scripts.

---

### Architecture Overview

```text
Script Builder (admin)
  └─ Each script card gets a "Copy Link" button
  └─ Clicking generates a script_access_token (stored in DB)
  └─ Link = https://padsplit.lovable.app/script/:token

External dialer / browser
  └─ Opens /script/:token (no auth required)
  └─ Edge function validates token → returns script JSON
  └─ Clean read-only script view renders
```

---

### What Needs to Be Built

**1. Database Migration — `script_access_tokens` table**

A new table storing one or more public access tokens per script:

```sql
CREATE TABLE public.script_access_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   uuid NOT NULL REFERENCES public.research_scripts(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  label       text,                          -- e.g. "Kixie Dialer Link"
  is_active   boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,                   -- null = never expires
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz               -- track usage
);
```

RLS:
- Admins/super_admins: full CRUD
- Public (anon): no direct access — token validation happens via edge function using service role

**2. Edge Function — `validate-script-token`**

Mirrors `validate-display-token`. Receives a `token` string, validates it via service role, returns the full script JSON (name, intro, questions, sections, rebuttal, closing) so the public page can render it without exposing the database directly.

```typescript
// Input: { token: string }
// Output: { valid: true, script: { name, campaign_type, intro_script, questions, ... } }
//      or: { valid: false, error: "..." }
```

Also updates `last_accessed_at` on the token row so admins can see usage.

**3. Public Route — `/script/:token`**

A new route in `App.tsx` — **no `ProtectedRoute` wrapper** — that renders `PublicScriptView.tsx`.

The page:
- Calls `validate-script-token` with the token from the URL
- On valid: renders the full script in a clean, print-friendly layout (no sidebar, no nav)
- Shows: script name, campaign type badge, intro script, all questions grouped by section with probing follow-ups visible, rebuttal, closing
- On invalid/expired: shows a friendly error screen

**4. Script Card UI — "External Link" button**

On each card in `ScriptBuilder.tsx`, add a **Link icon button** next to the Play/Edit/Delete buttons. Clicking it:
- If no token exists for this script yet → calls a `generateToken` function → creates a row in `script_access_tokens` → copies the URL to clipboard
- If a token already exists → shows a small popover with the full URL, a "Copy" button, and a "Regenerate" option

The URL shown is: `https://padsplit.lovable.app/script/{token}`

A small `ExternalLink` badge also appears on each script card showing "Public Link Active" when a token exists, so admins have at-a-glance visibility.

**5. New Hook — `useScriptTokens`**

A hook that manages token CRUD for the Script Builder:
- `getTokenForScript(scriptId)` — fetches existing token if any
- `generateToken(scriptId, label?)` — inserts a new token row, returns the full URL
- `revokeToken(tokenId)` — sets `is_active = false`
- `regenerateToken(scriptId)` — revokes old + generates new (used when link is compromised)

---

### Files to Create / Modify

**Create:**
1. `supabase/functions/validate-script-token/index.ts` — Public edge function that validates token, fetches full script, updates `last_accessed_at`
2. `src/pages/PublicScriptView.tsx` — Clean public-facing script page (no auth required)
3. `src/hooks/useScriptTokens.ts` — CRUD hook for `script_access_tokens`
4. Database migration — `script_access_tokens` table + RLS

**Modify:**
5. `src/App.tsx` — Add `/script/:token` public route (no `ProtectedRoute` wrapper)
6. `src/pages/research/ScriptBuilder.tsx` — Add Link icon button to each script card, "Public Link Active" badge, copy-to-clipboard popover

---

### Public Script View Layout

The `/script/:token` page renders in a clean format optimized for viewing during a call:

```text
┌─────────────────────────────────────────┐
│  PadSplit Logo    [Script Name]  [Type]  │
├─────────────────────────────────────────┤
│  INTRO SCRIPT                           │
│  "Hello, my name is..."                 │
├─────────────────────────────────────────┤
│  SECTION 1: Root Cause Discovery        │
│  Q1. What was the main reason...?       │
│      ▼ Probing follow-ups               │
│        • Was there a specific moment?   │
│        • When did you first think...?   │
├─────────────────────────────────────────┤
│  SECTION 2: Transfer Exploration        │
│  Q2. Did you consider transferring?     │
│      YES → Ask: What prevented it?      │
│      NO  → Ask: Were you aware?         │
│  ...                                    │
├─────────────────────────────────────────┤
│  REBUTTAL SCRIPT                        │
│  "I understand..."                      │
├─────────────────────────────────────────┤
│  CLOSING SCRIPT                         │
│  "Thank you for your time..."           │
└─────────────────────────────────────────┘
```

Branching logic is shown inline under each yes/no question (not interactive — this is a static reference view). Section headers are bold with dividers. Internal-only questions are marked with a subtle "Internal" badge.

---

### Security Design

- Tokens are `base64url` encoded random bytes — not guessable
- Token validation is done server-side via edge function using service role — the client never touches the database directly
- `is_active` flag allows instant revocation without changing the URL (set active=false, link stops working immediately)
- `expires_at` allows time-limited links (e.g., for a campaign period)
- `last_accessed_at` provides audit visibility — admins can see if/when the link was used
- Only the script's public-safe fields are returned (no internal admin metadata)
- The edge function validates `is_active` and `expires_at` before returning anything

---

### No Change to Existing Auth System

The public script route uses the same pattern as `/display/:token` (PublicWallboard) — completely outside the `ProtectedRoute` system, validated by edge function, no cookies or sessions required.
