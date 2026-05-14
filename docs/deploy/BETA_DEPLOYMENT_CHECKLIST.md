# Beta Deployment Checklist

Use this before inviting external beta users.

## 1. Vercel Env

Set these in Vercel Project Settings > Environment Variables. Scope preview and production deliberately.

```bash
NEXT_PUBLIC_GAME_MODE=beta
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_AD_PROVIDER=disabled
NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID=
NEXT_PUBLIC_AUTH_GATE_MODE=optional
NEXT_PUBLIC_DEV_TOOLS_ENABLED=false
```

Notes:

- `NEXT_PUBLIC_*` values are visible in the browser bundle.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`.
- Google Client Secret is not an app env var. Store it only in Supabase Dashboard > Authentication > Providers > Google.
- For public beta traffic before the Google rewarded unit is approved, use `NEXT_PUBLIC_AD_PROVIDER=disabled`.
- For real ad QA, set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` and `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID=<rewarded unit id>`, then redeploy.
- Use `NEXT_PUBLIC_AD_PROVIDER=mock` only for private local QA. Production builds force mock to `disabled`.
- `NEXT_PUBLIC_AUTH_GATE_MODE=optional` keeps public review pages open while `/play` can still use Google login for server save and ranking features.
- Vercel env changes require a fresh deployment before the browser bundle sees new `NEXT_PUBLIC_*` values.

## 2. Supabase

- Apply SQL in order: `001_schema.sql`, `002_rls_policies.sql`, `003_action_indexes.sql`, `004_bootstrap_fix.sql`, `005_ad_reward_logs.sql`, `006_ad_reward_limits.sql`, `007_sprint23a_performance_indexes.sql`, `008_sprint23a4_enhance_rpc.sql`, `009_sprint23a5_hot_mutation_rpcs.sql`.
- Confirm RLS is enabled on player/action/ranking/ad reward tables.
- Confirm service role key is available only to server route handlers.
- Confirm `ad_reward_logs` has no client insert/update/delete policies.

## 3. Auth Redirects

In Supabase Dashboard > Authentication > URL Configuration:

- Site URL: production app URL.
- Redirect URLs:
  - `https://<production-domain>/auth/callback`
  - preview URLs used for beta QA
  - `http://localhost:3000/auth/callback` for local QA
  - `http://<PC-IP>:3000`, `http://<PC-IP>:3000/auth/callback`, and `http://<PC-IP>:3000/**` when testing beta OAuth from an iPhone on the same Wi-Fi

In Google Cloud OAuth client:

- Authorized JavaScript origins:
  - `https://<production-domain>`
  - preview origins used for beta QA
  - `http://localhost:3000`
  - `http://<PC-IP>:3000` for internal IP mobile QA
- Authorized redirect URI:
  - Supabase provider callback, usually `https://<project-ref>.supabase.co/auth/v1/callback`

Then confirm Supabase Google Provider has the Google Client ID and Client Secret.

## 4. Ad Provider QA

Rewarded ads:

- `mock`: private local QA only. Result chooser appears only outside production, and production builds force this provider to `disabled`.
- `googleWeb`: app loads GPT and handles missing unit, no fill, close without reward, and rewarded events.
- `disabled`: app shows an unavailable message and grants nothing.
- Missing or blank `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID`: app must not crash; ad rewards stay unavailable and grant nothing.
- No fill, load error, and close without reward: `ad_reward_logs.reward_status` should become `failed` or `canceled`; no `player_states` or `owned_weapons` reward mutation should happen.
- Rewarded grant: `/api/ad/reward/complete` may grant only after the provider result has `rewarded: true`.
- Forge 2x: daily 10, cooldown 3 minutes.
- Sell +30%: daily 20, one active/completed reward per weapon instance.
- Destruction scrap 2x: disabled for this beta.

## 5. Production Safety

- Build with `NEXT_PUBLIC_DEV_TOOLS_ENABLED=false`.
- Confirm DEV panel and resource mutation buttons are not visible.
- Confirm mock ad debug chooser is not visible.
- Confirm production with `NEXT_PUBLIC_AD_PROVIDER=mock` does not expose mock rewards and behaves as `disabled`.
- Confirm client bundle does not contain `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or Google Client Secret.
- Confirm beta mode actions use server route handlers, not LocalStorage, as the source of truth.

## 6. Beta QA Order

1. Deploy preview.
2. Confirm `/` loads.
3. Login with Google.
4. Confirm `/api/player/bootstrap` returns 200.
5. Buy, enhance, transcend, sell, forge collect.
6. Upgrade forge and confirm `player_states.forge_level` changes on the server.
7. Run forge ad complete/close/failure.
8. Run sell ad complete/close/failure.
9. Confirm ranking screens load server rankings or show fallback copy.
10. Check production/preview logs for API errors.

## 7. Ad Reward SQL Checks

Recent ad reward intents:

```sql
SELECT id, user_id, reward_type, reward_status, action_id, provider, requested_at, completed_at, reward_result
FROM ad_reward_logs
ORDER BY created_at DESC
LIMIT 20;
```

Recent player state:

```sql
SELECT user_id, gold, forge_ember, transcend_stone, forge_level, updated_at
FROM player_states
ORDER BY updated_at DESC
LIMIT 10;
```

Recent owned weapons:

```sql
SELECT id, user_id, weapon_id, enhance_level, transcend_level, durability, created_at
FROM owned_weapons
ORDER BY created_at DESC
LIMIT 20;
```

## 8. Mobile Entry And Performance Gate

- On iPhone Safari, clear website data, sign in with Google, and confirm the initial `loading saved data` screen never stays for more than 12 seconds.
- On iPhone Chrome and Safari, confirm `checking_session` never stays longer than 10 seconds; failures must show retry/sign-out/server-reload actions.
- If bootstrap or player sync stalls, confirm the error screen shows retry, server reload, and sign-out paths.
- In development, check the beta performance panel for current mode, screen, auth stage/elapsed time, last API, elapsed time, bootstrap time, player sync time, store sync time, ranking cache hit/miss, tab switch time, and ad complete time.
- Confirm route logs print `[api/... ] completed in Nms` in development and warn when a request exceeds 1000ms.
- Run an enhance action and confirm the animation starts immediately while the server result is still authoritative.
- Run an ad reward complete path and confirm the UI shows reward verification immediately before the reward modal opens.
- Confirm ad reward result modal opens before deferred full snapshot sync, and close/failure grants no reward.
- Switch tabs quickly on a mobile viewport and confirm background/image preloading prevents obvious spinner-like flashes.
- Confirm production builds do not show the performance panel or dev controls.

## 9. Production Local Mobile Test

Use this before judging iPhone performance from `npm run dev`.

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000
```

- Find the PC IPv4 address with `ipconfig` on Windows.
- Open `http://<PC-IP>:3000` on the iPhone while both devices are on the same Wi-Fi.
- If testing beta OAuth on the internal IP, add `http://<PC-IP>:3000`, `http://<PC-IP>:3000/auth/callback`, and `http://<PC-IP>:3000/**` to Supabase Redirect URLs, and add `http://<PC-IP>:3000` to Google Authorized JavaScript origins.
- Compare local mode and beta mode separately.
- Treat dev-only stutter differently from production local stutter; production local is the closer pre-deploy signal.

## 10. Rollback

- Prefer promoting the last known-good preview with `vercel promote <deployment-url>`.
- If production is already affected, use `vercel rollback` or Vercel Dashboard rollback.
- If a SQL migration caused the issue, stop beta traffic first, then apply a forward fix. Avoid destructive rollback on user data.
