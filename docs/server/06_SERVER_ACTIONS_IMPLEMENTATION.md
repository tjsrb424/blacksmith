# Sprint 13-B Server Actions Implementation

## Implemented APIs

- `POST /api/game/buy`
- `POST /api/game/enhance`
- `POST /api/game/transcend`
- `POST /api/game/sell`
- `POST /api/game/forge/collect`
- `POST /api/ranking/submit`
- `GET /api/ranking/weekly`
- `GET /api/ranking/world`
- `GET /api/player/me`

All endpoints require an authenticated Supabase session. The server uses the session user id and ignores any client-supplied user id.

## Request Pattern

Common fields:

```json
{
  "actionId": "client-generated-uuid",
  "clientCreatedAt": "2026-05-09T00:00:00.000Z"
}
```

Action-specific fields:

- buy: `weaponId`
- enhance: `weaponInstanceId`
- transcend: `weaponInstanceId`
- sell: `weaponInstanceId`, `sellMode`
- forge collect: `collectMode`
- ranking submit: `weaponInstanceId`, `seasonId`

## Response Pattern

```json
{
  "actionId": "...",
  "actionType": "enhance",
  "status": "applied",
  "snapshot": {},
  "display": {}
}
```

`snapshot` is the server state used to sync the beta client store. `display` contains only UI result data for modals, sounds, and animations.

## Server Validation

- Auth is required before every action.
- Weapon ownership is checked against `owned_weapons.user_id`.
- Weapon definitions are loaded from the server bundle.
- Costs, success rates, sale values, forge production, scrap rewards, ranking values, and record updates are server-calculated.
- Client gold, ember, stone, success result, sale value, ranking value, and time are ignored.

## Idempotency

`game_action_logs.action_id` is checked before processing.

1. If the action id already has a completed result for the same user, that result is returned as `status: "replayed"`.
2. If it belongs to another user, the request is rejected.
3. If it is pending, the request is rejected as an in-progress conflict.
4. New actions insert a pending log before mutation and update the log with the final response.

Run `docs/server/sql/003_action_indexes.sql` to ensure the upsert/idempotency indexes exist.

## Server RNG

Enhance and transcend use Node `crypto.randomInt` through `serverRandom.ts`.

Scrap reward random rolls also use server-side randomness. The client never sends success/failure or reward rolls.

## Ranking Updates

- Strongest weapon updates `player_records`, `weekly_rankings`, and `world_records`.
- Sales update `player_records`, weekly sales ranking, and world sale record.
- Enhancement and transcend success counts update weekly category rows.
- Enhancement attempts update `worldRecordEnhanceAttempts`.
- Transcend successes update `worldRecordTranscendSuccesses`.
- Transcended weapons update `worldRecordTranscend`.
- Destroyed high-value weapons update `worldRecordDestroyedWeapon`.
- Ranking value excludes ad sale bonus.

## Ranking Reads

`GET /api/ranking/weekly` reads `weekly_rankings` by `season_id` and `category`, sorted by `score desc` and `created_at asc`. It returns display rows plus `playerRank` when the current player is present in the returned set.

`GET /api/ranking/world` reads `world_records` by category and returns the world cards consumed by `RankingScreen`.

`RankingScreen` uses `serverRankingAdapter` in beta mode. If any server ranking request fails, the adapter returns Mock data with `source: "fallback"` so the UI can show an explicit fallback badge.

## Action QA Procedure

1. Set `NEXT_PUBLIC_GAME_MODE=beta` and restart `npm run dev`.
2. Sign in with Google and confirm `POST /api/player/bootstrap` returns 200.
3. Buy a weapon and check `player_states.gold`, `owned_weapons`, and the client inventory.
4. Enhance a weapon and check `player_states.forge_ember`, `owned_weapons.enhance_level` or `durability`, `player_records`, and `weekly_rankings`.
5. Transcend a +15 weapon and check `player_states.transcend_stone`, `owned_weapons.transcend_level` or deletion on destruction, `player_records`, and `world_records`.
6. Sell a weapon and check `player_states.gold`, `owned_weapons` deletion, `player_records.total_sales_gold`, `player_records.best_sale_gold`, and sale rankings.
7. Collect forge rewards and check `player_states.forge_ember` plus `forge_last_collected_at`.

## actionId Replay Test

In development, capture a successful request body from the Network tab and resend the exact same JSON payload to the same endpoint with the browser session still active.

Expected result:

- The second response has `status: "replayed"`.
- `game_action_logs.result` is reused.
- `player_states` and `owned_weapons` are not charged or mutated twice.

If the same `actionId` is sent by another account or while the original action is still pending, the API returns an action conflict.

## Mode Difference

local mode:

- Existing LocalStorage game actions remain active.
- Mock ranking remains active.
- Login is not required.

beta mode:

- AuthGate requires login.
- Core actions call server APIs.
- Server response snapshot is applied to the Zustand store.
- Local ad reward shortcuts are disabled.
- Forge upgrade is blocked until it receives a server action.

## Remaining Security Work

- Add database transactions or RPC wrappers around multi-step mutations.
- Add rate limits per user/IP.
- Add stricter action log pending recovery.
- Add server-side ad verification for reward modes.
- Add full server authoritative forge upgrade.
- Add admin monitoring for suspicious action rates.

## Next Sprint

- Implement transactional RPCs for each game action.
- Add server-side inventory lock/unlock action.
- Add audit dashboards for `game_action_logs`.
