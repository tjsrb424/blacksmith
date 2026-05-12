# Beta Deployment Checklist

Use this before inviting external beta users.

## 1. Vercel Env

Set these in Vercel Project Settings > Environment Variables. Scope preview and production deliberately.

```bash
NEXT_PUBLIC_GAME_MODE=beta
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_AD_PROVIDER=mock
NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID=
NEXT_PUBLIC_DEV_TOOLS_ENABLED=false
```

Notes:

- `NEXT_PUBLIC_*` values are visible in the browser bundle.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`.
- Google Client Secret is not an app env var. Store it only in Supabase Dashboard > Authentication > Providers > Google.
- For first beta traffic, use `NEXT_PUBLIC_AD_PROVIDER=mock` or `disabled` until the Google rewarded unit is approved.

## 2. Supabase

- Apply SQL in order: `001_schema.sql`, `002_rls_policies.sql`, `003_action_indexes.sql`, `004_bootstrap_fix.sql`, `005_ad_reward_logs.sql`, `006_ad_reward_limits.sql`.
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

- `mock`: result chooser appears only outside production.
- `googleWeb`: app loads GPT and handles missing unit, no fill, close without reward, and rewarded events.
- `disabled`: app shows an unavailable message and grants nothing.
- Forge 2x: daily 10, cooldown 3 minutes.
- Sell +30%: daily 20, one active/completed reward per weapon instance.
- Destruction scrap 2x: disabled for this beta.

## 5. Production Safety

- Build with `NEXT_PUBLIC_DEV_TOOLS_ENABLED=false`.
- Confirm DEV panel and resource mutation buttons are not visible.
- Confirm mock ad debug chooser is not visible.
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

## 7. Mobile Entry And Performance Gate

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

## 8. Production Local Mobile Test

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

## 9. Rollback

- Prefer promoting the last known-good preview with `vercel promote <deployment-url>`.
- If production is already affected, use `vercel rollback` or Vercel Dashboard rollback.
- If a SQL migration caused the issue, stop beta traffic first, then apply a forward fix. Avoid destructive rollback on user data.
