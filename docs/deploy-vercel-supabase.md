# Deploy BYOK to Vercel with Supabase

This guide lets a new user clone or fork BYOK from GitHub and deploy it to a personal Vercel account from zero. Supabase is used only as the PostgreSQL database. BYOK does not need Supabase Auth, Storage, Edge Functions, anon keys, or service role keys.

Official references:

- Vercel Git deployments: https://vercel.com/docs/deployments/git
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel CLI deploy: https://vercel.com/docs/cli/deploy
- Supabase database connections: https://supabase.com/docs/guides/database/connecting-to-postgres

After the Supabase database and production secrets are ready, you can start Vercel setup with the deploy button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBAIGUANGMEI%2Fbyok&project-name=byok&repository-name=byok&env=DATABASE_URL,ADMIN_EMAIL,ADMIN_PASSWORD,AUTH_SECRET,ENCRYPTION_KEY_BASE64,RELAY_DEFAULT_TIMEOUT_MS,RELAY_MAX_REQUEST_BODY_BYTES,LOG_PROMPTS_DEFAULT,ALLOW_INSECURE_PROVIDER_URLS,NEXT_PUBLIC_APP_NAME&envDescription=Configure%20BYOK%20with%20a%20Supabase%20Postgres%20connection%20and%20production%20secrets.&envLink=https%3A%2F%2Fgithub.com%2FBAIGUANGMEI%2Fbyok%2Fblob%2Fmain%2Fdocs%2Fdeploy-vercel-supabase.md)

## What You Will Create

- A Supabase project for PostgreSQL.
- A Vercel project connected to your GitHub fork or repository.
- BYOK production environment variables in Vercel.
- BYOK database tables created from the SQL files in `drizzle/`.

## Prerequisites

- A GitHub account.
- A Vercel account.
- A Supabase account.
- Node.js 20 or newer if you want to run local commands.

## 1. Fork or Clone the Repository

Recommended for Vercel Git deployment:

1. Fork the BYOK repository to your own GitHub account.
2. Keep the default branch, usually `main`.
3. Do not commit `.env`, `.env.local`, `.vercel`, or any generated secrets.

For local setup:

```bash
git clone https://github.com/<your-name>/<your-byok-repo>.git
cd <your-byok-repo>
npm install
```

## 2. Create the Supabase Database

1. Open the Supabase dashboard.
2. Create a new project.
3. Save the database password you choose during project creation.
4. Go to Project Settings -> Database -> Connection string.
5. Copy the Transaction pooler connection string for the app runtime.
6. Replace the password placeholder in the connection string with your database password.

Use the Transaction pooler connection string for `DATABASE_URL` on Vercel. Vercel runs serverless functions, and the pooler is better suited for many short-lived connections. BYOK already disables prepared statements with `prepare: false`, which is required for transaction-pooled PostgreSQL connections.

The connection string usually looks similar to this:

```text
postgres://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

If Supabase gives you a direct connection string and a pooler connection string, use:

- Vercel `DATABASE_URL`: Transaction pooler.
- Local migrations: Direct connection if it works from your network, otherwise use the SQL Editor method below.

## 3. Initialize the Database

You must run the SQL migrations before using the admin dashboard.

### Option A: Supabase SQL Editor

This is the easiest path for users who do not want local database tooling.

1. Open Supabase -> SQL Editor.
2. Create a new query.
3. Copy the full contents of `drizzle/0000_initial.sql`. If you did not clone the repository locally, open the file from GitHub: https://github.com/BAIGUANGMEI/byok/blob/main/drizzle/0000_initial.sql
4. Run it.
5. Create another new query.
6. Copy the full contents of `drizzle/0001_usage_cache_tokens.sql`. GitHub link: https://github.com/BAIGUANGMEI/byok/blob/main/drizzle/0001_usage_cache_tokens.sql
7. Run it.
8. Open Table Editor and confirm tables such as `provider_sources`, `model_mappings`, `relay_api_keys`, `request_logs`, and `daily_usage` exist.

Run migration files in filename order. Future files under `drizzle/` should be run the same way.

### Option B: Local Migration Command

Use this if you cloned the project locally.

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your Supabase database connection string.

Then run:

```bash
npm run db:migrate
```

Expected output:

```text
Migration complete
```

## 4. Generate Production Secrets

Generate the provider API-key encryption key:

```bash
npm run generate:key
```

Copy the output and save it as `ENCRYPTION_KEY_BASE64`.

Generate an admin session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Copy the output and save it as `AUTH_SECRET`.

Important:

- `AUTH_SECRET` must be at least 32 characters.
- `ENCRYPTION_KEY_BASE64` must be kept stable after deployment.
- If `ENCRYPTION_KEY_BASE64` changes, existing encrypted provider API keys may no longer decrypt.
- Use a strong `ADMIN_PASSWORD` for any public deployment.

## 5. Configure Vercel Environment Variables

In Vercel:

1. Import your GitHub fork as a new Vercel project.
2. Framework preset should be detected as Next.js.
3. Build command can stay as `npm run build`.
4. Go to Project Settings -> Environment Variables.
5. Add these variables to Production. Add them to Preview too if you want preview deployments to work.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Supabase Transaction pooler connection string |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Strong admin login password |
| `AUTH_SECRET` | Random secret generated above |
| `ENCRYPTION_KEY_BASE64` | Output of `npm run generate:key` |
| `RELAY_DEFAULT_TIMEOUT_MS` | `60000` |
| `RELAY_MAX_REQUEST_BODY_BYTES` | `4500000` |
| `LOG_PROMPTS_DEFAULT` | `false` |
| `ALLOW_INSECURE_PROVIDER_URLS` | `false` |
| `NEXT_PUBLIC_APP_NAME` | `BYOK` |

Do not add Supabase anon keys or service role keys. BYOK connects to Supabase through PostgreSQL only.

## 6. Deploy

### Dashboard Deployment

After the variables are set:

1. Click Deploy in Vercel.
2. Wait for the deployment to finish.
3. Open the generated production URL.

Future pushes to the production branch will trigger automatic deployments.

### CLI Deployment

If you prefer the CLI:

```bash
npm i -g vercel
vercel login
vercel link
vercel deploy --prod
```

If the project is already connected to GitHub, the dashboard flow is usually simpler.

## 7. Verify the Deployment

Open:

```text
https://<your-vercel-domain>/login
```

Sign in with:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Then:

1. Go to Sources and add an upstream provider.
2. Go to Models and map a public model name to the upstream model.
3. Go to Keys and create a relay API key.
4. Test the public API.

OpenAI-compatible test:

```bash
curl https://<your-vercel-domain>/v1/chat/completions \
  -H "Authorization: Bearer sk-relay-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coding",
    "messages": [
      { "role": "user", "content": "Say hello from BYOK." }
    ],
    "stream": false
  }'
```

Anthropic-compatible test:

```bash
curl https://<your-vercel-domain>/v1/messages \
  -H "x-api-key: sk-relay-xxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coding",
    "max_tokens": 256,
    "messages": [
      { "role": "user", "content": "Say hello from BYOK." }
    ],
    "stream": false
  }'
```

## 8. Updating an Existing Deployment

For normal code changes:

```bash
git add .
git commit -m "Update BYOK"
git push
```

Vercel will deploy automatically if Git integration is enabled.

For new database migrations:

1. Run new SQL files in `drizzle/` on Supabase in filename order, or run `npm run db:migrate` with the production `DATABASE_URL`.
2. Deploy the new code to Vercel.
3. Verify login and API calls.

## Troubleshooting

### Build Fails With Missing Environment Variables

Check Vercel Project Settings -> Environment Variables. Make sure every variable in this guide exists in the Production environment. Redeploy after changing variables.

### Login Fails or Immediately Logs Out

Check:

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` match what you entered.
- `AUTH_SECRET` exists and is at least 32 characters.
- You redeployed after changing environment variables.

### Dashboard Loads But Tables Are Missing

The migrations were not run against the Supabase project used by Vercel. Confirm `DATABASE_URL` points to the correct Supabase project, then run the migration files again.

### Provider API Keys Cannot Decrypt

`ENCRYPTION_KEY_BASE64` changed after provider sources were created. Restore the original key, or recreate the provider sources with the new key.

### Supabase Connection Fails From Vercel

Use the Supabase Transaction pooler connection string for Vercel. Confirm the password placeholder was replaced, the project is active, and the connection string was saved in Vercel Production variables.

### Preview Deployments Fail

Preview deployments need their own environment variables in Vercel. Either add the same variables to Preview or disable preview deployments for this project.
