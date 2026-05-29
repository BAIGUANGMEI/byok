const openAIExample = `curl http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-relay-xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "messages": [
      { "role": "user", "content": "Introduce yourself in one sentence" }
    ],
    "stream": false
  }'`;

const anthropicExample = `curl http://localhost:3000/v1/messages \\
  -H "x-api-key: sk-relay-xxx" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "max_tokens": 1024,
    "messages": [
      { "role": "user", "content": "Introduce yourself in one sentence" }
    ],
    "stream": false
  }'`;

const streamExample = `curl -N http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-relay-xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "messages": [
      { "role": "user", "content": "Write a TypeScript debounce function" }
    ],
    "stream": true
  }'`;

const anthropicImageExample = `curl http://localhost:3000/v1/messages \\
  -H "x-api-key: sk-relay-xxx" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "vision",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "BASE64_IMAGE_DATA"
            }
          },
          { "type": "text", "text": "Describe this image." }
        ]
      }
    ]
  }'`;

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Docs</h2>
        <p className="text-sm text-zinc-400">Gateway setup, exposed APIs, and request examples.</p>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">Setup Flow</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <p className="font-medium">1. Provider source</p>
            <p className="mt-2 text-sm text-zinc-400">
              Add the upstream vendor base URL, API key, auth type, and upstream API format.
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <p className="font-medium">2. Model mapping</p>
            <p className="mt-2 text-sm text-zinc-400">
              Map one public model name to the upstream model name expected by the provider.
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <p className="font-medium">3. Relay key</p>
            <p className="mt-2 text-sm text-zinc-400">
              Create a relay API key and use it from clients instead of exposing upstream provider keys.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">Protocol Model</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          A provider source has one upstream format: <code>openai_chat</code> or <code>anthropic_messages</code>. That
          only controls how the gateway talks to the upstream provider. Each public model is exposed through both relay
          APIs, so the same model name can be used by OpenAI-compatible clients and Anthropic-compatible clients.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">Exposed Interfaces</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Auth</th>
                <th className="px-3 py-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-800">
                <td className="px-3 py-2 font-mono text-xs">GET</td>
                <td className="px-3 py-2 font-mono text-xs">/v1/models</td>
                <td className="px-3 py-2">Bearer relay key</td>
                <td className="px-3 py-2">List enabled public model names and aliases.</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-3 py-2 font-mono text-xs">POST</td>
                <td className="px-3 py-2 font-mono text-xs">/v1/chat/completions</td>
                <td className="px-3 py-2">Bearer relay key</td>
                <td className="px-3 py-2">OpenAI-compatible chat completion, including streaming and image input.</td>
              </tr>
              <tr className="border-t border-zinc-800">
                <td className="px-3 py-2 font-mono text-xs">POST</td>
                <td className="px-3 py-2 font-mono text-xs">/v1/messages</td>
                <td className="px-3 py-2">x-api-key relay key</td>
                <td className="px-3 py-2">Anthropic-compatible messages API, including streaming and image input.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="font-medium">OpenAI-Compatible Request</h3>
          <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-200">{openAIExample}</pre>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="font-medium">Anthropic-Compatible Request</h3>
          <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-200">{anthropicExample}</pre>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">Streaming Request</h3>
        <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-200">{streamExample}</pre>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">Anthropic Image Request</h3>
        <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-200">
          {anthropicImageExample}
        </pre>
      </section>
    </div>
  );
}
