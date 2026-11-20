# CR-021 Phase A: prompt revision and re-run (dry run only)

## Change (one file)
In `supabase/functions/_shared/otherDetail.ts`, only the system prompt text (`SYSTEM`) changes. The new rules:
1. Keep the caller's own words, but remove filler and stutters ("Mhmm", "I- I", "you know", repeated words, "Yeah, pretty much"). Don't change the meaning or add words.
2. Return null when the caller:
   - only asks for clarification ("What do you mean…")
   - makes small talk or agrees vaguely
   - gives no real answer to that question
3. Keep a short answer when the caller explains why none of the listed options fits, for example "haven't booked yet — none available in my area" or "never paid an application fee".
4. Prefer one sentence of at most 160 characters. The existing 200-character safety cap in the code stays.

The existing rules stay as they are:
- no agent words and no interpretation
- keep the transcript's language
- no names, phone numbers, emails or addresses
- JSON-only reply

## Run
1. Redeploy `fill-other-details`.
2. Call it with `dry_run: true` on exactly the same 10 bookings: 71405cd3, bf75d080, 4a5e924d, 726e27f5, a512d7b1, ba647879, 349e8bfc, 5ac0fc42, f327a3a9, ee48fe8f.
3. Reply with the same table plus a "Previous run" column, and the tokens and cost.
4. Confirm the 10 calls are unchanged and there are 0 cost rows from this function.

## Not changing
Every other file, the database and the published site.
