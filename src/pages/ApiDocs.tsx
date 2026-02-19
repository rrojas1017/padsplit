import { Key, Shield, Zap, AlertCircle, BookOpen, Code2 } from 'lucide-react';

const Section = ({ id, title, icon: Icon, children }: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <section id={id} className="mb-12 scroll-mt-24">
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    </div>
    {children}
  </section>
);

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="bg-muted rounded-lg p-4 text-sm font-mono text-muted-foreground overflow-x-auto border border-border">
    <code>{children}</code>
  </pre>
);

const Badge = ({ children, variant = 'default' }: { children: string; variant?: 'default' | 'green' | 'amber' | 'red' }) => {
  const styles = {
    default: 'bg-muted text-muted-foreground',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-destructive/10 text-destructive',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function ApiDocs() {
  const navItems = [
    { id: 'authentication', label: 'Authentication' },
    { id: 'endpoints', label: 'Endpoints' },
    { id: 'submit-conversation-audio', label: 'Submit Conversation Audio' },
    { id: 'rate-limiting', label: 'Rate Limiting' },
    { id: 'error-codes', label: 'Error Codes' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">API Documentation</h1>
            <p className="text-xs text-muted-foreground">Appendify Operations Platform</p>
          </div>
          <div className="ml-auto">
            <Badge variant="amber">v1 · Preview</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">On this page</p>
            <nav className="space-y-1">
              {navItems.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground py-1 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Intro */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-foreground mb-3">API Reference</h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              The Appendify Operations API lets external applications submit call data, booking records, 
              and integration payloads into the platform. This documentation is a work in progress — 
              endpoint details will be added as the API is built out.
            </p>
          </div>

          <Section id="authentication" title="Authentication" icon={Key}>
            <p className="text-muted-foreground mb-4">
              All API requests must be authenticated using your <strong className="text-foreground">Client ID</strong> and{' '}
              <strong className="text-foreground">Client Secret</strong>. You can generate credentials from the{' '}
              <span className="text-primary font-medium">Admin → API Credentials</span> section of the dashboard.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Client secrets are shown only once at creation time. Store them securely — you cannot retrieve them later.
              </p>
            </div>
            <p className="text-muted-foreground mb-3">Include your credentials in the request header:</p>
            <CodeBlock>{`X-Client-ID: app_your_client_id_here
X-API-Key: sk_your_client_secret_here`}</CodeBlock>
            <p className="text-muted-foreground text-sm mt-3">
              Future versions will support HMAC request signing for enhanced security.
            </p>
          </Section>

          <Section id="endpoints" title="Endpoints" icon={Code2}>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-foreground">Base URL</p>
              </div>
              <div className="p-4">
                <CodeBlock>{`https://your-domain.com/api/v1`}</CodeBlock>
              </div>
            </div>
            <div className="mt-6 rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-3">
                <Badge variant="green">POST</Badge>
                <code className="text-sm text-foreground font-mono">/submit-conversation-audio</code>
                <Badge variant="green">Live</Badge>
              </div>
              <div className="p-4">
                <p className="text-sm text-muted-foreground">
                  Submit conversation audio recordings from external dialer systems for processing, transcription, and research reporting.
                </p>
              </div>
            </div>
          </Section>

          <Section id="submit-conversation-audio" title="Submit Conversation Audio" icon={Code2}>
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="green">POST</Badge>
                <code className="text-sm text-foreground font-mono">/submit-conversation-audio</code>
              </div>
              <p className="text-muted-foreground text-sm">
                Submit conversation audio recordings from external dialer platforms. Records are stored for auditing and automatically appear in the Reports tab under the <strong className="text-foreground">Research</strong> category.
              </p>
            </div>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Authentication</h3>
            <p className="text-muted-foreground text-sm mb-3">
              Requires <code className="text-sm bg-muted px-1.5 py-0.5 rounded">X-Client-ID</code> and{' '}
              <code className="text-sm bg-muted px-1.5 py-0.5 rounded">X-Client-Secret</code> headers.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Request Headers</h3>
            <CodeBlock>{`Content-Type: application/json
X-Client-ID: app_your_client_id_here
X-Client-Secret: sk_your_client_secret_here`}</CodeBlock>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Request Body</h3>
            <div className="rounded-lg border border-border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-foreground">Field</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground">Required</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { field: 'audioUrl', type: 'string', required: 'Yes', desc: 'Publicly accessible URL to the audio recording.' },
                    { field: 'dialerAgentUser', type: 'string', required: 'Yes', desc: 'Identifier of the agent in the external dialer system. Must match an agent\'s dialerAgentUser in the platform.' },
                    { field: 'phoneNumber', type: 'string', required: 'Yes', desc: 'Customer phone number associated with the conversation.' },
                    { field: 'campaign', type: 'string', required: 'Yes', desc: 'Campaign name or identifier tied to the conversation.' },
                    { field: 'type', type: 'string', required: 'Yes', desc: 'Must be "research". Any other value is rejected.' },
                  ].map(row => (
                    <tr key={row.field} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3"><code className="text-xs text-foreground">{row.field}</code></td>
                      <td className="px-4 py-3"><code className="text-xs text-muted-foreground">{row.type}</code></td>
                      <td className="px-4 py-3"><Badge variant="red">{row.required}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Example Request</h3>
            <CodeBlock>{`curl -X POST \\
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

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Success Response</h3>
            <p className="text-muted-foreground text-sm mb-2">
              <Badge variant="green">201</Badge> Created
            </p>
            <CodeBlock>{`{
  "success": true,
  "bookingId": "uuid-of-created-record",
  "matchedAgent": {
    "id": "uuid-of-agent",
    "name": "John Doe"
  }
}`}</CodeBlock>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">Error Responses</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1"><Badge variant="red">400</Badge> Validation failed</p>
                <CodeBlock>{`{
  "error": "Validation failed",
  "details": ["audioUrl is required", "type must be \\"research\\""]
}`}</CodeBlock>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1"><Badge variant="red">401</Badge> Authentication failed</p>
                <CodeBlock>{`{ "error": "Unauthorized: invalid API credentials" }`}</CodeBlock>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1"><Badge variant="amber">400</Badge> Agent not found</p>
                <CodeBlock>{`{ "error": "Agent not found for dialerAgentUser: unknown_agent" }`}</CodeBlock>
              </div>
            </div>
          </Section>

          <Section id="rate-limiting" title="Rate Limiting" icon={Zap}>
            <p className="text-muted-foreground mb-4">
              API credentials can be configured with per-credential rate limits. When a limit is set, requests 
              exceeding the threshold will receive a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">429 Too Many Requests</code> response.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Default limit', value: 'No limit (unless configured)' },
                { label: 'Limit window', value: 'Per minute' },
                { label: 'Header', value: 'X-RateLimit-Remaining' },
                { label: 'Retry after', value: 'Retry-After header (seconds)' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/50 rounded-lg p-4 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="error-codes" title="Error Codes" icon={AlertCircle}>
            <p className="text-muted-foreground mb-4">
              The API uses standard HTTP status codes. Error responses include a JSON body with a machine-readable <code className="text-sm bg-muted px-1.5 py-0.5 rounded">code</code> and human-readable <code className="text-sm bg-muted px-1.5 py-0.5 rounded">message</code>.
            </p>
            <CodeBlock>{`{
  "error": {
    "code": "invalid_credentials",
    "message": "The provided API key is invalid or has been revoked."
  }
}`}</CodeBlock>
            <div className="mt-4 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { status: '200', badge: 'green', code: 'ok', desc: 'Request succeeded.' },
                    { status: '400', badge: 'amber', code: 'invalid_request', desc: 'Malformed request body or missing required fields.' },
                    { status: '401', badge: 'red', code: 'unauthorized', desc: 'Missing or invalid credentials.' },
                    { status: '403', badge: 'red', code: 'forbidden', desc: 'Credential does not have access to this resource.' },
                    { status: '429', badge: 'amber', code: 'rate_limited', desc: 'Too many requests. Check Retry-After header.' },
                    { status: '500', badge: 'red', code: 'server_error', desc: 'Internal server error. Contact support if persistent.' },
                  ].map(row => (
                    <tr key={row.status} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant={row.badge as 'green' | 'amber' | 'red'}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-muted-foreground">{row.code}</code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
