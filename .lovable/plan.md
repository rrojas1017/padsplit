

## Switch API URL from Subdomain to Path-Based Structure

### Important Context

This is primarily an **infrastructure/DNS change**, not a code change. Here's why:

Supabase Edge Functions are hosted at a fixed URL:
```text
https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/...
```

Currently, `api.padsplit.tools` is a CNAME pointing to this Supabase URL, proxied through Cloudflare for SSL.

To serve from `padsplit.tools/api/...` instead, you need a **reverse proxy** (Cloudflare Worker or Page Rule) that intercepts requests to `padsplit.tools/api/*` and forwards them to the Supabase functions endpoint. This cannot be done from within Lovable alone — it requires Cloudflare configuration.

### Infrastructure Setup (Manual — Cloudflare)

1. Create a **Cloudflare Worker** on the `padsplit.tools` domain that matches `/api/*` and proxies to `https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/*`
2. Keep the existing `api.padsplit.tools` CNAME active so both URLs work simultaneously

Example Cloudflare Worker:
```text
Match: padsplit.tools/api/*
Rewrite: https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/*
Forward headers, preserve method/body
```

### Code Changes (After Proxy is Live)

Once the proxy is configured, update the documentation and Postman collection to show the new primary URL while keeping the old one as an alternative.

| # | File | Change |
|---|---|---|
| 1 | `src/pages/ApiDocs.tsx` | Update base URL to `https://padsplit.tools/api`, add note showing `api.padsplit.tools/functions/v1` as alternative |
| 2 | `src/utils/postmanCollection.ts` | Update `base_url` variable to `https://padsplit.tools/api` |

### Updated Documentation Will Show

```text
Primary:     https://padsplit.tools/api/submit-conversation-audio
Alternative: https://api.padsplit.tools/functions/v1/submit-conversation-audio
Direct:      https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/submit-conversation-audio
```

### Deployment Order

1. **First**: Set up the Cloudflare Worker proxy on `padsplit.tools` (manual, outside Lovable)
2. **Then**: I update the API docs and Postman collection to reflect the new URL structure
3. The old `api.padsplit.tools` subdomain stays active — no breaking change

### Note
Would you like me to proceed with the code changes now (updating docs to show the new URL), or do you want to set up the Cloudflare proxy first and then update?

