# Supabase Setup

## Required Env

Use `.env.local`. It is ignored by git through `.gitignore`.

```bash
NEXT_PUBLIC_GAME_MODE=local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Legacy key names are also supported:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not expose `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

## Supabase URL And Keys

1. Open the Supabase project dashboard.
2. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the publishable key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Copy the secret/service role key into `SUPABASE_SECRET_KEY`.

## Auth Redirect URL

Add this redirect URL in Supabase Auth settings:

```text
http://localhost:3000/auth/callback
```

Add production and preview URLs before beta deployment, for example:

```text
https://your-domain.example/auth/callback
```

## SQL Execution Order

Run in Supabase SQL Editor:

1. `docs/server/sql/001_schema.sql`
2. `docs/server/sql/002_rls_policies.sql`
3. `docs/server/sql/003_action_indexes.sql`

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

- unauthenticated users see the email Magic Link login screen
- `/auth/callback` exchanges the auth code for a Supabase session
- `/api/player/bootstrap` creates missing `profiles`, `player_states`, `owned_weapons`, and `player_records`
- missing nickname opens the nickname setup modal
- game screen opens after profile bootstrap

## Security Notes

- Route Handlers use the server admin client for bootstrap and nickname writes.
- Client code uses only `NEXT_PUBLIC_SUPABASE_URL` and publishable/anon key.
- RLS is enabled for all beta tables.
- `player_states`, `owned_weapons`, and `player_records` do not expose direct client write policies.
- The DEV panel remains blocked in production.

## Next Sprint 13-B

- Move enhance, transcend, sell, buy, and forge collect to server authoritative endpoints.
- Write `game_action_logs` for every mutating action.
- Add idempotency checks around `action_id`.
- Recalculate ranking candidates on the server after authoritative actions.
- Add API rate limits and replay protection.
