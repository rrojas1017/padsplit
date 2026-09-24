# SECURITY FIX P7 — Authorization on 5 user-facing AI/report functions

## Goal
These 5 edge functions are reachable today with just the public anon key (or,
for `persist-research-raw-answers`, any logged-in user regardless of role) and
each triggers paid Gemini calls or writes survey data. Add the shared
authorization guard right after the `OPTIONS` preflight, replacing each local
`corsHeaders` with the shared import from `_shared/auth.ts`. Keep request /
response shapes unchanged; only add `401`/`403`/`404`.

## Shared module used
`supabase/functions/_shared/auth.ts` exports: `corsHeaders`, `requireUser`,
`canSeeBooking`, and the role arrays `STAFF`, `MANAGERS`, `RESEARCH`. `requireUser`
resolves the JWT via `auth.getUser` (never `atob`), loads roles from
`user_roles` (highest wins), rejects no-role and inactive profiles, and returns
`{ ok, ctx }` where `ctx.userId`, `ctx.role` are available for the `user` kind.
`canSeeBooking(ctx, bookingId)` queries `bookings` via the caller's RLS-scoped
client and returns false when the caller cannot see the booking.

App callers already send the logged-in user's JWT through
`supabase.functions.invoke(...)`; no `src/**` changes are needed.

## config.toml
No changes. Existing values stay as-is, including
`persist-research-raw-answers` (`verify_jwt = false`) — the in-function
`requireUser` is the real guard, matching the P1 pattern.

---

## 1. generate-coaching-quiz — `requireUser(STAFF)` + `canSeeBooking`
Caller: `CoachingQuizModal.tsx` (agents on their own calls).

**Replace lines 1–7** (imports + local corsHeaders):
```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
with:
```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireUser, canSeeBooking, STAFF } from "../_shared/auth.ts";
```

**Insert after the OPTIONS block** (after line 19):
```ts
  const auth = await requireUser(req, STAFF);
  if (!auth.ok) return auth.response;
```

**Insert after the `quizType` validation block** (after line 36, before
`const supabaseUrl = ...`), using the booking the caller just supplied:
```ts
    const canSee = await canSeeBooking(auth.ctx, bookingId);
    if (!canSee) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
```

Everything else (transcription fetch, AI call, JSON parsing, responses) unchanged.

---

## 2. generate-executive-brief — `requireUser(MANAGERS)`
Caller: `generate-executive-docx.ts` / `generate-executive-pdf.ts` (report
exports on Research Insights — super_admin/admin/supervisor).

**Replace lines 1–7** (imports + local corsHeaders):
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```
with:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireUser, MANAGERS } from "../_shared/auth.ts";
```

**Insert after the OPTIONS block** (after line 24):
```ts
  const auth = await requireUser(req, MANAGERS);
  if (!auth.ok) return auth.response;
```

No other change.

---

## 3. generate-pe-executive-brief — `requireUser(MANAGERS)`
Caller: `generate-pe-docx.ts` (Payment Experience report export — managers).

**Replace lines 7–10** (local corsHeaders):
```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```
with:
```ts
import { corsHeaders, requireUser, MANAGERS } from "../_shared/auth.ts";
```
(import placed where the `const corsHeaders` block was; the top-of-file comment
lines 1–5 are untouched.)

**Insert after the OPTIONS line** (after line 44):
```ts
  const auth = await requireUser(req, MANAGERS);
  if (!auth.ok) return auth.response;
```

No other change.

---

## 4. generate-audience-survey-executive-brief — `requireUser(MANAGERS)`
Caller: `generateAudienceSurveyReport.ts` (Audience Survey report export — managers).

**Replace lines 3–6** (local corsHeaders):
```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```
with:
```ts
import { corsHeaders, requireUser, MANAGERS } from "../_shared/auth.ts";
```

**Insert after the OPTIONS line** (after line 27):
```ts
  const auth = await requireUser(req, MANAGERS);
  if (!auth.ok) return auth.response;
```

No other change.

---

## 5. persist-research-raw-answers — `requireUser(RESEARCH)` + researcher ownership check
Caller: `useResearchCalls.ts` `LogSurveyCall` (researchers and managers).

`RESEARCH = ["super_admin", "admin", "supervisor", "researcher"]`. Managers may
write any call. A `researcher` may only write a call whose
`research_calls.researcher_id === auth.ctx.userId`.

**Replace lines 7–12** (import + local corsHeaders):
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
with:
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireUser, RESEARCH } from '../_shared/auth.ts';
```

**Replace lines 18–36** (the manual `Authorization`/`getUser` block):
```ts
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
```
with:
```ts
    const auth = await requireUser(req, RESEARCH);
    if (!auth.ok) return auth.response;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
```

**Insert after the `raw_script_answers` validation block** (after line 49,
before the booking lookup at line 52) — researcher ownership check:
```ts
    if (auth.ctx.role === 'researcher') {
      const { data: rc, error: rcErr } = await admin
        .from('research_calls')
        .select('researcher_id')
        .eq('id', research_call_id)
        .maybeSingle();
      if (rcErr || !rc || rc.researcher_id !== auth.ctx.userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
```

Everything else (booking lookup, transcription merge, update, responses) unchanged.

---

## Out of scope
No changes to `src/**`, SQL, RLS, migrations, other functions, prompts, models,
timeouts, or cost logic. `config.toml` unchanged.

## Verification after implementation
Deploy the 5 functions, then anon-key `POST {}` each — expected `401 {"error":"Unauthorized"}` for all 5.
