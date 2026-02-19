export function generatePostmanCollection() {
  const collection = {
    info: {
      name: "Padsplit API v1",
      description: "The Padsplit API lets external applications submit call data into the platform.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "apikey",
      apikey: [
        { key: "key", value: "X-Client-ID", type: "string" },
        { key: "value", value: "{{client_id}}", type: "string" },
        { key: "in", value: "header", type: "string" },
      ],
    },
    variable: [
      { key: "base_url", value: "https://padsplit.tools/functions/v1", type: "string" },
      { key: "client_id", value: "app_your_client_id_here", type: "string" },
      { key: "client_secret", value: "sk_your_client_secret_here", type: "string" },
    ],
    item: [
      {
        name: "Submit Conversation Audio",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json", type: "text" },
            { key: "X-Client-ID", value: "{{client_id}}", type: "text" },
            { key: "X-Client-Secret", value: "{{client_secret}}", type: "text" },
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify(
              {
                audioUrl: "https://storage.example.com/recordings/call-123.mp3",
                dialerAgentUser: "agent_john_doe",
                phoneNumber: "+14155551234",
                campaign: "Q1-Research-2026",
                type: "research",
              },
              null,
              2
            ),
            options: { raw: { language: "json" } },
          },
          url: {
            raw: "{{base_url}}/submit-conversation-audio",
            host: ["{{base_url}}"],
            path: ["submit-conversation-audio"],
          },
          description:
            "Submit conversation audio recordings from external dialer platforms. Records are stored for auditing and automatically appear in the Reports tab under the Research category.",
        },
        response: [
          {
            name: "201 - Created",
            status: "Created",
            code: 201,
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify(
              {
                success: true,
                bookingId: "uuid-of-created-record",
                matchedAgent: { id: "uuid-of-agent", name: "John Doe" },
              },
              null,
              2
            ),
          },
          {
            name: "400 - Validation Failed",
            status: "Bad Request",
            code: 400,
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify(
              { error: "Validation failed", details: ["audioUrl is required", 'type must be "research"'] },
              null,
              2
            ),
          },
          {
            name: "401 - Unauthorized",
            status: "Unauthorized",
            code: 401,
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({ error: "Unauthorized: invalid API credentials" }, null, 2),
          },
        ],
      },
    ],
  };

  return collection;
}

export function downloadPostmanCollection() {
  const collection = generatePostmanCollection();
  const json = JSON.stringify(collection, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Padsplit_API_v1.postman_collection.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
