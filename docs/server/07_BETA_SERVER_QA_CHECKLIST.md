# Sprint 17 Beta Server QA Checklist

## Setup

1. Confirm SQL files `001_schema.sql` through `009_sprint23a5_hot_mutation_rpcs.sql` have been applied.
2. Confirm `.env.local` has `NEXT_PUBLIC_GAME_MODE=beta`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm ad env:
   - Public beta before ad approval: `NEXT_PUBLIC_AD_PROVIDER=disabled`
   - Private local QA only: `NEXT_PUBLIC_AD_PROVIDER=mock`
   - Google Web: `NEXT_PUBLIC_AD_PROVIDER=googleWeb`
   - Real unit: `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID`
   - Production builds force `mock` to `disabled`.
4. Restart `npm run dev` after env changes.
5. Clear site data, sign in with Google, and confirm `POST /api/player/bootstrap` returns 200.

## Supabase Tables To Watch

- `profiles`
- `player_states`
- `owned_weapons`
- `player_records`
- `game_action_logs`
- `weekly_rankings`
- `world_records`
- `ad_reward_logs`

Ad reward SQL checks:

```sql
SELECT id, user_id, reward_type, reward_status, action_id, provider, requested_at, completed_at, reward_result
FROM ad_reward_logs
ORDER BY created_at DESC
LIMIT 20;

SELECT user_id, gold, forge_ember, transcend_stone, forge_level, updated_at
FROM player_states
ORDER BY updated_at DESC
LIMIT 10;

SELECT id, user_id, weapon_id, enhance_level, transcend_level, durability, created_at
FROM owned_weapons
ORDER BY created_at DESC
LIMIT 20;
```

## Game Action Checks

- Buy: `POST /api/game/buy` subtracts `player_states.gold`, inserts `owned_weapons`, and returns a snapshot that updates inventory.
- Enhance: `POST /api/game/enhance` spends `forge_ember`, uses server RNG, updates `owned_weapons`, updates records/rankings, and returns modal display data.
- Transcend: `POST /api/game/transcend` only accepts eligible +15 weapons, spends `transcend_stone`, uses server RNG, updates records/rankings, and handles destruction.
- Sell: `POST /api/game/sell` removes the weapon, adds gold, updates sale records/rankings, and keeps ad bonus out of weapon ranking value.
- Starter weapon sale: with only the starter weapon owned, sell must fail with `last_weapon_cannot_sell`; after buying another weapon, the starter can be sold and must not be recreated by bootstrap/player sync/buy snapshots.
- Ad sell: `sellBonus` must use the same last-weapon guard and must delete the target weapon on the server before returning the reward result.
- Forge collect: `POST /api/game/forge/collect` computes pending reward from server time, updates `forge_ember`, and advances `forge_last_collected_at`.
- Forge upgrade: `POST /api/game/forge/upgrade` computes cost from server `forge_level`, subtracts gold, increments `forge_level`, and replays safely for the same `actionId`.

## Sprint 18 Stability Checks

- Auth/session: on iPhone Safari, clear site data and confirm session check, bootstrap, and store sync either complete or move to an error/retry screen within 12 seconds.
- Bootstrap timeout: simulate a blocked `/api/player/bootstrap` request and confirm the loading screen changes to a clear network/server delay message.
- Server reload: from any server action error modal, click `server data reload` and confirm `/api/player/me` syncs the store and fixes equipped weapon state.
- Latency logs: in development, confirm these routes log elapsed time and warn above 1000ms: player bootstrap/me, buy, enhance, transcend, sell, forge collect, forge upgrade, ad reward request/complete/status, ranking weekly/world.
- Enhance UX: click enhance and confirm hammer/sound starts immediately, server state is not applied before the response, and slow responses show `server result checking`.
- Ad complete UX: after rewarded completion, confirm `reward verifying` appears immediately, tabs/buttons are blocked while complete runs, and the reward modal opens after the server snapshot is applied.
- Ranking tab: switch to Ranking repeatedly and confirm server ranking requests are cached briefly instead of refetching every mount.
- Tab switching: rapidly switch all five tabs on a mobile viewport and confirm backgrounds/icons are preloaded and no full-screen spinner appears.
- Production safety: build with `NEXT_PUBLIC_DEV_TOOLS_ENABLED=false` and confirm the performance panel is absent.

## actionId Idempotency

1. Perform a successful action.
2. Copy the request body from the Network tab.
3. Resend the same body to the same endpoint with the same authenticated browser session.
4. Confirm the response returns `status: "replayed"`.
5. Confirm `player_states`, `owned_weapons`, and `player_records` did not change a second time.

## RankingScreen

- Beta mode first calls `serverRankingAdapter`.
- Successful server reads show `SERVER RANKING`.
- Failed server reads show fallback copy and Mock ranking data.
- Local mode continues to use Mock/local ranking data.
- If the player has no row in a category, the UI should show that there is no ranking record yet.

## Error UX

Confirm these user-facing cases:

- Expired session: `세션이 만료되었습니다. 다시 로그인해주세요.`
- Gold shortage: `골드가 부족합니다.`
- Ember shortage: `제련의 불씨가 부족합니다. 제련로에서 수령해보세요.`
- Stone shortage: `초월석이 부족합니다.`
- Missing weapon: `무기를 찾을 수 없습니다. 서버 데이터 다시 불러오기를 눌러주세요.`
- Stale screen/server mismatch: refresh with `서버 데이터 다시 불러오기`.

## Ad Reward Checks

- Set `NEXT_PUBLIC_AD_PROVIDER=disabled` for public beta until a real Google ad unit is ready.
- Set `NEXT_PUBLIC_AD_PROVIDER=mock` only for private local QA.
- Set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` and `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID` for Google Web rewarded QA, then redeploy.
- Forge 2x complete: click `광고 보고 2배 수령`, choose `광고 완료`, confirm `ad_reward_logs` goes `pending -> processing -> completed`, and confirm `player_states.forge_ember` increases by the doubled amount.
- Forge 2x close: choose `광고 닫기`, confirm `ad_reward_logs.reward_status = canceled` and no resource changes.
- Forge 2x failure: choose `광고 실패`, confirm `ad_reward_logs.reward_status = failed` and no resource changes.
- Sell +30% complete: click `광고 보고 +30% 판매`, choose `광고 완료`, confirm the weapon is removed, gold increases by the ad sale value, and `rankingValue` remains the base weapon ranking value.
- Sell +30% close/failure: choose `광고 닫기` or `광고 실패`, confirm the weapon remains and no gold is granted.
- Status API: `GET /api/ad/reward/status` returns daily use, limits, cooldown, and active pending intent info.
- Forge daily limit: after 10 completed `forgeCollectDouble` rewards in the same UTC day, confirm request returns a limit error.
- Forge cooldown: after a forge ad attempt, confirm another request within 3 minutes is blocked.
- Sell daily limit: after 20 completed `sellBonus` rewards in the same UTC day, confirm request returns a limit error.
- Sell duplicate: create or complete a `sellBonus` for a weapon and confirm another reward for the same `targetWeaponInstanceId` is blocked.
- Replay: resend the same complete payload for a completed `rewardIntentId`; confirm the response is replayed and no second reward is granted.
- Direct sell API guard: send `/api/game/sell` with `sellMode: "adBonus"` and confirm it is rejected with `ad_reward_required`.
- Google Web without unit: set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` and blank unit id; confirm the provider fails safely instead of granting a reward.
- Google Web with unit: set `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID`; confirm GPT script load is attempted and no reward is granted unless `rewardedSlotGranted` fires before close.
- Google Web no fill/error/close: confirm `ad_reward_logs.reward_status` becomes `failed` or `canceled`, no resource changes occur, and the user sees the not-completed/unavailable message.
- Production mock defense: build/start with `NEXT_PUBLIC_AD_PROVIDER=mock`; confirm the app behaves as `disabled` and no mock chooser appears.
- Destruction scrap 2x: beta UI remains hidden until a persisted destruction `relatedActionId` flow is added.

## Deployment/Security Checks

- Confirm `.env.local` is ignored by git.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEY` are never referenced from client components.
- Confirm Google Client Secret is only stored in Supabase Dashboard.
- Confirm production build does not show the DEV panel or dev resource buttons.
- Confirm mock ad result chooser is hidden in production.
- Confirm beta mode mutation APIs do not trust LocalStorage values.

## Balance Pass 01 Checks

- In the first 3 minutes, confirm Forge Lv.1 produces enough ember for roughly 3-5 starter enhancement attempts without relying on ads.
- Confirm +0 through +7 feels smoother than the risk band.
- Confirm +8 and above consumes durability on failure and feels meaningfully risky.
- Confirm first sale after +3 to +5 provides noticeable next-buy progress.
- Confirm +15 is not trivial in a short session because high-level success rates and costs are tighter.
- Confirm Forge 2x and Sell +30% are useful but not mandatory.

## Remaining Server Work

- Wrap multi-step mutations in database RPC transactions.
- Add rate limiting to mutation and ranking endpoints.
- Add server-side ad verification before beta traffic.
- Add lock/unlock server actions if lock UX becomes part of beta.
- Add admin monitoring queries for suspicious `game_action_logs` patterns.
