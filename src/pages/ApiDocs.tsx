import { Key, Shield, Zap, AlertCircle, Code2, Send } from 'lucide-react';
import { ApiDocsLayout } from '@/components/api-docs/ApiDocsLayout';
import {
  DocSection,
  SectionHeader,
  MethodBadge,
  StatusBadge,
  CodeBlock,
  Callout,
  ParamTable,
  ResponseBlock,
} from '@/components/api-docs/ApiDocsComponents';

const NAV_ITEMS = [
  { id: 'introduction', label: 'Introduction', icon: Code2 },
  { id: 'authentication', label: 'Authentication', icon: Key },
  {
    id: 'endpoints',
    label: 'Endpoints',
    icon: Send,
    children: [{ id: 'submit-conversation-audio', label: 'Submit Conversation Audio' }],
  },
  { id: 'rate-limiting', label: 'Rate Limiting', icon: Zap },
  { id: 'errors', label: 'Error Codes', icon: AlertCircle },
];

export default function ApiDocs() {
  return (
    <ApiDocsLayout navItems={NAV_ITEMS}>
      {/* ── Introduction ── */}
      <DocSection id="introduction">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Code2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">API Reference</h1>
            <p className="mt-1 text-muted-foreground text-base">Appendify Operations Platform</p>
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          The Appendify Operations API lets external applications submit call data, booking records, and integration
          payloads into the platform. Use this reference to integrate your dialer, CRM, or automation tools.
        </p>

        <div className="mt-8">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Base URL</h3>
          <CodeBlock title="Base URL">{`https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1`}</CodeBlock>
          <p className="text-xs text-muted-foreground mt-2">All endpoint paths are relative to this base URL.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Auth', value: 'API Key + Secret' },
            { label: 'Format', value: 'application/json' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">{c.label}</p>
              <p className="text-sm font-medium text-foreground">{c.value}</p>
            </div>
          ))}
        </div>
      </DocSection>

      {/* ── Authentication ── */}
      <DocSection id="authentication">
        <SectionHeader
          title="Authentication"
          description="All API requests must include your Client ID and Client Secret in the request headers. Generate credentials from Admin → API Credentials."
        />

        <Callout variant="warning" icon={<Shield className="w-4 h-4" />}>
          Client secrets are shown <strong>only once</strong> at creation time. Store them securely — they cannot be retrieved later.
        </Callout>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-3">Include these headers with every request:</p>
          <CodeBlock title="Request Headers">{`X-Client-ID: app_your_client_id_here
X-Client-Secret: sk_your_client_secret_here`}</CodeBlock>
        </div>
      </DocSection>

      {/* ── Endpoints ── */}
      <DocSection id="endpoints">
        <SectionHeader title="Endpoints" />

        {/* Submit Conversation Audio */}
        <div id="submit-conversation-audio" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-2">
            <MethodBadge method="POST" />
            <code className="text-sm font-mono font-semibold text-foreground">/submit-conversation-audio</code>
            <StatusBadge status="live" />
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl mb-8">
            Submit conversation audio recordings from external dialer platforms. Records are stored for auditing and
            automatically appear in the Reports tab under the <strong className="text-foreground">Research</strong> category.
          </p>

          {/* Auth */}
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Authentication</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Requires <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">X-Client-ID</code> and{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">X-Client-Secret</code> headers.
          </p>

          {/* Request Body */}
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Request Body</h3>
          <ParamTable
            params={[
              { name: 'audioUrl', type: 'string', required: true, description: 'Publicly accessible URL to the audio recording.' },
              { name: 'dialerAgentUser', type: 'string', required: true, description: "Identifier of the agent in the external dialer system. Must match an agent's dialerAgentUser in the platform." },
              { name: 'phoneNumber', type: 'string', required: true, description: 'Customer phone number associated with the conversation.' },
              { name: 'campaign', type: 'string', required: true, description: 'Campaign name or identifier tied to the conversation.' },
              { name: 'type', type: 'string', required: true, description: 'Must be "research". Any other value is rejected.' },
            ]}
          />

          {/* Example Request */}
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mt-8 mb-3">Example Request</h3>
          <CodeBlock language="bash">{`curl -X POST \\
  https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/submit-conversation-audio \\
  -H "Content-Type: application/json" \\
  -H "X-Client-ID: app_your_client_id" \\
  -H "X-Client-Secret: sk_your_secret" \\
  -d '{
    "audioUrl": "https://storage.example.com/recordings/call-123.mp3",
    "dialerAgentUser": "agent_john_doe",
    "phoneNumber": "+14155551234",
    "campaign": "Q1-Research-2026",
    "type": "research"
  }'`}</CodeBlock>

          {/* Responses */}
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mt-8 mb-3">Responses</h3>
          <div className="space-y-6">
            <ResponseBlock status={201} label="Created">{`{
  "success": true,
  "bookingId": "uuid-of-created-record",
  "matchedAgent": {
    "id": "uuid-of-agent",
    "name": "John Doe"
  }
}`}</ResponseBlock>

            <ResponseBlock status={400} label="Validation failed">{`{
  "error": "Validation failed",
  "details": ["audioUrl is required", "type must be \\"research\\""]
}`}</ResponseBlock>

            <ResponseBlock status={401} label="Authentication failed">{`{ "error": "Unauthorized: invalid API credentials" }`}</ResponseBlock>

            <ResponseBlock status={400} label="Agent not found">{`{ "error": "Agent not found for dialerAgentUser: unknown_agent" }`}</ResponseBlock>
          </div>
        </div>
      </DocSection>

      {/* ── Rate Limiting ── */}
      <DocSection id="rate-limiting">
        <SectionHeader
          title="Rate Limiting"
          description="API credentials can be configured with per-credential rate limits. Requests exceeding the threshold receive a 429 response."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Default limit', value: 'No limit (unless configured)' },
            { label: 'Limit window', value: 'Per minute' },
            { label: 'Header', value: 'X-RateLimit-Remaining' },
            { label: 'Retry after', value: 'Retry-After header (seconds)' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </DocSection>

      {/* ── Error Codes ── */}
      <DocSection id="errors">
        <SectionHeader
          title="Error Codes"
          description="The API uses standard HTTP status codes. Error responses include a JSON body with a machine-readable code and human-readable message."
        />

        <CodeBlock title="Error Response Format">{`{
  "error": {
    "code": "invalid_credentials",
    "message": "The provided API key is invalid or has been revoked."
  }
}`}</CodeBlock>

        <div className="mt-6 rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { status: 200, code: 'ok', desc: 'Request succeeded.' },
                { status: 400, code: 'invalid_request', desc: 'Malformed request body or missing required fields.' },
                { status: 401, code: 'unauthorized', desc: 'Missing or invalid credentials.' },
                { status: 403, code: 'forbidden', desc: 'Credential does not have access to this resource.' },
                { status: 429, code: 'rate_limited', desc: 'Too many requests. Check Retry-After header.' },
                { status: 500, code: 'server_error', desc: 'Internal server error. Contact support if persistent.' },
              ].map(row => {
                const color = row.status < 300
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : row.status < 500
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                  : 'text-destructive bg-destructive/10';
                return (
                  <tr key={row.status} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3"><code className="text-xs text-muted-foreground font-mono">{row.code}</code></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{row.desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DocSection>
    </ApiDocsLayout>
  );
}
