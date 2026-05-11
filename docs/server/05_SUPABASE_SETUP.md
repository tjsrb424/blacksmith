# Supabase Setup

## Required Env

Use `.env.local`. It is ignored by git through `.gitignore`.

```bash
NEXT_PUBLIC_GAME_MODE=local
NEXT_PUBLIC_AD_PROVIDER=mock
NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID=
NEXT_PUBLIC_DEV_TOOLS_ENABLED=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Legacy key names are also supported:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
```

Do not expose `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.
Every `NEXT_PUBLIC_*` value is readable in the browser bundle.

## Supabase URL And Keys

1. Open the Supabase project dashboard.
2. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the publishable key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

## Auth Redirect URL

Add this redirect URL in Supabase Auth settings:

```text
http://localhost:3000/auth/callback
```

Add production and preview URLs before beta deployment, for example:

```text
https://your-domain.example/auth/callback
```

In Supabase Dashboard, also check **Authentication > URL Configuration**:

- Site URL for local development: `http://localhost:3000`
- Redirect URLs for local development: `http://localhost:3000/auth/callback`
- Redirect URLs for deployment: add every production and preview callback URL, for example `https://your-domain.example/auth/callback`

Do not add secrets to this document or to client-side env variables.

## Google OAuth Provider

Enable Google sign-in in **Supabase Dashboard > Authentication > Providers > Google**.

Create the Google OAuth client in Google Cloud:

1. Open Google Cloud Console and select the project used for beta auth.
2. Configure the OAuth consent screen.
3. Go to **APIs & Services > Credentials**.
4. Create an **OAuth client ID** with application type **Web application**.
5. Add Authorized JavaScript origins:
   - `http://localhost:3000`
   - production origin, for example `https://your-domain.example`
   - preview origins if the beta build uses them
6. Add Authorized redirect URIs:
   - Supabase callback URL from the Google provider panel, usually `https://<project-ref>.supabase.co/auth/v1/callback`
7. Copy the client ID and client secret into the Supabase Google Provider settings.

The app does not store the Google client ID or client secret. Client code only calls Supabase Auth:

```ts
supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

After Google redirects through Supabase, `/auth/callback` exchanges the returned code and sends the player back to `/`, where the existing AuthGate, bootstrap, and nickname setup flow continues.

## Magic Link Rate Limits

Magic Link remains available as a secondary login method. Supabase's default email provider has low rate limits, so repeated test sends may return `email rate limit exceeded`.

Current app UX:

- Magic Link submit is disabled while sending.
- Successful sends start a 60 second resend cooldown.
- Rate limit errors show a friendly message and suggest Google login.

Custom SMTP is optional before beta, but it should be considered if Magic Link testing or beta traffic increases.

## SQL Execution Order

Run in Supabase SQL Editor:

1. `docs/server/sql/001_schema.sql`
2. `docs/server/sql/002_rls_policies.sql`
3. `docs/server/sql/003_action_indexes.sql`
4. `docs/server/sql/004_bootstrap_fix.sql`
5. `docs/server/sql/005_ad_reward_logs.sql`
6. `docs/server/sql/006_ad_reward_limits.sql`

## Local Mode

```bash
NEXT_PUBLIC_GAME_MODE=local npm run dev
```

Behavior:

- no login required
- LocalStorage save remains active
- mock ranking adapter remains active
- existing local gameplay is preserved

## Beta Mode

```bash
NEXT_PUBLIC_GAME_MODE=beta npm run dev
```

Behavior:

- unauthenticated users see the beta login screen with Google first and Magic Link as the secondary option
- `/auth/callback` exchanges the auth code for a Supabase session
- `/api/player/bootstrap` creates missing `profiles`, `player_states`, `owned_weapons`, and `player_records`
- missing nickname opens the nickname setup modal
- game screen opens after profile bootstrap
- ad rewards use `NEXT_PUBLIC_AD_PROVIDER`; use `mock` for QA and `googleWeb` when a real rewarded unit is ready
- `NEXT_PUBLIC_DEV_TOOLS_ENABLED=false` is recommended for beta/production

## Security Notes

- Route Handlers use the server admin client for bootstrap and nickname writes.
- Client code uses only `NEXT_PUBLIC_SUPABASE_URL` and publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEY` are server-only. Never add `NEXT_PUBLIC_`.
- Google Client Secret belongs only in the Supabase Dashboard Google Provider settings.
- RLS is enabled for all beta tables.
- `player_states`, `owned_weapons`, and `player_records` do not expose direct client write policies.
- The DEV panel remains blocked in production.

## Next Sprint 13-B

- Move enhance, transcend, sell, buy, and forge collect to server authoritative endpoints.
- Write `game_action_logs` for every mutating action.
- Add idempotency checks around `action_id`.
- Recalculate ranking candidates on the server after authoritative actions.
- Add API rate limits and replay protection.
