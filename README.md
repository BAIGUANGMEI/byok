# AI Relay Gateway

Personal AI API relay gateway that exposes OpenAI-compatible and Anthropic-compatible APIs over configurable upstream providers.

## Features

- Single admin dashboard with httpOnly session cookie auth.
- Provider source, model mapping, alias, fallback route, and relay key management.
- OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions`.
- Anthropic-compatible `POST /v1/messages`.
- Non-streaming and SSE streaming relay.
- Provider API keys encrypted with AES-256-GCM.
- Relay API keys stored only as HMAC-SHA256 hashes.
- Request logs, daily usage aggregation, token estimation, and cost estimation.
- Retry fallback for rate limits, provider timeouts, overloads, and 5xx errors.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- Vitest
- Node.js crypto

## Environment

Copy `.env.example` to `.env` and fill values:

```env
DATABASE_URL="postgres://user:password@host:5432/db"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-me"
AUTH_SECRET="replace-with-long-random-secret"
ENCRYPTION_KEY_BASE64="replace-with-32-byte-base64-key"
RELAY_DEFAULT_TIMEOUT_MS="60000"
RELAY_MAX_REQUEST_BODY_BYTES="4500000"
LOG_PROMPTS_DEFAULT="false"
ALLOW_INSECURE_PROVIDER_URLS="false"
NEXT_PUBLIC_APP_NAME="AI Relay Gateway"
```

Generate an encryption key:

```bash
npm run generate:key
```

## Local Development

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000/login` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Database Migration

The initial SQL migration is in `drizzle/0000_initial.sql`.

Run:

```bash
npm run db:migrate
```

Future migrations can be added as additional SQL files under `drizzle/` and wired into `scripts/migrate.ts`.

## Admin Setup

This MVP does not store admin users in the database. The single admin account is configured by:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

For public deployment, use a strong password and long random `AUTH_SECRET`.

## Add a Provider Source

1. Go to `/dashboard/sources`.
2. Create a source using a preset as a reference.
3. Set `protocol` to `openai_chat` or `anthropic_messages`.
4. Set `authType` to `bearer`, `x-api-key`, or `api-key`.
5. Enter the upstream API key. It is encrypted before storage and is never returned by API responses.

## Add a Model

1. Go to `/dashboard/models`.
2. Create a model mapping.
3. Use a public model name such as `deepseek/deepseek-chat` or `coding`.
4. Set the upstream model name exactly as the provider expects.
5. Optionally set prices per 1M tokens for cost estimates.

## Create a Relay API Key

1. Go to `/dashboard/keys`.
2. Create a key.
3. Copy the full key from the success message. It is shown only once.

The database stores only `key_hash`, `key_prefix`, and `last4`.

## OpenAI Curl Examples

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-relay-xxx"
```

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-relay-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coding",
    "messages": [
      {"role": "user", "content": "Introduce yourself in one sentence"}
    ],
    "stream": false
  }'
```

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-relay-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coding",
    "messages": [
      {"role": "user", "content": "Write a TypeScript debounce function"}
    ],
    "stream": true
  }'
```

## Anthropic Curl Examples

```bash
curl http://localhost:3000/v1/messages \
  -H "x-api-key: sk-relay-xxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coding",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Introduce yourself in one sentence"}
    ],
    "stream": false
  }'
```

```bash
curl -N http://localhost:3000/v1/messages \
  -H "x-api-key: sk-relay-xxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coding",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Write a TypeScript debounce function"}
    ],
    "stream": true
  }'
```

## Security Notes

- Provider API keys are encrypted with AES-256-GCM.
- Relay API keys are hashed with HMAC-SHA256 and are never stored in plaintext.
- Prompt and response bodies are not saved by default.
- Provider base URLs must be HTTPS by default and cannot target local, metadata, or private IP ranges.
- Sensitive fields are redacted by helper utilities before logging.

## Vercel Notes

- Route handlers use the Node.js runtime.
- Streaming uses SSE over Web Streams.
- WebSocket, file uploads, images, audio, embeddings, billing, teams, and public registration are intentionally out of scope.
- Long streaming responses are still subject to Vercel function limits.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
